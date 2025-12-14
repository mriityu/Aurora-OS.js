import { TerminalCommand } from '../types';
import { su } from './su';

export const sudo: TerminalCommand = {
    name: 'sudo',
    description: 'Execute a command as another user',
    usage: 'sudo -s',
    execute: (context) => {
        const { args } = context;
        if (args.includes('-s')) {
            // Simulate 'sudo -s' by calling 'su root'
            // If they provided extra args? Ignore for now.
            // We need to pass args to Su? No, su expects [user, pass].
            // sudo usually asks for CURRENT user's password, but here we simplify to target root.
            // We'll call su's execute with explicit args for root.
            // Does sudo -s ask for password? Yes. 
            // We can allow `sudo -s <password>` as a hack for simulation?
            // Or just assume 'su root' logic which might ask for root password.
            // Real sudo asks for YOUR password. 'su' asks for ROOT password.
            // For this sim, we map 'sudo -s' -> 'su root'.

            // We create a modified context with args for su
            const suContext = { ...context, args: ['root'] };

            // Check if user provided password in args? `sudo -s mypass`?
            const passIndex = args.indexOf('-s') + 1;
            if (passIndex < args.length) {
                suContext.args.push(args[passIndex]);
            }

            return su.execute(suContext);
        }

        return { output: ['sudo: Only -s flag is supported in this simulation version'], error: true };
    },
};
