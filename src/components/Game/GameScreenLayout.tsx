import { ReactNode } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import pkg from '../../../package.json';
import { validateIntegrity } from '../../utils/integrity';
import { useAppContext } from '../AppContext';
import background from '../../assets/images/background.png';

interface GameScreenLayoutProps {
    children: ReactNode;
    footerActions?: ReactNode;
    className?: string;
    zIndex?: number;
}

export function GameScreenLayout({ children, footerActions, className = "", zIndex = 40 }: GameScreenLayoutProps) {
    const { accentColor } = useAppContext();

    return (
        <div
            className={`fixed inset-0 bg-cover bg-center font-mono flex flex-col ${className}`}
            style={{
                zIndex,
                backgroundImage: `url(${background})`
            }}
        >
            {/* Backdrop Blur Overlay */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />

            {/* Content Area */}
            <div className="relative z-20 flex-1 flex flex-col items-center justify-center p-12">

                {/* Unified Header */}
                <div className="flex flex-col items-center mb-16 animate-in fade-in zoom-in-95 duration-700">
                    <div className="w-24 h-24 bg-white/10 rounded-3xl flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-2xl mx-auto mb-6">
                        <div
                            className="w-12 h-12 rounded-full shadow-lg animate-pulse"
                            style={{
                                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`
                            }}
                        />
                    </div>
                    <h1 className="text-6xl font-bold tracking-tighter mb-2 text-white drop-shadow-lg">
                        AURORA <span className="font-light opacity-70">OS</span>
                    </h1>
                    <div className="flex items-center gap-4 text-white/50 text-sm tracking-[0.2em] uppercase">
                        <span>v{pkg.version}</span>
                        <span>•</span>
                        <span>Simulation Ready</span>
                    </div>
                </div>

                {/* Main Content */}
                {children}
            </div>

            {/* Unified Footer */}
            <div className="relative z-20 pb-6 text-center flex flex-col gap-2 items-center">
                <div className="flex items-center gap-2 text-xs font-mono">
                    <a
                        href="https://github.com/mental-os/Aurora-OS.js"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/20 hover:text-white/50 transition-colors"
                    >
                        v{pkg.version}
                    </a>
                    <span className="text-white/10">•</span>
                    {validateIntegrity() ? (
                        <span className="text-emerald-500/50 flex items-center gap-1.5 bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10">
                            <ShieldCheck className="w-3 h-3" /> Original Distribution
                        </span>
                    ) : (
                        <span className="text-red-500 flex items-center gap-1.5 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 animate-pulse">
                            <AlertTriangle className="w-3 h-3" /> Unauthorized Distribution
                        </span>
                    )}
                </div>

                <div className="flex gap-4 text-xs font-mono text-white/10">
                    {footerActions || (
                        <>
                            <span>Aurora OS</span>
                            <span>•</span>
                            <span>Simulation System</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
