import { useState, useRef, useEffect } from 'react';
import { useFileSystem } from '../FileSystemContext';
import { useAppContext } from '../AppContext';
import { AppTemplate } from './AppTemplate';

interface CommandHistory {
  command: string;
  output: string[];
  error?: boolean;
}

export function Terminal() {
  const { accentColor } = useAppContext();
  const [history, setHistory] = useState<CommandHistory[]>([]);
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  const { currentPath, setCurrentPath, listDirectory, getNodeAtPath, createFile, createDirectory, deleteNode, readFile } = useFileSystem();

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  const resolvePath = (path: string): string => {
    if (path.startsWith('/')) return path;
    if (path === '~') return '/Users/guest';
    if (path.startsWith('~/')) return '/Users/guest' + path.slice(1);

    // Handle relative paths
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

  const executeCommand = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) {
      setHistory([...history, { command: '', output: [] }]);
      return;
    }

    const parts = trimmed.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    let output: string[] = [];
    let error = false;

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
          '  clear             - Clear terminal',
          '  help              - Show this help message',
          ''
        ];
        break;

      case 'ls': {
        const lsPath = args[0] ? resolvePath(args[0]) : currentPath;
        const contents = listDirectory(lsPath);
        if (contents) {
          output = contents.length > 0
            ? contents.map(node => {
              const icon = node.type === 'directory' ? '📁' : '📄';
              const name = node.type === 'directory' ? node.name + '/' : node.name;
              return `${icon} ${name}`;
            })
            : ['(empty directory)'];
        } else {
          output = [`ls: ${lsPath}: No such file or directory`];
          error = true;
        }
        break;
      }

      case 'cd': {
        if (args.length === 0) {
          setCurrentPath('/Users/guest');
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

      case 'cat': {
        if (args.length === 0) {
          output = ['cat: missing file operand'];
          error = true;
        } else {
          const filePath = resolvePath(args[0]);
          const content = readFile(filePath);
          if (content !== null) {
            output = content.split('\n');
          } else {
            output = [`cat: ${args[0]}: No such file or directory`];
            error = true;
          }
        }
        break;
      }

      case 'mkdir': {
        if (args.length === 0) {
          output = ['mkdir: missing operand'];
          error = true;
        } else {
          const success = createDirectory(currentPath, args[0]);
          if (success) {
            output = [];
          } else {
            output = [`mkdir: cannot create directory '${args[0]}'`];
            error = true;
          }
        }
        break;
      }

      case 'touch': {
        if (args.length === 0) {
          output = ['touch: missing file operand'];
          error = true;
        } else {
          const success = createFile(currentPath, args[0], '');
          if (success) {
            output = [];
          } else {
            output = [`touch: cannot create file '${args[0]}'`];
            error = true;
          }
        }
        break;
      }

      case 'rm': {
        if (args.length === 0) {
          output = ['rm: missing operand'];
          error = true;
        } else {
          const targetPath = resolvePath(args[0]);
          const success = deleteNode(targetPath);
          if (success) {
            output = [];
          } else {
            output = [`rm: cannot remove '${args[0]}': No such file or directory`];
            error = true;
          }
        }
        break;
      }

      case 'echo':
        output = [args.join(' ')];
        break;

      case 'clear':
        setHistory([{ command: '', output: [] }]);
        setInput('');
        return;

      default:
        output = [`${command}: command not found`];
        error = true;
    }

    setHistory([...history, { command: trimmed, output, error }]);
    setCommandHistory([...commandHistory, trimmed]);
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Basic tab completion could be added here
    }
  };

  const getPrompt = () => {
    const pathArray = currentPath.split('/');
    const shortPath = pathArray.length > 2
      ? pathArray[pathArray.length - 1]
      : pathArray.filter(p => p).join('/');

    return (
      <span>
        <span style={{ color: accentColor }}>guest</span>
        <span style={{ color: '#94a3b8' }}>@</span>
        <span style={{ color: accentColor }}>desktop</span>
        <span style={{ color: '#94a3b8' }}>:~/</span>
        <span style={{ color: '#60a5fa' }}>{shortPath}</span>
        <span style={{ color: accentColor }}>$</span>
      </span>
    );
  };

  const content = (
    <div
      className="h-full p-4 font-mono text-sm overflow-y-auto"
      ref={terminalRef}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="space-y-2">
        {history.map((entry, index) => (
          <div key={index}>
            {entry.command && (
              <div className="flex gap-2">
                <span className="text-green-400">{getPrompt()}</span>
                <span className="text-white">{entry.command}</span>
              </div>
            )}
            {entry.output.map((line, lineIndex) => (
              <div
                key={lineIndex}
                className={entry.error ? 'text-red-400' : 'text-white/80'}
              >
                {line}
              </div>
            ))}
          </div>
        ))}

        {/* Current Input Line */}
        <div className="flex gap-2">
          <span className="text-green-400">{getPrompt()}</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-white outline-none caret-white"
            autoFocus
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );

  return <AppTemplate content={content} hasSidebar={false} contentClassName="overflow-hidden" />;
}
