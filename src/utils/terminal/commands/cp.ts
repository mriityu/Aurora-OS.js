import { TerminalCommand } from '../types';

export const cp: TerminalCommand = {
    name: 'cp',
    description: 'Copy files',
    usage: 'cp <source> <dest>',
    execute: ({ args, fileSystem: { readFile, createFile, getNodeAtPath }, resolvePath }) => {
        if (args.length < 2) {
            return { output: ['cp: missing file operand'], error: true };
        }

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

        const content = readFile(sourcePath);
        if (content === null) {
            // Should be covered by node check, but permissions might fail read
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
        } else {
            // Dest is the new file path
            const lastSlash = destPath.lastIndexOf('/');
            if (lastSlash === -1 || lastSlash === 0 && destPath === '/') {
                // Root handling or simple
                parentPath = lastSlash === 0 ? '/' : destPath.substring(0, lastSlash);
                destName = destPath.substring(lastSlash + 1);
            } else {
                parentPath = destPath.substring(0, lastSlash);
                destName = destPath.substring(lastSlash + 1);
            }
        }

        // Handle root special case for parent path calculation if needed
        if (parentPath === '') parentPath = '/';

        const success = createFile(parentPath, destName, content);

        if (!success) {
            return { output: [`cp: cannot create regular file '${args[1]}': Permission denied or invalid path`], error: true };
        }

        return { output: [] };
    },
};
