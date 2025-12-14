import { TerminalCommand } from '../types';

export const echo: TerminalCommand = {
    name: 'echo',
    description: 'Display a line of text',
    usage: 'echo [text]',
    execute: ({ args }) => {
        return { output: [args.join(' ')] };
    },
};
