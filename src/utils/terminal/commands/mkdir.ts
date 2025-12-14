import { TerminalCommand } from '../types';

export const mkdir: TerminalCommand = {
    name: 'mkdir',
    description: 'Create directory',
    usage: 'mkdir <name>',
    execute: ({ args, fileSystem, resolvePath }) => {
        if (args.length === 0) {
            return { output: ['mkdir: missing operand'], error: true };
        }

        const output: string[] = [];
        let error = false;

        args.forEach(arg => {
            const fullPath = resolvePath(arg);
            const lastSlashIndex = fullPath.lastIndexOf('/');
            const parentPath = lastSlashIndex === 0 ? '/' : fullPath.substring(0, lastSlashIndex);
            const name = fullPath.substring(lastSlashIndex + 1);

            const success = fileSystem.createDirectory(parentPath, name);
            if (!success) {
                output.push(`mkdir: cannot create directory '${arg}'`);
                error = true;
            }
        });

        return { output, error };
    },
};
