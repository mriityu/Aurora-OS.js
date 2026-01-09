
import { toast } from 'sonner';
import { soundManager } from '@/services/sound';
import { SystemToast } from '@/components/ui/notifications/SystemToast';

type NotificationType = 'success' | 'warning' | 'error';

export const notify = {
    system: (type: NotificationType, source: string, message: string, subtitle?: string) => {
        // Play sound
        soundManager.play(type);

        // Show toast
        toast.custom(() => (
            <SystemToast type={type} source={source} message={message} subtitle={subtitle} />
        ), {
            position: 'bottom-right',
            duration: 4000,
        });
    },
};
