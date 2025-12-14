import { TerminalCommand } from '../types';

export const su: TerminalCommand = {
    name: 'su',
    description: 'Change user ID or become superuser',
    usage: 'su [username] [password]',
    execute: ({ args, fileSystem: { login, currentUser } }) => {
        let targetUser = 'root';
        let password = undefined;

        if (args.length > 0) {
            targetUser = args[0];
            if (args.length > 1) {
                password = args[1];
            }
        }

        if (targetUser === currentUser) {
            return { output: [`Already logged in as ${targetUser}`] };
        }

        // In a real terminal, it prompts. Here we expect password as arg or fail if password required?
        // Our context.login checks password.
        // If we don't provide password, and user has one, login fails.
        // We'll try login.

        const success = login(targetUser, password);

        if (success) {
            // The context updates, so the terminal prompt will update automatically.
            return { output: [`Logged in as ${targetUser}`] };
        } else {
            return { output: ['su: Authentication failure'], error: true };
        }
    },
};
