import { TerminalCommand } from '../types';

export const grep: TerminalCommand = {
    name: 'grep',
    description: 'Print lines matching a pattern',
    usage: 'grep <pattern> <file>',
    execute: ({ args, fileSystem: { readFile }, resolvePath }) => {
        if (args.length < 2) {
            return { output: ['grep: missing pattern or file operand'], error: true };
        }

        const pattern = args[0];
        const filePath = resolvePath(args[1]);

        const content = readFile(filePath);

        if (content === null) {
            return { output: [`grep: ${args[1]}: No such file or directory`], error: true };
        }

        try {
            const regex = new RegExp(pattern);
            const lines = content.split('\n');
            const matches = lines.filter(line => regex.test(line));
            return { output: matches };
        } catch {
            return { output: [`grep: invalid pattern '${pattern}'`], error: true };
        }
    },
};
