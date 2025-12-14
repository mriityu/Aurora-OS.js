import { TerminalCommand } from '../types';

export const help: TerminalCommand = {
    name: 'help',
    description: 'Show this help message',
    execute: ({ allCommands }) => {
        const longestName = Math.max(...allCommands.map(c => c.name.length));

        const output = [
            'Available commands:',
            ...allCommands.map(c => {
                const padding = ' '.repeat(longestName - c.name.length + 2);
                const usage = c.usage ? ` (Usage: ${c.usage})` : '';
                return `  ${c.name}${padding}- ${c.description}${usage}`;
            }),
            '',
            '  [app]           - Launch installed applications (e.g. Finder)',
            ''
        ];

        return { output };
    },
};
