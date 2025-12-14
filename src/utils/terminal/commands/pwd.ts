import { TerminalCommand } from '../types';

export const pwd: TerminalCommand = {
    name: 'pwd',
    description: 'Print working directory',
    execute: ({ currentPath }) => {
        return { output: [currentPath] };
    },
};
