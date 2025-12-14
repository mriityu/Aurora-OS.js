import { TerminalCommand } from '../types';

export const chmod: TerminalCommand = {
    name: 'chmod',
    description: 'Change file modes (permissions)',
    usage: 'chmod <mode> <file>',
    execute: ({ args, fileSystem: { chmod }, resolvePath }) => {
        if (args.length < 2) {
            return { output: ['chmod: missing operand'], error: true };
        }

        const mode = args[0];
        const file = resolvePath(args[1]); // Resolve relative to terminal cwd

        const success = chmod(file, mode);

        if (!success) {
            return { output: [`chmod: changing permissions of '${file}': Operation not permitted or file not found`], error: true };
        }

        return { output: [] };
    },
};
