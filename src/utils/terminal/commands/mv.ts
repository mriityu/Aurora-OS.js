import { TerminalCommand } from '../types';

export const mv: TerminalCommand = {
    name: 'mv',
    description: 'Move (rename) files',
    usage: 'mv <source> <dest>',
    execute: ({ args, fileSystem: { moveNode }, resolvePath }) => {
        if (args.length < 2) {
            return { output: ['mv: missing file operand'], error: true };
        }

        const source = resolvePath(args[0]);
        const dest = resolvePath(args[1]);

        const success = moveNode(source, dest);

        if (!success) {
            return {
                output: [`mv: cannot move '${args[0]}' to '${args[1]}': Permission denied or invalid path`],
                error: true
            };
        }

        return { output: [] };
    },
};
