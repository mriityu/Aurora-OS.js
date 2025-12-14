import { TerminalCommand } from '../types';

export const touch: TerminalCommand = {
    name: 'touch',
    description: 'Create file',
    usage: 'touch <name>',
    execute: ({ args, fileSystem, resolvePath }) => {
        if (args.length === 0) {
            return { output: ['touch: missing file operand'], error: true };
        }

        const output: string[] = [];
        let error = false;

        args.forEach(arg => {
            const fullPath = resolvePath(arg);
            const lastSlashIndex = fullPath.lastIndexOf('/');
            const parentPath = lastSlashIndex === 0 ? '/' : fullPath.substring(0, lastSlashIndex);
            const name = fullPath.substring(lastSlashIndex + 1);

            const success = fileSystem.createFile(parentPath, name, '');
            if (!success) {
                output.push(`touch: cannot create file '${arg}'`);
                error = true;
            }
        });

        return { output, error };
    },
};
