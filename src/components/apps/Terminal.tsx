import { useState, useRef, useEffect, ReactNode } from 'react';
import { useFileSystem } from '../FileSystemContext';
import { useAppContext } from '../AppContext';
import { AppTemplate } from './AppTemplate';
// FileIcon and checkPermissions removed as they are now used inside command modules
import { getCommand, commands, getAllCommands } from '../../utils/terminal/registry';

interface CommandHistory {
  command: string;
  output: (string | ReactNode)[];
  error?: boolean;
  path: string;
}

const PATH = ['/bin', '/usr/bin'];
// const BUILTINS = ['cd', 'export', 'alias']; // Replaced by registry

export interface TerminalProps {
  onLaunchApp?: (appId: string, args: string[]) => void;
}

export function Terminal({ onLaunchApp }: TerminalProps) {
  const { accentColor } = useAppContext();
  const [history, setHistory] = useState<CommandHistory[]>([]);
  const [input, setInput] = useState('');
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
    moveNode,
    logout,
    resetFileSystem,
    chmod,
    chown,
    writeFile
  } = useFileSystem();



  // Each Terminal instance has its own working directory (independent windows)
  const [currentPath, setCurrentPath] = useState(homePath);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  // Use context's resolvePath but with our local currentPath
  const resolvePath = (path: string): string => {
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
  };

  // Helper to expand globs like *.txt
  const expandGlob = (pattern: string): string[] => {
    // Simple implementation: only supports * in filename, not directory path yet
    // e.g. *.txt, data_*, *

    // If no wildcard, return as is
    if (!pattern.includes('*')) {
      return [pattern];
    }

    const resolvedPath = resolvePath(currentPath); // Resolve current dir to list files
    // If pattern contains /, strict it to that dir? 
    // For now, let's assume globbing is only in current directory for simplicity.

    if (pattern.includes('/')) {
      // TODO: Advanced path globbing
      return [pattern];
    }

    const files = listDirectory(resolvedPath);
    if (!files) return [pattern]; // Fail gracefully

    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');

    const matches = files
      .filter(f => regex.test(f.name))
      .map(f => f.name);

    return matches.length > 0 ? matches : [pattern]; // If no matches, return pattern (bash behavior)
  };

  const getAutocompleteCandidates = (partial: string, isCommand: boolean): string[] => {
    const candidates: string[] = [];

    if (isCommand) {
      // 1. Search Builtins (Registry)
      candidates.push(...Object.keys(commands).filter(c => c.startsWith(partial)));

      // 2. Search PATH
      for (const pathDir of PATH) {
        const files = listDirectory(pathDir);
        if (files) {
          files.forEach(f => {
            if (f.name.startsWith(partial) && f.type === 'file') {
              candidates.push(f.name);
            }
          });
        }
      }
    } else {
      // File path completion
      let searchDir = currentPath;
      let searchPrefix = partial;

      const lastSlash = partial.lastIndexOf('/');
      if (lastSlash !== -1) {
        const dirPart = partial.substring(0, lastSlash);
        searchPrefix = partial.substring(lastSlash + 1);
        searchDir = resolvePath(dirPart);
      }

      const files = listDirectory(searchDir);
      if (files) {
        files.forEach(f => {
          if (f.name.startsWith(searchPrefix)) {
            const suffix = f.type === 'directory' ? '/' : '';
            candidates.push(f.name + suffix);
          }
        });
      }
    }

    return Array.from(new Set(candidates)).sort();
  };

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
          const completedArg = dirPart + completion;
          parts[parts.length - 1] = completedArg;
          newInput = parts.join(' ');
        } else {
          parts[parts.length - 1] = completion;
          newInput = parts.join(' ');
        }
      }

      setInput(newInput);
    } else {
      setHistory(prev => [
        ...prev,
        { command: input, output: candidates, error: false, path: currentPath }
      ]);
    }
  };

  const executeCommand = async (cmdInput: string) => {
    const trimmed = cmdInput.trim();
    if (!trimmed) {
      setHistory([...history, { command: '', output: [], path: currentPath }]);
      return;
    }

    // Handle Output Redirection (> and >>)
    let commandStr = trimmed;
    let redirectPath: string | null = null;
    let appendMode = false;

    if (commandStr.includes('>>')) {
      const parts = commandStr.split('>>');
      commandStr = parts[0].trim();
      redirectPath = parts[1]?.trim();
      appendMode = true;
    } else if (commandStr.includes('>')) {
      const parts = commandStr.split('>');
      commandStr = parts[0].trim();
      redirectPath = parts[1]?.trim();
      appendMode = false;
    }

    // Split logic that respects quotes? For now simple split
    const parts = commandStr.split(/\s+/);
    const command = parts[0];
    const rawArgs = parts.slice(1);

    // Expand globs in args
    const args: string[] = [];
    rawArgs.forEach(arg => {
      args.push(...expandGlob(arg));
    });

    let output: (string | ReactNode)[] = [];
    let error = false;

    // Helper to capture output for redirection
    // We'll wrap the switch processing to capture output
    const generateOutput = async (): Promise<{ output: (string | ReactNode)[], error: boolean }> => {
      let cmdOutput: (string | ReactNode)[] = [];
      let cmdError = false;

      // 1. Check Registry for Modular Commands
      const terminalCommand = getCommand(command);
      if (terminalCommand) {
        const result = await terminalCommand.execute({
          args: args,
          fileSystem: {
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
            moveNode,
            logout,
            resetFileSystem,
            chmod,
            chown,
            writeFile
          } as any,
          currentPath: currentPath,
          setCurrentPath: setCurrentPath,
          resolvePath: resolvePath,
          allCommands: getAllCommands()
        });

        cmdOutput = result.output;
        cmdError = !!result.error;
        if (result.shouldClear) {
          setHistory([{ command: '', output: [], path: currentPath }]);
          // Logic to just clear without adding history? 
          return { output: [], error: false };
        }

      } else {
        // ... Fallback to PATH / Apps logic ... 
        let foundPath: string | null = null;
        const cmd = command;

        if (cmd.includes('/')) {
          const resolved = resolvePath(cmd);
          const node = getNodeAtPath(resolved);
          if (node && node.type === 'file') foundPath = resolved;
        } else {
          for (const dir of PATH) {
            const checkPath = (dir === '/' ? '' : dir) + '/' + cmd;
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
            // App launch logic
            const appId = content.slice(6).trim();
            const resolvedAppArgs = args.map(arg => !arg.startsWith('-') ? resolvePath(arg) : arg);
            onLaunchApp?.(appId, resolvedAppArgs);
            cmdOutput = [];
          } else if (content && content.startsWith('#!')) {
            cmdOutput = [`${cmd}: script execution not fully supported`];
          } else {
            cmdOutput = [`${cmd}: binary file`];
          }
        } else {
          cmdOutput = [`${cmd}: command not found`];
          cmdError = true;
        }
      }

      return { output: cmdOutput, error: cmdError };
    };

    // Special case handling for clear 
    if (command === 'clear') {
      // if clear is handled in generateOutput via registry, we might duplicate. 
      // but registry 'clear' returns valid result. 
      // If we want immediate clear:
      setHistory([{ command: '', output: [], path: currentPath }]);
      setInput('');
      return;
    }

    try {
      const result = await generateOutput();
      output = result.output;
      error = result.error;
    } catch {
      output = [`Error executing command`];
      error = true;
    }

    // Handle Redirection Persistence
    if (redirectPath && !error) {
      const fullRedirectPath = resolvePath(redirectPath);
      const lastSlashIndex = fullRedirectPath.lastIndexOf('/');
      const parentPath = lastSlashIndex === 0 ? '/' : fullRedirectPath.substring(0, lastSlashIndex);
      const fileName = fullRedirectPath.substring(lastSlashIndex + 1);

      // Flatten output to string
      const contentToWrite = output.map(o => {
        if (typeof o === 'string') return o;
        return ''; // React nodes can't be written to file easily
      }).join('\n');

      let success = false;

      // Use writeFile to respect permissions if file exists
      const existingNode = getNodeAtPath(fullRedirectPath);

      if (appendMode && existingNode) {
        const existing = readFile(fullRedirectPath) || '';
        success = writeFile(fullRedirectPath, existing + '\n' + contentToWrite);
      } else if (existingNode) {
        success = writeFile(fullRedirectPath, contentToWrite);
      } else {
        // create new
        success = createFile(parentPath, fileName, contentToWrite);
      }

      if (!success) {
        output = [`${command}: error writing to '${redirectPath}': Permission denied`];
        error = true;
      } else {
        output = []; // Output redirected, nothing to show
      }
    }

    setHistory(prev => [...prev, { command: trimmed, output, error, path: currentPath }]);
    setCommandHistory(prev => {
      if (prev.length > 0 && prev[prev.length - 1] === trimmed) return prev;
      return [...prev, trimmed];
    });
    setHistoryIndex(-1);
    // setIsProcessing(false); // Assuming setIsProcessing is defined
  };

  const ghostText = (() => {
    if (!input) return '';
    // Find the most recent command that starts with current input
    for (let i = commandHistory.length - 1; i >= 0; i--) {
      if (commandHistory[i].startsWith(input)) {
        return commandHistory[i].slice(input.length);
      }
    }
    return '';
  })();

  const isCommandValid = (cmd: string): boolean => {
    if (!cmd) return false;
    if (getCommand(cmd)) return true;

    // Check absolute/relative path
    if (cmd.includes('/')) {
      const node = getNodeAtPath(resolvePath(cmd));
      return node?.type === 'file';
    }

    // Check PATH
    for (const dir of PATH) {
      const checkPath = (dir === '/' ? '' : dir) + '/' + cmd;
      const node = getNodeAtPath(checkPath);
      if (node?.type === 'file') return true;
    }
    return false;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Shortcuts
    if (e.ctrlKey) {
      if (e.key === 'l') {
        e.preventDefault();
        setHistory([{ command: '', output: [], path: currentPath }]);
        return;
      }
      if (e.key === 'c') {
        e.preventDefault();
        // "Cancel" command
        setHistory(prev => [...prev, { command: input + '^C', output: [], path: currentPath }]);
        setInput('');
        return;
      }
      if (e.key === 'u') {
        e.preventDefault();
        setInput('');
        return;
      }
    }

    if (e.key === 'Tab') {
      handleTabCompletion(e);
      return;
    }

    if (e.key === 'ArrowRight' && ghostText) {
      e.preventDefault();
      setInput(input + ghostText);
      return;
    }

    if (e.key === 'Enter') {
      executeCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIndex);
          setInput(commandHistory[newIndex]);
        }
      }
    }
  };

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
        <span style={{ color: accentColor }}>{currentUser}</span>
        <span style={{ color: '#94a3b8' }}>@</span>
        <span style={{ color: accentColor }}>aurora</span>
        <span style={{ color: '#94a3b8' }}>:</span>
        <span style={{ color: '#60a5fa' }}>{displayPath}</span>
        <span style={{ color: accentColor }}>{currentUser === 'root' ? '#' : '$'}</span>
      </span>
    );
  };

  // Parsing input for syntax highlighting
  const renderInputOverlay = () => {
    const fullText = input;
    const firstSpaceIndex = fullText.indexOf(' ');
    const commandPart = firstSpaceIndex === -1 ? fullText : fullText.substring(0, firstSpaceIndex);
    const restPart = firstSpaceIndex === -1 ? '' : fullText.substring(firstSpaceIndex);

    const isValid = isCommandValid(commandPart);

    return (
      <span className="pointer-events-none whitespace-pre relative z-10">
        <span style={{ color: isValid ? accentColor : '#ef4444' }}>{commandPart}</span>
        <span className="text-white">{restPart}</span>
        <span className="text-white/40">{ghostText}</span>
      </span>
    );
  };

  const content = (
    <div
      className="h-full p-4 font-mono text-sm overflow-y-auto"
      ref={terminalRef}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="space-y-1">
        {history.map((entry, index) => (
          <div key={index}>
            {entry.command && (
              <div className="flex flex-wrap">
                {getPrompt(entry.path)}
                <span className="text-white whitespace-pre-wrap break-all">{entry.command}</span>
              </div>
            )}
            <div className="pl-0">
              {entry.output.map((line, lineIndex) => (
                <div
                  key={lineIndex}
                  className={entry.error ? 'text-red-400' : 'text-white/80'}
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
            {/* Overlay Layer for Syntax Highlighting */}
            <div className="absolute inset-0 top-0 left-0 pointer-events-none select-none whitespace-pre break-all">
              {renderInputOverlay()}
            </div>

            {/* Interaction Layer */}
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
    </div>
  );

  return <AppTemplate content={content} hasSidebar={false} contentClassName="overflow-hidden bg-[#1e1e1e]/90" />;
}
