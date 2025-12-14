import { TerminalCommand } from '../types';

export const date: TerminalCommand = {
    name: 'date',
    description: 'Print the system date and time',
    execute: () => {
        return { output: [new Date().toString()] };
    },
};
