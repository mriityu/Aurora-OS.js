import { TerminalCommand } from '../types';

export const clear: TerminalCommand = {
    name: 'clear',
    description: 'Clear the terminal screen',
    execute: () => {
        return { output: [], shouldClear: true };
    },
};
