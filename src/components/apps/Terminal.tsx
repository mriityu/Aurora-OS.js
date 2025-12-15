import { useState, useRef, useEffect, ReactNode, useCallback } from 'react';
import { validateIntegrity } from '../../utils/integrity';
import { useFileSystem } from '../FileSystemContext';
import { useAppContext } from '../AppContext';
import { AppTemplate } from './AppTemplate';
import { getCommand, commands, getAllCommands } from '../../utils/terminal/registry';
import pkg from '../../../package.json';
import { getColorShades } from '../../utils/colors';

interface CommandHistory {
  command: string;
  output: (string | ReactNode)[];
  error?: boolean;
  path: string;
  accentColor?: string;
  user?: string;
}

// Helper to safely parse command input respecting quotes
// Returns [command, args[], redirectOp, redirectPath]
const parseCommandInput = (input: string): { command: string; args: string[]; redirectOp: string | null; redirectPath: string | null } => {
  // Regex to match tokens: quotes, redirection ops, or regular words
  // matches: "string", 'string', >>, >, word
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

const PATH = ['/bin', '/usr/bin'];
// const BUILTINS = ['cd', 'export', 'alias']; // Replaced by registry

export interface TerminalProps {
  onLaunchApp?: (appId: string, args: string[]) => void;
}

export function Terminal({ onLaunchApp }: TerminalProps) {
  const { accentColor } = useAppContext();
  const [history, setHistory] = useState<CommandHistory[]>([]);
  const [input, setInput] = useState('');
  // Persistent command history (independent of visual history clearing)
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

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

  const [ghostText, setGhostText] = useState('');

  // Session Stack for su/sudo (independent of global desktop session)
  // Stack of usernames. Top is current.
  const [sessionStack, setSessionStack] = useState<string[]>([]);

  // Initialize session with current global user
  useEffect(() => {
    if (sessionStack.length === 0 && currentUser) {
      setSessionStack([currentUser]);
    }
  }, [currentUser, sessionStack.length]);

  const activeTerminalUser = sessionStack.length > 0 ? sessionStack[sessionStack.length - 1] : (currentUser || 'guest');

  const pushSession = (username: string) => {
    setSessionStack(prev => [...prev, username]);
  };

  const closeSession = () => {
    setSessionStack(prev => {
      if (prev.length > 1) return prev.slice(0, -1);
      return prev;
    });
  };

  // Each Terminal instance has its own working directory (independent windows)
  const [currentPath, setCurrentPath] = useState(homePath);

  // Smart Scroll: Only scroll if user was already at bottom or it's a new command
  useEffect(() => {
    if (terminalRef.current) {
      // Simple heuristic: Always scroll for now to ensure visibility of new commands.
      // Real smart scroll requires tracking "wasAtBottom" before render.
      // For this improvement, let's stick to auto-scroll but maybe smooth?
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  // Use context's resolvePath but with our local currentPath
  const resolvePath = useCallback((path: string): string => {
    if (path.startsWith('/')) return contextResolvePath(path);
    if (path === '~') return homePath;
    if (path.startsWith('~/')) return homePath + path.slice(1);

    // Handle relative paths from our local currentPath
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

  // Helper to expand globs like *.txt
  const expandGlob = (pattern: string): string[] => {
    if (!pattern.includes('*')) {
      return [pattern];
    }
    const resolvedPath = resolvePath(currentPath);
    if (pattern.includes('/')) {
      return [pattern];
    }
    const files = listDirectory(resolvedPath, activeTerminalUser);
    if (!files) return [pattern]; // Fail gracefully

    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
    const matches = files
      .filter(f => regex.test(f.name))
      .map(f => f.name);

    return matches.length > 0 ? matches : [pattern];
  };

  const getAutocompleteCandidates = useCallback((partial: string, isCommand: boolean): string[] => {
    const candidates: string[] = [];
    if (isCommand) {
      candidates.push(...Object.values(commands) // Use values to check hidden status
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
        // Fix joining logic if needed
        // lines 190-191 were destructive causing the bug, relying on lines 179-188 logic which is correct
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

  // Ghost text (simple prediction)
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
  }, [input, currentPath, getAutocompleteCandidates]); // Dep on currentPath for file search


  const isCommandValid = (cmd: string): boolean => {
    if (commands[cmd]) return true;
    // Check PATH
    for (const dir of PATH) {
      const p = (dir === '/' ? '' : dir) + '/' + cmd;
      if (getNodeAtPath(p, activeTerminalUser)?.type === 'file') return true;
    }
    return false;
  };

  const executeCommand = async (cmdInput: string) => {
    const trimmed = cmdInput.trim();

    // Add to persistent command history if not empty
    if (trimmed) {
      setCommandHistory(prev => [...prev, trimmed]);
    }

    if (!trimmed) {
      setHistory([...history, { command: '', output: [], path: currentPath }]);
      return;
    }

    // Parse command using robust parser
    const { command, args: rawArgs, redirectOp, redirectPath } = parseCommandInput(trimmed);

    // Expand globs in args
    const args: string[] = [];
    rawArgs.forEach(arg => {
      // Don't expand if it was quoted (how to detect? parseCommandInput strips quotes...)
      // For now, expand simple globs. Ideally parser should flag quotes.
      // Simplification: just expand everything for now, or check for *
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

      // Helper to create a filesystem proxy that acts as a specific user
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

        // Try command as path
        if (command.includes('/')) {
          const resolved = resolvePath(command);
          const node = getNodeAtPath(resolved);
          if (node && node.type === 'file') foundPath = resolved;
        } else {
          // search PATH
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
            // Binary execution simulation not implemented fully
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

    // If clear was requested, reset history and DO NOT append this command to history
    if (result.shouldClear) {
      setHistory([]);
      setInput('');
      setHistoryIndex(-1);
      return;
    }

    if (redirectOp && redirectPath) {
      // Safely extract text content from output (ignore ReactNodes to prevent [object Object])
      const textContent = output
        .map(o => {
          if (typeof o === 'string') return o;
          if (typeof o === 'number') return String(o);
          return ''; // Skip ReactNodes/Objects for file writing
        })
        .filter(s => s !== '')
        .join('\n');

      if (redirectPath) {
        let finalContent = textContent;
        const appendMode = redirectOp === '>>';

        // Resolve redirect path
        const absRedirectPath = resolvePath(redirectPath);
        const existingNode = getNodeAtPath(absRedirectPath);
        const parentPath = absRedirectPath.substring(0, absRedirectPath.lastIndexOf('/')) || '/';
        const fileName = absRedirectPath.substring(absRedirectPath.lastIndexOf('/') + 1);

        // Check parent existence
        const parentNode = getNodeAtPath(parentPath);
        if (!parentNode || parentNode.type !== 'directory') {
          output = [`zsh: no such file or directory: ${redirectPath}`];
          error = true;
        } else {
          // Simple write logic
          // If append, read first
          if (appendMode && existingNode && existingNode.type === 'file' && existingNode.content !== undefined) {
            finalContent = existingNode.content + '\n' + textContent;
          }

          if (existingNode) {
            // File exists, update it
            const success = writeFile(absRedirectPath, finalContent, activeTerminalUser);
            if (!success) {
              output = [`zsh: permission denied: ${redirectPath}`];
              error = true;
            }
          } else {
            // File does not exist, create it
            const success = createFile(parentPath, fileName, finalContent, activeTerminalUser);
            if (!success) {
              output = [`zsh: permission denied: ${redirectPath}`];
              error = true;
            }
          }

          if (!error) output = []; // Silence output on successful redirect
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
        accentColor: termAccent, // Save current accent
        user: activeTerminalUser // Save current user
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
      // Navigate persistent command history
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        // Optimized: direct index access from end
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

  // Determine accent color based on active terminal user
  const getTerminalAccentColor = () => {
    if (activeTerminalUser === 'root') return '#ef4444'; // Red for root
    if (activeTerminalUser === currentUser) return accentColor; // Global accent for current logged in user
    return '#a855f7'; // Purple for other users (e.g. su otheruser)
  };

  const termAccent = getTerminalAccentColor();
  const shades = getColorShades(termAccent);

  const getPrompt = (path: string = currentPath) => {
    let displayPath: string;
    if (path === homePath) {
      displayPath = '~';
    } else if (path.startsWith(homePath + '/')) {
      displayPath = '~' + path.slice(homePath.length);
    } else {
      displayPath = path;
    }

    return (
      <span className="whitespace-nowrap mr-2">
        <span style={{ color: termAccent }}>{activeTerminalUser}</span>
        <span style={{ color: '#94a3b8' }}>@</span>
        <span style={{ color: termAccent }}>aurora</span>
        <span style={{ color: '#94a3b8' }}>:</span>
        <span style={{ color: '#60a5fa' }}>{displayPath}</span>
        <span style={{ color: termAccent }}>{activeTerminalUser === 'root' ? '#' : '$'}</span>
      </span>
    );
  };

  const renderInputOverlay = () => {
    // Advanced Syntax Highlighting
    // Reuse parser regex manually or just split for simple highlighting
    // We want to highlight:
    // - Command (First word): Accent Base
    // - Flags (-f, --foo): Accent Light
    // - Strings ("foo"): Accent Lightest (High visibility)
    // - Operators (>, >>, |): Complementary or White? Let's use shades.darkest or just white.

    const tokens: ReactNode[] = [];
    const regex = /("([^"]*)")|('([^']*)')|(\s+)|([^\s"']+)/g;
    let match;
    let index = 0;

    // Naive recreation of input for coloring.
    // We strictly follow the input string to maintain spacing.
    // Since regex doesn't capture "everything", we might miss chars if regex is bad.
    // Safer approach: use the simple split logic I used before but refine it? 
    // Or just iterate standard split?
    // Let's stick to the previous simple logic BUT colored better.
    // Actually, to correctly highlight strings including spaces inside them, we MUST use regex match.
    // The previous regex `regex` in parseCommandInput works well.
    // Let's copy it but slightly adapted to catch whitespace too?
    // /("([^"]*)")|('([^']*)')|(\s+)|([^\s"']+)/g  <-- this catches whitespace group

    // We iterate the input string.

    // We need to know which token is the command (first non-whitespace).
    let isCommandPosition = true;

    while ((match = regex.exec(input)) !== null) {
      const fullMatch = match[0];

      const isString = match[1] !== undefined || match[3] !== undefined; // "..." or '...'
      const isWhitespace = match[5] !== undefined;
      const isWord = match[6] !== undefined;

      let color = 'white';

      if (isWhitespace) {
        // preserve whitespace
        tokens.push(<span key={index++} className="whitespace-pre">{fullMatch}</span>);
        continue; // don't change isCommandPosition
      }

      if (isCommandPosition && isWord) {
        // First word -> Command -> Base Accent
        // Valid command? 
        const isValid = isCommandValid(fullMatch);
        color = isValid ? shades.base : '#ef4444'; // Red if invalid
        isCommandPosition = false;
      } else if (isString) {
        // String -> Lightest Accent
        color = shades.lightest;
      } else if (fullMatch.startsWith('-')) {
        // Flag -> Light Accent
        color = shades.light;
      } else if (['>', '>>', '|', '&&', ';'].includes(fullMatch)) {
        // Operator -> Darkest Accent (maybe too dark? Try white or a distinct color)
        // Let's try secondary accent? For now, 'white' or shades.light
        // shades.light is good for "special" chars.
        color = shades.light;
        // Reset command position after pipe/and/semicolon
        if (['|', '&&', ';'].includes(fullMatch)) isCommandPosition = true;
      } else {
        // Argument -> White/Default
        color = 'white';
      }

      tokens.push(
        <span key={index++} style={{ color }}>{fullMatch}</span>
      );
    }

    return (
      <span className="pointer-events-none whitespace-pre relative z-10 break-all">
        {tokens}
        <span className="text-white/40">{ghostText}</span>
      </span>
    );
  };

  // Integrity Check Effect
  const integrityCheckRun = useRef(false);
  useEffect(() => {
    if (integrityCheckRun.current) return;

    // Small delay to ensure it appears after possible initial renders
    const timer = setTimeout(() => {
      if (!validateIntegrity()) {
        integrityCheckRun.current = true; // Mark as run to prevent spam
        setHistory(prev => [
          ...prev,
          {
            command: '',
            output: [
              <div className="text-red-500 font-bold bg-red-950/30 p-2 border border-red-500/50 rounded mb-2">
                CRITICAL ERROR: SYSTEM INTEGRITY COMPROMISED<br />
                The system has detected unauthorized modifications to core identity files.<br />
                Entering Safe Mode: Write access disabled. Root access disabled.
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

  const content = (
    <div
      className="flex-1 overflow-y-auto p-2 font-mono text-sm space-y-1 scrollbar-hide"
      ref={terminalRef}
      onClick={() => {
        const selection = window.getSelection();
        if (!selection || selection.toString().length === 0) {
          inputRef.current?.focus();
        }
      }}
    >
      <div className="text-gray-400 mb-2">{pkg.build.productName} terminal [v{pkg.version}]</div>

      {/* Initial welcome message moved to useEffect */}


      {history.map((item, i) => (
        <div key={i} className="mb-2">
          <div className="flex items-center gap-2" style={{ color: item.accentColor || '#4ade80' }}>
            <span>{item.user || activeTerminalUser}@{`aurora:${item.path.replace(homePath, '~')}${(item.user || activeTerminalUser) === 'root' ? '#' : '$'}`}</span>
            <span className="text-gray-100">{item.command}</span>
          </div>
          <div className="pl-0">
            {item.output.map((line, lineIndex) => (
              <div
                key={lineIndex}
                className={item.error ? 'text-red-400' : 'text-white/80'}
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex relative">
        {getPrompt()}

        <div className="relative flex-1 group">
          <div className="absolute inset-0 top-0 left-0 pointer-events-none select-none whitespace-pre break-all">
            {renderInputOverlay()}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent outline-none text-transparent caret-white relative z-20 break-all"
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );

  return <AppTemplate content={content} hasSidebar={false} contentClassName="overflow-hidden bg-[#1e1e1e]/90" />;
}
