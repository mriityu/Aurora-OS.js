import { TerminalCommand } from '../types';

export const help: TerminalCommand = {
    name: 'help',
    description: 'Show this help message',
    execute: ({ allCommands }) => {
        const visibleCommands = allCommands.filter(c => !c.hidden);
        const longestName = Math.max(...visibleCommands.map(c => c.name.length));

        const output = [
            'Available commands:',
            ...visibleCommands.map(c => {
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
