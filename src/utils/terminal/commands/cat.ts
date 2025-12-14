import { TerminalCommand } from '../types';

export const cat: TerminalCommand = {
    name: 'cat',
    description: 'Display file contents',
    usage: 'cat <file>',
    execute: ({ args, fileSystem, resolvePath }) => {
        if (args.length === 0) {
            return { output: ['cat: missing file operand'], error: true };
        }

        const output: string[] = [];
        let error = false;

        args.forEach(arg => {
            const filePath = resolvePath(arg);
            const content = fileSystem.readFile(filePath);

            if (content !== null) {
                output.push(...content.split('\n'));
            } else {
                const node = fileSystem.getNodeAtPath(filePath);
                if (node) {
                    output.push(`cat: ${arg}: Permission denied`);
                } else {
                    output.push(`cat: ${arg}: No such file or directory`);
                }
                error = true;
            }
        });

        return { output, error };
    },
};
