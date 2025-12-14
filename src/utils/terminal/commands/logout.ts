import { TerminalCommand } from '../types';

export const logout: TerminalCommand = {
    name: 'logout',
    description: 'Logout of the current session',
    execute: ({ fileSystem }) => {
        fileSystem.logout();
        return { output: ['Logging out...'] };
    },
};
