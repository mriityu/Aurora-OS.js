import { TerminalCommand } from '../types';
import { checkPermissions } from '../../../utils/fileSystemUtils';

export const mkdir: TerminalCommand = {
    name: 'mkdir',
    description: 'Create directory',
    usage: 'mkdir <name>',
    execute: (context) => {
        const { args, fileSystem, resolvePath } = context;
        if (args.length === 0) {
            return { output: ['mkdir: missing operand'], error: true };
        }

        const output: string[] = [];
        let error = false;

        const { getNodeAtPath, createDirectory, users, currentUser } = fileSystem;
        // Resolve effective user for permission checks
        // terminalUser might be undefined if not strictly typed in all contexts, fallback to currentUser
        const activeUser = context.terminalUser || currentUser || 'user';
        const userObj = users.find(u => u.username === activeUser) || {
            username: 'nobody', uid: 65534, gid: 65534, fullName: 'Nobody', homeDir: '/', shell: ''
        };

        args.forEach(arg => {
            const fullPath = resolvePath(arg);
            const lastSlashIndex = fullPath.lastIndexOf('/');
            const parentPath = lastSlashIndex === 0 ? '/' : fullPath.substring(0, lastSlashIndex);
            const name = fullPath.substring(lastSlashIndex + 1);

            const parentNode = getNodeAtPath(parentPath);
            if (!parentNode) {
                output.push(`mkdir: cannot create directory '${arg}': No such file or directory`);
                error = true;
                return;
            }

            if (!checkPermissions(parentNode, userObj, 'write')) {
                output.push(`mkdir: cannot create directory '${arg}': Permission denied`);
                error = true;
                return;
            }

            const success = createDirectory(parentPath, name);
            if (!success) {
                // If permission passed, usually means file exists
                if (parentNode.children?.some(c => c.name === name)) {
                    output.push(`mkdir: cannot create directory '${arg}': File exists`);
                } else {
                    output.push(`mkdir: cannot create directory '${arg}': Operation failed`);
                }
                error = true;
            }
        });

        return { output, error };
    },
};
