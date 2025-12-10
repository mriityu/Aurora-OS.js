import { useState, useRef, useEffect, ReactNode } from 'react';
import { useFileSystem } from '../FileSystemContext';
import { useAppContext } from '../AppContext';
import { AppTemplate } from './AppTemplate';
import { FileIcon } from '../ui/FileIcon';

interface CommandHistory {
  command: string;
  output: (string | ReactNode)[];
  error?: boolean;
  path: string;
}

const PATH = ['/bin', '/usr/bin'];
const BUILTINS = ['cd', 'export', 'alias'];

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
    currentUser
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
      // 1. Search Builtins
      candidates.push(...BUILTINS.filter(c => c.startsWith(partial)));

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

  const executeCommand = (cmdInput: string) => {
    const trimmed = cmdInput.trim();
    if (!trimmed) {
      setHistory([...history, { command: '', output: [], path: currentPath }]);
      return;
    }

    // Split logic that respects quotes? For now simple split
    const parts = trimmed.split(/\s+/);
    const command = parts[0];
    const rawArgs = parts.slice(1);

    // Expand globs in args
    const args: string[] = [];
    rawArgs.forEach(arg => {
      args.push(...expandGlob(arg));
    });

    let output: (string | ReactNode)[] = [];
    let error = false;

    // 1. Check Built-ins
    switch (command) {
      case 'help':
        output = [
          'Available commands:',
          '  ls [path]         - List directory contents',
          '  cd <path>         - Change directory',
          '  pwd               - Print working directory',
          '  cat <file>        - Display file contents',
          '  mkdir <name>      - Create directory',
          '  touch <name>      - Create file',
          '  rm <name>         - Remove file or directory',
          '  echo <text>       - Display text',
          '  whoami            - Print current user',
          '  hostname          - Print system hostname',
          '  clear             - Clear terminal',
          '  help              - Show this help message',
          '  [app]             - Launch installed applications (e.g. Finder)',
          ''
        ];
        break;

      case 'ls': {
        const pathsToList = args.length > 0 ? args.filter(a => !a.startsWith('-')) : ['']; // Default to current
        // Handle flags
        const longFormat = args.includes('-l') || args.includes('-la') || args.includes('-al') || args.includes('-ll');

        // Loop through all paths
        const allOutputs: (string | ReactNode)[] = [];

        let hasErrors = false;

        pathsToList.forEach((pathArg, idx) => {
          const lsPath = pathArg ? resolvePath(pathArg) : currentPath;

          // If listing multiple directories, show headers
          if (pathsToList.length > 1) {
            if (idx > 0) allOutputs.push(''); // Spacer
            allOutputs.push(`${pathArg || '.'}:`);
          }

          const contents = listDirectory(lsPath);
          if (contents) {
            const filteredContents = contents;
            // We show all by default

            if (filteredContents.length === 0) {
              // empty
            } else if (longFormat) {
              const lines = filteredContents.map(node => {
                const perms = node.permissions || (node.type === 'directory' ? 'drwxr-xr-x' : '-rw-r--r--');
                const owner = node.owner || currentUser;
                const size = node.size?.toString().padStart(6) || '     0';
                const name = node.type === 'directory' ? `\x1b[34m${node.name}\x1b[0m` : node.name;
                return `${perms}  ${owner}  ${size}  ${name}`;
              });
              allOutputs.push(...lines);
            } else {
              const grid = (
                <div key={lsPath} className="flex flex-wrap gap-x-4 gap-y-1">
                  {filteredContents.map(node => (
                    <div key={node.id} className="flex items-center gap-2">
                      <div className="w-4 h-4 shrink-0 inline-flex items-center justify-center">
                        <FileIcon
                          name={node.name}
                          type={node.type}
                          accentColor={accentColor}
                          isEmpty={node.children?.length === 0}
                        />
                      </div>
                      <span className={node.type === 'directory' ? 'font-bold' : ''}>
                        {node.name}
                      </span>
                    </div>
                  ))}
                </div>
              );
              allOutputs.push(grid);
            }
          } else {
            allOutputs.push(`ls: ${pathArg}: No such file or directory`);
            hasErrors = true;
          }
        });

        output = allOutputs;
        if (hasErrors && pathsToList.length === 1) error = true; // Only flag error if single command failed
        break;
      }

      case 'cd': {
        if (args.length === 0 || args[0] === '~') {
          setCurrentPath(homePath);
          output = [];
        } else {
          const newPath = resolvePath(args[0]);
          const node = getNodeAtPath(newPath);
          if (node && node.type === 'directory') {
            setCurrentPath(newPath);
            output = [];
          } else {
            output = [`cd: ${args[0]}: No such directory`];
            error = true;
          }
        }
        break;
      }

      case 'pwd':
        output = [currentPath];
        break;

      case 'whoami':
        output = [currentUser];
        break;

      case 'hostname':
        output = ['aurora'];
        break;

      case 'cat': {
        if (args.length === 0) {
          output = ['cat: missing file operand'];
          error = true;
        } else {
          const catOutputs: string[] = [];
          args.forEach(arg => {
            const filePath = resolvePath(arg);
            const content = readFile(filePath);
            if (content !== null) {
              catOutputs.push(...content.split('\n'));
            } else {
              catOutputs.push(`cat: ${arg}: No such file or directory`);
              error = true; // warning?
            }
          });
          output = catOutputs;
        }
        break;
      }

      case 'mkdir': {
        if (args.length === 0) {
          output = ['mkdir: missing operand'];
          error = true;
        } else {
          // Allow multiple
          args.forEach(arg => {
            const fullPath = resolvePath(arg);
            const lastSlashIndex = fullPath.lastIndexOf('/');
            const parentPath = lastSlashIndex === 0 ? '/' : fullPath.substring(0, lastSlashIndex);
            const name = fullPath.substring(lastSlashIndex + 1);

            const success = createDirectory(parentPath, name);
            if (!success) {
              output.push(`mkdir: cannot create directory '${arg}'`);
              error = true;
            }
          });
        }
        break;
      }

      case 'touch': {
        if (args.length === 0) {
          output = ['touch: missing file operand'];
          error = true;
        } else {
          args.forEach(arg => {
            const fullPath = resolvePath(arg);
            const lastSlashIndex = fullPath.lastIndexOf('/');
            const parentPath = lastSlashIndex === 0 ? '/' : fullPath.substring(0, lastSlashIndex);
            const name = fullPath.substring(lastSlashIndex + 1);

            const success = createFile(parentPath, name, '');
            if (!success) {
              output.push(`touch: cannot create file '${arg}'`);
              error = true;
            }
          });
        }
        break;
      }

      case 'rm': {
        if (args.length === 0) {
          output = ['rm: missing operand'];
          error = true;
        } else {
          args.forEach(arg => {
            const targetPath = resolvePath(arg);
            // Check if recursive flag is present? (simplified rm)
            // For now, always try moveToTrash which handles file/dir
            const success = moveToTrash(targetPath);
            if (!success && !arg.includes('*')) {
              output.push(`rm: cannot remove '${arg}': No such file or directory`);
              error = true;
            }
          });
        }
        break;
      }

      case 'echo':
        output = [args.join(' ')];
        break;

      case 'clear':
        setHistory([{ command: '', output: [], path: currentPath }]);
        setInput('');
        return;

      default: {
        // Check PATH for executable
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
            const appId = content.slice(6).trim();

            // Resolve args for app
            const resolvedAppArgs = args.map(arg => {
              if (!arg.startsWith('-')) {
                return resolvePath(arg);
              }
              return arg;
            });

            onLaunchApp?.(appId, resolvedAppArgs);
            output = [];
          } else if (content && content.startsWith('#!')) {
            output = [`${cmd}: script execution not fully supported`];
          } else {
            output = [`${cmd}: binary file`];
          }
        } else {
          output = [`${cmd}: command not found`];
          error = true;
        }
      }
    }

    setHistory(prev => [...prev, { command: trimmed, output, error, path: currentPath }]);
    setCommandHistory(prev => {
      // Don't add duplicates consecutively
      if (prev.length > 0 && prev[prev.length - 1] === trimmed) return prev;
      return [...prev, trimmed];
    });
    setHistoryIndex(-1);
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
    if (BUILTINS.includes(cmd)) return true;

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
