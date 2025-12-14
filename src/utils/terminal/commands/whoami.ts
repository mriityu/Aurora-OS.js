import { TerminalCommand } from '../types';

export const whoami: TerminalCommand = {
    name: 'whoami',
    description: 'Print current user',
    execute: ({ fileSystem }) => {
        return { output: [fileSystem.currentUser || 'nobody'] };
    },
};
