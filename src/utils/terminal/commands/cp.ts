import { TerminalCommand } from '../types';
import { checkPermissions } from '../../../utils/fileSystemUtils';

export const cp: TerminalCommand = {
    name: 'cp',
    description: 'Copy files',
    usage: 'cp <source> <dest>',
    execute: (context) => {
        const { args, fileSystem, resolvePath, terminalUser } = context;
        const { readFile, createFile, getNodeAtPath, users, currentUser } = fileSystem;

        if (args.length < 2) {
            return { output: ['cp: missing file operand'], error: true };
        }

        const activeUser = terminalUser || currentUser || 'user';
        const userObj = users.find(u => u.username === activeUser) || users[0];

        const sourcePath = resolvePath(args[0]);
        const destPath = resolvePath(args[1]);

        // Check source
        const sourceNode = getNodeAtPath(sourcePath);
        if (!sourceNode) {
            return { output: [`cp: cannot stat '${args[0]}': No such file or directory`], error: true };
        }
        if (sourceNode.type === 'directory') {
            return { output: [`cp: -r not specified; omitting directory '${args[0]}'`], error: true };
        }

        if (!checkPermissions(sourceNode, userObj, 'read')) {
            return { output: [`cp: cannot open '${args[0]}' for reading: Permission denied`], error: true };
        }

        const content = readFile(sourcePath);
        if (content === null) {
            return { output: [`cp: cannot read '${args[0]}': Permission denied`], error: true };
        }

        // Determine destination name and parent
        let destName = '';
        let parentPath = '';

        // If dest is directory, copy into it with same name
        const destNode = getNodeAtPath(destPath);
        if (destNode && destNode.type === 'directory') {
            destName = sourceNode.name;
            parentPath = destPath;

            // Check write perm on dest dir
            if (!checkPermissions(destNode, userObj, 'write')) {
                return { output: [`cp: cannot create regular file '${destPath}/${destName}': Permission denied`], error: true };
            }

        } else {
            // Dest is the new file path
            const lastSlash = destPath.lastIndexOf('/');
            if (lastSlash === -1 || lastSlash === 0 && destPath === '/') {
                parentPath = lastSlash === 0 ? '/' : destPath.substring(0, lastSlash);
                destName = destPath.substring(lastSlash + 1);
            } else {
                parentPath = destPath.substring(0, lastSlash);
                destName = destPath.substring(lastSlash + 1);
            }

            // Handle root special case for parent path calculation if needed
            if (parentPath === '') parentPath = '/';

            // Check parent existence and perm
            const parentNode = getNodeAtPath(parentPath);
            if (!parentNode) {
                return { output: [`cp: cannot create regular file '${args[1]}': No such file or directory`], error: true };
            }
            if (!checkPermissions(parentNode, userObj, 'write')) {
                return { output: [`cp: cannot create regular file '${args[1]}': Permission denied`], error: true };
            }
        }

        const success = createFile(parentPath, destName, content);

        if (!success) {
            // Could be existing file that we can't overwrite? 
            // Standard cp overwrites. Our createFile fails if exists.
            // We should try to overwrite (or delete and recreate, or writeFile if exists)
            // Ideally `createFile` should be `writeFile` if we want overwrite.
            // But checking current impl of createFile: fails if exists.
            // Let's implement overwrite logic: delete then create, OR use writeFile?
            // `writeFile` exists in FileSystemContext!
            // Let's assume we want to overwrite.
            // context.fileSystem is the helper object. context.fileSystem.fileSystem is the root node.
            const rootNode = fileSystem.fileSystem;
            const existing = parentPath === '/' ? rootNode.children?.find(c => c.name === destName) : getNodeAtPath(parentPath)?.children?.find(c => c.name === destName);

            if (existing) {
                // Check write perm on existing file to overwrite it
                if (!checkPermissions(existing, userObj, 'write')) {
                    return { output: [`cp: cannot create regular file '${args[1]}': Permission denied`], error: true };
                }
                // Use writeFile
                const writeSuccess = fileSystem.writeFile(`${parentPath === '/' ? '' : parentPath}/${destName}`, content);
                if (!writeSuccess) {
                    return { output: [`cp: cannot create regular file '${args[1]}': Operation failed`], error: true };
                }
            } else {
                return { output: [`cp: cannot create regular file '${args[1]}': Operation failed`], error: true };
            }
        }

        return { output: [] };
    },
};
