import { TerminalCommand } from '../types';

export const rm: TerminalCommand = {
    name: 'rm',
    description: 'Remove file or directory',
    usage: 'rm <name>',
    execute: ({ args, fileSystem, resolvePath }) => {
        if (args.length === 0) {
            return { output: ['rm: missing operand'], error: true };
        }

        const output: string[] = [];
        let error = false;

        args.forEach(arg => {
            const targetPath = resolvePath(arg);
            const node = fileSystem.getNodeAtPath(targetPath);

            if (!node && !arg.includes('*')) {
                output.push(`rm: cannot remove '${arg}': No such file or directory`);
                error = true;
                return;
            }

            // Try to delete (move to trash)
            const success = fileSystem.moveToTrash(targetPath);
            if (!success && !arg.includes('*')) {
                output.push(`rm: cannot remove '${arg}': Permission denied`);
                error = true;
            }
        });

        return { output, error };
    },
};
