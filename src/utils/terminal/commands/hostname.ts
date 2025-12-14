import { TerminalCommand } from '../types';

export const hostname: TerminalCommand = {
    name: 'hostname',
    description: 'Print system hostname',
    execute: () => {
        return { output: ['aurora'] };
    },
};
