import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { validateIntegrity } from '../utils/integrity';
import { useFileSystem } from '../components/FileSystemContext';
import { useAppContext } from '../components/AppContext';
import { getCommand, commands, getAllCommands } from '../utils/terminal/registry';
import { getColorShades } from '../utils/colors';

export interface CommandHistory {
    command: string;
    output: (string | ReactNode)[];
    error?: boolean;
    path: string;
    accentColor?: string;
    user?: string;
}

const PATH = ['/bin', '/usr/bin'];

// Helper to safely parse command input respecting quotes
const parseCommandInput = (input: string): { command: string; args: string[]; redirectOp: string | null; redirectPath: string | null } => {
    const regex = /"([^"]*)"|'([^']*)'|(>>?)|([^\s"']+)/g;
    const tokens: string[] = [];
    let match;

    while ((match = regex.exec(input)) !== null) {
        if (match[1] !== undefined) tokens.push(match[1]); // Double quote content
        else if (match[2] !== undefined) tokens.push(match[2]); // Single quote content
        else if (match[3] !== undefined) tokens.push(match[3]); // Redirection op
        else if (match[4] !== undefined) tokens.push(match[4]); // Word
        else tokens.push(match[0]); // Fallback
    }

    if (tokens.length === 0) return { command: '', args: [], redirectOp: null, redirectPath: null };

    // Scan for redirection
    let redirectIndex = -1;
    let redirectOp: string | null = null;

    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === '>' || tokens[i] === '>>') {
            redirectIndex = i;
            redirectOp = tokens[i];
            break;
        }
    }

    if (redirectIndex !== -1) {
        const commandParts = tokens.slice(0, redirectIndex);
        const pathPart = tokens[redirectIndex + 1] || null;
        return {
            command: commandParts[0] || '',
            args: commandParts.slice(1),
            redirectOp,
            redirectPath: pathPart
        };
    }

    return {
        command: tokens[0],
        args: tokens.slice(1),
        redirectOp: null,
        redirectPath: null
    };
};

export function useTerminalLogic(onLaunchApp?: (appId: string, args: string[]) => void) {
    const { accentColor } = useAppContext();
    const [history, setHistory] = useState<CommandHistory[]>([]);
    const [input, setInput] = useState('');
    const [commandHistory, setCommandHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [ghostText, setGhostText] = useState('');
    const integrityCheckRun = useRef(false);

    // Session Stack for su/sudo (independent of global desktop session)
    const [sessionStack, setSessionStack] = useState<string[]>([]);

    const {
        listDirectory,
        getNodeAtPath,
        createFile,
        createDirectory,
        moveToTrash,
        readFile,
        resolvePath: contextResolvePath,
        homePath,
        currentUser,
        users,
        groups,
        moveNode,
        login,
        logout,
        resetFileSystem,
        chmod,
        chown,
        writeFile
    } = useFileSystem();

    // Initialize session with current global user
    useEffect(() => {
        if (sessionStack.length === 0 && currentUser) {
            setSessionStack([currentUser]);
        }
    }, [currentUser, sessionStack.length]);

    const activeTerminalUser = sessionStack.length > 0 ? sessionStack[sessionStack.length - 1] : (currentUser || 'guest');

    // Each Terminal instance has its own working directory
    const [currentPath, setCurrentPath] = useState(homePath);

    const pushSession = useCallback((username: string) => {
        setSessionStack(prev => [...prev, username]);
    }, []);

    const closeSession = useCallback(() => {
        setSessionStack(prev => {
            if (prev.length > 1) return prev.slice(0, -1);
            return prev;
        });
    }, []);

    // Local path resolution
    const resolvePath = useCallback((path: string): string => {
        if (path.startsWith('/')) return contextResolvePath(path);
        if (path === '~') return homePath;
        if (path.startsWith('~/')) return homePath + path.slice(1);

        const parts = currentPath.split('/').filter(p => p);
        const pathParts = path.split('/');

        for (const part of pathParts) {
            if (part === '..') {
                parts.pop();
            } else if (part !== '.' && part !== '') {
                parts.push(part);
            }
        }
        return '/' + parts.join('/');
    }, [currentPath, contextResolvePath, homePath]);

    // Accent Color Logic
    const getTerminalAccentColor = useCallback(() => {
        if (activeTerminalUser === 'root') return '#ef4444';
        if (activeTerminalUser === currentUser) return accentColor;
        return '#a855f7';
    }, [activeTerminalUser, currentUser, accentColor]);

    const termAccent = getTerminalAccentColor();
    const shades = getColorShades(termAccent);

    // Glob expansion
    const expandGlob = useCallback((pattern: string): string[] => {
        if (!pattern.includes('*')) return [pattern];
        const resolvedPath = resolvePath(currentPath);
        if (pattern.includes('/')) return [pattern];
        const files = listDirectory(resolvedPath, activeTerminalUser);
        if (!files) return [pattern];

        const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        const matches = files
            .filter(f => regex.test(f.name))
            .map(f => f.name);

        return matches.length > 0 ? matches : [pattern];
    }, [currentPath, resolvePath, listDirectory, activeTerminalUser]);

    // Autocomplete
    const getAutocompleteCandidates = useCallback((partial: string, isCommand: boolean): string[] => {
        const candidates: string[] = [];
        if (isCommand) {
            candidates.push(...Object.values(commands)
                .filter(c => !c.hidden && c.name.startsWith(partial))
                .map(c => c.name));

            for (const pathDir of PATH) {
                const files = listDirectory(pathDir, activeTerminalUser);
                if (files) {
                    files.forEach(f => {
                        if (f.name.startsWith(partial) && f.type === 'file') {
                            candidates.push(f.name);
                        }
                    });
                }
            }
        } else {
            let searchDir = currentPath;
            let searchPrefix = partial;
            const lastSlash = partial.lastIndexOf('/');
            if (lastSlash !== -1) {
                const dirPart = lastSlash === 0 ? '/' : partial.substring(0, lastSlash);
                searchPrefix = partial.substring(lastSlash + 1);
                searchDir = resolvePath(dirPart);
            }
            const files = listDirectory(searchDir, activeTerminalUser);
            if (files) {
                files.forEach(f => {
                    if (f.name.startsWith(searchPrefix)) {
                        candidates.push(f.name + (f.type === 'directory' ? '/' : ''));
                    }
                });
            }
        }
        return Array.from(new Set(candidates)).sort();
    }, [activeTerminalUser, currentPath, listDirectory, resolvePath]);

    // Ghost Text Effect
    useEffect(() => {
        if (!input) {
            setGhostText('');
            return;
        }
        const parts = input.split(' ');
        const isCommand = parts.length === 1 && !input.endsWith(' ');
        const partial = isCommand ? parts[0] : parts[parts.length - 1];
        const candidates = getAutocompleteCandidates(partial, isCommand);
        if (candidates.length === 1 && candidates[0].startsWith(partial)) {
            setGhostText(candidates[0].substring(partial.length));
        } else {
            setGhostText('');
        }
    }, [input, currentPath, getAutocompleteCandidates]);

    const handleTabCompletion = (e: React.KeyboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (!input) return;
        const parts = input.split(' ');
        const isCommand = parts.length === 1 && !input.endsWith(' ');
        const partial = isCommand ? parts[0] : parts[parts.length - 1];
        const candidates = getAutocompleteCandidates(partial, isCommand);

        if (candidates.length === 0) return;

        if (candidates.length === 1) {
            const completion = candidates[0];
            let newInput = input;
            if (isCommand) {
                newInput = completion + ' ';
            } else {
                const lastSlash = partial.lastIndexOf('/');
                if (lastSlash !== -1) {
                    const dirPart = partial.substring(0, lastSlash + 1);
                    newInput = parts.join(' ').slice(0, -(partial.length)) + dirPart + completion;
                } else {
                    newInput = parts.join(' ').slice(0, -(partial.length)) + completion;
                }
            }
            setInput(newInput);
            setGhostText('');
        } else {
            setHistory(prev => [
                ...prev,
                {
                    command: input,
                    output: candidates,
                    error: false,
                    path: currentPath,
                    user: activeTerminalUser,
                    accentColor: termAccent
                }
            ]);
        }
    };

    const isCommandValid = (cmd: string): boolean => {
        if (commands[cmd]) return true;
        for (const dir of PATH) {
            const p = (dir === '/' ? '' : dir) + '/' + cmd;
            if (getNodeAtPath(p, activeTerminalUser)?.type === 'file') return true;
        }
        return false;
    };

    const executeCommand = async (cmdInput: string) => {
        const trimmed = cmdInput.trim();

        if (trimmed) {
            setCommandHistory(prev => [...prev, trimmed]);
        }

        if (!trimmed) {
            setHistory([...history, { command: '', output: [], path: currentPath }]);
            return;
        }

        const { command, args: rawArgs, redirectOp, redirectPath } = parseCommandInput(trimmed);
        const args: string[] = [];
        rawArgs.forEach(arg => {
            if (arg.includes('*')) {
                args.push(...expandGlob(arg));
            } else {
                args.push(arg);
            }
        });

        let output: (string | ReactNode)[] = [];
        let error = false;

        const generateOutput = async (): Promise<{ output: (string | ReactNode)[], error: boolean, shouldClear?: boolean }> => {
            let cmdOutput: (string | ReactNode)[] = [];
            let cmdError = false;
            let shouldClear = false;

            const createScopedFileSystem = (asUser: string) => ({
                currentUser, users, groups, homePath,
                resetFileSystem, login, logout,
                resolvePath: contextResolvePath,
                listDirectory: (p: string) => listDirectory(p, asUser),
                getNodeAtPath: (p: string) => getNodeAtPath(p, asUser),
                createFile: (p: string, n: string, c?: string) => createFile(p, n, c, asUser),
                createDirectory: (p: string, n: string) => createDirectory(p, n, asUser),
                moveToTrash: (p: string) => moveToTrash(p, asUser),
                readFile: (p: string) => readFile(p, asUser),
                moveNode: (from: string, to: string) => moveNode(from, to, asUser),
                writeFile: (p: string, c: string) => writeFile(p, c, asUser),
                chmod: (p: string, m: string) => chmod(p, m, asUser),
                chown: (p: string, o: string, g?: string) => chown(p, o, g, asUser),
                as: (user: string) => createScopedFileSystem(user)
            });

            const terminalCommand = getCommand(command);
            if (terminalCommand) {
                const result = await terminalCommand.execute({
                    args: args,
                    fileSystem: createScopedFileSystem(activeTerminalUser) as any,
                    currentPath: currentPath,
                    setCurrentPath: setCurrentPath,
                    resolvePath: resolvePath,
                    allCommands: getAllCommands(),
                    terminalUser: activeTerminalUser,
                    spawnSession: pushSession,
                    closeSession: closeSession
                });

                cmdOutput = result.output;
                cmdError = !!result.error;
                if (result.shouldClear) {
                    shouldClear = true;
                }
            } else {
                let foundPath: string | null = null;
                if (command.includes('/')) {
                    const resolved = resolvePath(command);
                    const node = getNodeAtPath(resolved);
                    if (node && node.type === 'file') foundPath = resolved;
                } else {
                    for (const dir of PATH) {
                        const checkPath = (dir === '/' ? '' : dir) + '/' + command;
                        const node = getNodeAtPath(checkPath);
                        if (node && node.type === 'file') {
                            foundPath = checkPath;
                            break;
                        }
                    }
                }

                if (foundPath) {
                    const content = readFile(foundPath);
                    if (content && content.startsWith('#!app ')) {
                        const appId = content.replace('#!app ', '').trim();
                        if (onLaunchApp) {
                            onLaunchApp(appId, args);
                            cmdOutput = [`Launched ${appId}`];
                        } else {
                            cmdOutput = [`Cannot launch ${appId}`];
                            cmdError = true;
                        }
                    } else {
                        cmdOutput = [`${command}: command not found (binary execution not fully simmed)`];
                        cmdError = true;
                    }
                } else {
                    cmdOutput = [`${command}: command not found`];
                    cmdError = true;
                }
            }

            return { output: cmdOutput, error: cmdError, shouldClear };
        };

        const result = await generateOutput();
        output = result.output;
        error = result.error;

        if (result.shouldClear) {
            setHistory([]);
            setInput('');
            setHistoryIndex(-1);
            return;
        }

        if (redirectOp && redirectPath) {
            const textContent = output.map(o => {
                if (typeof o === 'string') return o;
                if (typeof o === 'number') return String(o);
                return '';
            }).filter(s => s !== '').join('\n');

            if (redirectPath) {
                let finalContent = textContent;
                const appendMode = redirectOp === '>>';
                const absRedirectPath = resolvePath(redirectPath);
                const existingNode = getNodeAtPath(absRedirectPath);
                const parentPath = absRedirectPath.substring(0, absRedirectPath.lastIndexOf('/')) || '/';
                const fileName = absRedirectPath.substring(absRedirectPath.lastIndexOf('/') + 1);

                const parentNode = getNodeAtPath(parentPath);
                if (!parentNode || parentNode.type !== 'directory') {
                    output = [`zsh: no such file or directory: ${redirectPath}`];
                    error = true;
                } else {
                    if (appendMode && existingNode && existingNode.type === 'file' && existingNode.content !== undefined) {
                        finalContent = existingNode.content + '\n' + textContent;
                    }

                    if (existingNode) {
                        const success = writeFile(absRedirectPath, finalContent, activeTerminalUser);
                        if (!success) {
                            output = [`zsh: permission denied: ${redirectPath}`];
                            error = true;
                        }
                    } else {
                        const success = createFile(parentPath, fileName, finalContent, activeTerminalUser);
                        if (!success) {
                            output = [`zsh: permission denied: ${redirectPath}`];
                            error = true;
                        }
                    }
                    if (!error) output = [];
                }
            }
        }

        setHistory(prev => [
            ...prev,
            {
                command: input,
                output,
                error,
                path: currentPath,
                accentColor: termAccent,
                user: activeTerminalUser
            }
        ]);
        setInput('');
        setHistoryIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.ctrlKey) {
            switch (e.key) {
                case 'l':
                    e.preventDefault();
                    setHistory([]);
                    return;
                case 'c':
                    e.preventDefault();
                    setInput('');
                    setHistory(prev => [
                        ...prev,
                        {
                            command: input + '^C',
                            output: [],
                            error: false,
                            path: currentPath,
                            user: activeTerminalUser,
                            accentColor: termAccent
                        }
                    ]);
                    return;
                case 'u':
                    e.preventDefault();
                    setInput('');
                    return;
            }
        }

        if (e.key === 'Enter') {
            executeCommand(input);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex < commandHistory.length - 1) {
                const newIndex = historyIndex + 1;
                setHistoryIndex(newIndex);
                const cmd = commandHistory[commandHistory.length - 1 - newIndex];
                if (cmd) setInput(cmd);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                const cmd = commandHistory[commandHistory.length - 1 - newIndex];
                if (cmd) setInput(cmd);
            } else if (historyIndex === 0) {
                setHistoryIndex(-1);
                setInput('');
            }
        } else if (e.key === 'Tab') {
            handleTabCompletion(e);
        }
    };

    // Integrity Check Side Effect
    useEffect(() => {
        if (integrityCheckRun.current) return;
        const timer = setTimeout(() => {
            if (!validateIntegrity()) {
                integrityCheckRun.current = true;
                setHistory(prev => [
                    ...prev,
                    {
                        command: '',
                        output: [
                            <div className="text-red-500 font-bold bg-red-950/30 p-2 border border-red-500/50 rounded mb-2" >
                            CRITICAL ERROR: SYSTEM INTEGRITY COMPROMISED < br />
                            The system has detected unauthorized modifications to core identity files.< br />
                            Entering Safe Mode: Write access disabled.Root access disabled.
                            </div>
                        ],
                        path: currentPath || '~',
                        user: activeTerminalUser,
                        accentColor: '#ef4444'
                    }
                ]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [activeTerminalUser, currentPath]);

    return {
        input,
        setInput,
        history,
        activeTerminalUser,
        currentPath,
        ghostText,
        termAccent,
        shades,
        handleKeyDown,
        isCommandValid,
        homePath
    };
}
