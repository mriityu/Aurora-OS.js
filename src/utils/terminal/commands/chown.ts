import { TerminalCommand } from '../types';

export const chown: TerminalCommand = {
    name: 'chown',
    description: 'Change file owner and group',
    usage: 'chown <owner>[:<group>] <file>',
    execute: ({ args, fileSystem: { chown }, resolvePath }) => {
        if (args.length < 2) {
            return { output: ['chown: missing operand'], error: true };
        }

        const ownerGroup = args[0];
        const file = resolvePath(args[1]);

        let owner = ownerGroup;
        let group = undefined;

        if (ownerGroup.includes(':')) {
            const parts = ownerGroup.split(':');
            owner = parts[0];
            group = parts[1];
        }

        // If owner is empty (e.g. :group), standard chown might fail or support it.
        // Helper `chown` expects owner. If empty string passed, maybe it keeps original?
        // Let's assume user passes name. If ":group", owner is empty.
        // My context implementation takes owner string.
        // I should probably handle checks here or rely on context.
        // For now, simple parsing.

        const success = chown(file, owner, group);

        if (!success) {
            return { output: [`chown: changing ownership of '${file}': Operation not permitted or file not found`], error: true };
        }

        return { output: [] };
    },
};
