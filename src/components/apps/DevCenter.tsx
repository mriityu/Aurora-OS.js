import { useState, useRef } from 'react';
import pkg from '../../../package.json';

import { Terminal, Code, Cpu, Activity, PartyPopper, Bell, Volume2, HardDrive, FileJson, RefreshCw, Trash2, Download, Upload, XCircle, ChevronRight, ChevronDown, Copy } from 'lucide-react';
import { AppTemplate } from './AppTemplate';
import { GlassButton } from '../ui/GlassButton';
import { notify } from '../../services/notifications';
import { feedback } from '../../services/soundFeedback';
import { getStorageStats, formatBytes } from '../../utils/memory';
import { useFileSystem } from '../../components/FileSystemContext';

const devSidebar = {
    sections: [
        {
            title: 'General',
            items: [
                { id: 'dashboard', label: 'Dashboard', icon: Activity },
            ]
        },
        {
            title: 'Interface',
            items: [
                { id: 'UI', label: 'UI & Sounds', icon: PartyPopper },
            ]
        },
        {
            title: 'System',
            items: [
                { id: 'storage', label: 'Storage', icon: HardDrive },
                { id: 'filesystem', label: 'File System', icon: FileJson },
                { id: 'logs', label: 'System Logs', icon: Terminal },
            ]
        },
        {
            title: 'Tools',
            items: [
                { id: 'editor', label: 'Editor', icon: Code },
                { id: 'performance', label: 'Performance', icon: Cpu },
            ]
        }
    ]
};

export function DevCenter() {
    const { fileSystem, resetFileSystem } = useFileSystem();
    const [activeTab, setActiveTab] = useState('dashboard');

    // Storage Tab State
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
    const [, setStorageUpdate] = useState(0); // Trigger re-render for storage
    const fileInputRef = useRef<HTMLInputElement>(null);

    const refreshStorage = () => setStorageUpdate(prev => prev + 1);

    const toggleExpandKey = (key: string) => {
        const newSet = new Set(expandedKeys);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setExpandedKeys(newSet);
    };

    const handleExportStorage = () => {
        try {
            const data = JSON.stringify(localStorage, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `aurora-prefs-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            notify.system('success', 'Storage', 'Preferences exported successfully');
        } catch {
            notify.system('error', 'Storage', 'Failed to export preferences');
        }
    };

    const handleImportStorage = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                if (typeof json !== 'object' || json === null) throw new Error('Invalid JSON');

                // Be careful not to wipe specialized internal keys if needed, 
                // but usually full restore implies wiping others or merging. 
                // We'll merge/overwrite here.
                Object.entries(json).forEach(([key, value]) => {
                    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
                });
                refreshStorage();
                notify.system('success', 'Storage', 'Preferences imported successfully');
            } catch {
                notify.system('error', 'Storage', 'Failed to parse import file');
            }
        };
        reader.readAsText(file);
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClearStorage = () => {
        if (confirm('Are you sure you want to clear ALL local storage? This will reset usage preferences, theme settings, and window positions.')) {
            localStorage.clear();
            refreshStorage();
            notify.system('success', 'Storage', 'All keys cleared');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        notify.system('success', 'Clipboard', 'Copied to clipboard');
    };

    const renderContent = ({ width }: { width: number }) => {
        const isNarrow = width < 500;
        const isVeryNarrow = width < 350;

        switch (activeTab) {
            case 'UI':
                return (
                    <div className={`h-full overflow-y-auto ${isNarrow ? 'p-4' : 'p-6'}`}>
                        <div className="max-w-4xl mx-auto space-y-8">
                            {/* System Notifications */}
                            <section>
                                <div className="flex items-center gap-3 mb-4">
                                    <Bell className="w-5 h-5 text-white" />
                                    <h2 className="text-xl text-white font-medium">System Notifications</h2>
                                </div>
                                <div className={`grid gap-4 ${isNarrow ? 'grid-cols-1' : 'grid-cols-3'}`}>
                                    <GlassButton
                                        variant="default"
                                        className="h-auto block p-4 text-left group border-green-500/20 bg-green-500/10 hover:bg-green-500/20"
                                        onClick={() => notify.system('success', 'DevCenter', 'Operation completed successfully')}
                                    >
                                        <div className="font-medium text-green-400 mb-1 group-hover:text-green-300">Success Toast</div>
                                        <div className="text-sm text-white/50 whitespace-normal">Triggers a success notification with sound</div>
                                    </GlassButton>
                                    <GlassButton
                                        variant="default"
                                        className="h-auto block p-4 text-left group border-yellow-500/20 bg-yellow-500/10 hover:bg-yellow-500/20"
                                        onClick={() => notify.system('warning', 'DevCenter', 'System resources are running low')}
                                    >
                                        <div className="font-medium text-yellow-400 mb-1 group-hover:text-yellow-300">Warning Toast</div>
                                        <div className="text-sm text-white/50 whitespace-normal">Triggers a warning notification with sound</div>
                                    </GlassButton>
                                    <GlassButton
                                        variant="default"
                                        className="h-auto block p-4 text-left group border-red-500/20 bg-red-500/10 hover:bg-red-500/20"
                                        onClick={() => notify.system('error', 'DevCenter', 'Failed to connect to server')}
                                    >
                                        <div className="font-medium text-red-400 mb-1 group-hover:text-red-300">Error Toast</div>
                                        <div className="text-sm text-white/50 whitespace-normal">Triggers an error notification with sound</div>
                                    </GlassButton>
                                </div>
                            </section>

                            {/* Sound Feedback */}
                            <section>
                                <div className="flex items-center gap-3 mb-4">
                                    <Volume2 className="w-5 h-5 text-white" />
                                    <h2 className="text-xl text-white font-medium">Sound Feedback</h2>
                                </div>
                                <div className={`grid gap-4 ${isNarrow ? 'grid-cols-2' : 'grid-cols-4'}`}>
                                    <GlassButton onClick={() => feedback.click()}>
                                        <span className="text-white/80">Click</span>
                                    </GlassButton>
                                    <GlassButton
                                        onClick={() => feedback.hover()}
                                        onMouseEnter={() => feedback.hover()}
                                    >
                                        <span className="text-white/80">Hover</span>
                                    </GlassButton>
                                    <GlassButton onClick={() => feedback.folder()}>
                                        <span className="text-white/80">Folder Open</span>
                                    </GlassButton>
                                    <GlassButton onClick={() => feedback.windowOpen()}>
                                        <span className="text-white/80">Window Open</span>
                                    </GlassButton>
                                    <GlassButton onClick={() => feedback.windowClose()}>
                                        <span className="text-white/80">Window Close</span>
                                    </GlassButton>
                                </div>
                            </section>
                        </div>
                    </div>
                );
            case 'storage':
                // eslint-disable-next-line no-case-declarations
                const stats = getStorageStats();
                return (
                    <div className={`h-full overflow-y-auto ${isNarrow ? 'p-4' : 'p-6'}`}>
                        <div className={`flex items-center justify-between mb-6 ${isVeryNarrow ? 'flex-col items-start gap-4' : ''}`}>
                            <h2 className="text-xl text-white">Storage Inspector</h2>
                            <div className={`flex items-center gap-2 ${isVeryNarrow ? 'w-full flex flex-wrap justify-end' : ''}`}>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept=".json"
                                    onChange={handleImportStorage}
                                />
                                <GlassButton
                                    size="sm"
                                    className="gap-1.5 grow md:grow-0"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="w-3.5 h-3.5" />
                                    Import
                                </GlassButton>
                                <GlassButton
                                    size="sm"
                                    className="gap-1.5 grow md:grow-0"
                                    onClick={handleExportStorage}
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Export
                                </GlassButton>
                                <GlassButton
                                    size="sm"
                                    variant="danger"
                                    className="gap-1.5 grow md:grow-0"
                                    onClick={handleClearStorage}
                                >
                                    <XCircle className="w-3.5 h-3.5" />
                                    Clear
                                </GlassButton>
                            </div>
                        </div>

                        <div className={`grid gap-4 mb-8 ${isNarrow ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            <div className="bg-black/20 p-4 rounded-lg border border-white/10">
                                <div className="text-sm text-white/50 mb-1">Soft Memory (Preferences)</div>
                                <div className="text-2xl text-white font-mono">{formatBytes(stats.softMemory.bytes)}</div>
                                <div className="text-xs text-white/30">{stats.softMemory.keys} keys</div>
                            </div>
                            <div className="bg-black/20 p-4 rounded-lg border border-white/10">
                                <div className="text-sm text-white/50 mb-1">Hard Memory (Filesystem)</div>
                                <div className="text-2xl text-white font-mono">{formatBytes(stats.hardMemory.bytes)}</div>
                                <div className="text-xs text-white/30">{stats.hardMemory.keys} keys</div>
                            </div>
                        </div>

                        <h3 className="text-lg text-white mb-4">Local Storage Keys</h3>
                        <div className="bg-black/20 rounded-lg border border-white/10 overflow-hidden">
                            {Object.keys(localStorage).length === 0 ? (
                                <div className="p-8 text-center text-white/30 text-sm">No keys found in local storage</div>
                            ) : (
                                Object.keys(localStorage).map(key => {
                                    const rawValue = localStorage.getItem(key) || '';
                                    const isExpanded = expandedKeys.has(key);
                                    let formattedValue = rawValue;
                                    try {
                                        const parsed = JSON.parse(rawValue);
                                        formattedValue = JSON.stringify(parsed, null, 2);
                                    } catch {
                                        // keeping rawValue
                                    }

                                    return (
                                        <div key={key} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                            <div
                                                className="flex items-center justify-between p-3 cursor-pointer group"
                                                onClick={() => toggleExpandKey(key)}
                                            >
                                                <div className="flex items-center gap-3 overflow-hidden flex-1">
                                                    {isExpanded ? (
                                                        <ChevronDown className="w-4 h-4 text-white/50 flex-shrink-0" />
                                                    ) : (
                                                        <ChevronRight className="w-4 h-4 text-white/50 flex-shrink-0" />
                                                    )}
                                                    <div className="font-mono text-xs text-white/70 truncate" title={key}>{key}</div>
                                                </div>
                                                <div className="flex items-center gap-4 flex-shrink-0">
                                                    <div className="text-xs text-white/30 whitespace-nowrap">
                                                        {formatBytes(new Blob([rawValue]).size)}
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            localStorage.removeItem(key);
                                                            refreshStorage();
                                                            notify.system('success', 'Storage', `Deleted key: ${key}`);
                                                        }}
                                                        className="text-white/30 hover:text-red-400 transition-colors p-1"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            {isExpanded && (
                                                <div className="bg-black/40 border-t border-white/5 p-3 relative group/code bg-slate-950/50">
                                                    <pre className="font-mono text-[11px] text-blue-300 whitespace-pre-wrap break-all pr-8 max-h-[300px] overflow-y-auto">
                                                        {formattedValue}
                                                    </pre>
                                                    <button
                                                        onClick={() => copyToClipboard(formattedValue)}
                                                        className="absolute top-2 right-2 p-1.5 rounded-md bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all opacity-0 group-hover/code:opacity-100"
                                                        title="Copy value"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                );
            case 'filesystem':
                return (
                    <div className={`h-full flex flex-col ${isNarrow ? 'p-4' : 'p-6'}`}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl text-white">File System Debugger</h2>
                            <GlassButton
                                variant="danger"
                                size="sm"
                                className="gap-2"
                                onClick={() => {
                                    if (confirm('Reset entire filesystem? This cannot be undone.')) {
                                        resetFileSystem();
                                        notify.system('warning', 'FileSystem', 'Filesystem reset to initial state');
                                    }
                                }}
                            >
                                <RefreshCw className="w-4 h-4" />
                                Reset FS
                            </GlassButton>
                        </div>
                        <div className="flex-1 bg-black/40 rounded-lg p-4 font-mono text-xs text-blue-300 overflow-y-auto border border-white/10 whitespace-pre">
                            {JSON.stringify(fileSystem, null, 2)}
                        </div>
                    </div>
                );
            case 'logs':
                return (
                    <div className={`h-full flex flex-col ${isNarrow ? 'p-4' : 'p-6'}`}>
                        <h2 className="text-xl text-white mb-4">System Logs</h2>
                        <div className="flex-1 bg-black/40 rounded-lg p-4 font-mono text-sm text-green-400 overflow-y-auto border border-white/10">
                            <div className="opacity-50">[System] Kernel initialized...</div>
                            <div className="opacity-50">[System] Loading drivers...</div>
                            <div>[Auth] User 'drago' logged in</div>
                            <div>[App] DevCenter launched</div>
                        </div>
                    </div>
                );
            case 'editor':
                return (
                    <div className="flex flex-col items-center justify-center h-full text-white/50 space-y-4">
                        <Code className="w-16 h-16 opacity-50" />
                        <h2 className="text-xl font-medium text-white/80">Code Editor</h2>
                        <p>Monaco editor integration coming soon.</p>
                    </div>
                );
            case 'performance':
                return (
                    <div className="flex flex-col items-center justify-center h-full text-white/50 space-y-4">
                        <Cpu className="w-16 h-16 opacity-50" />
                        <h2 className="text-xl font-medium text-white/80">Performance Monitor</h2>
                        <p>Real-time CPU/RAM metrics coming soon.</p>
                    </div>
                );
            case 'dashboard':
            default:
                return (
                    <div className="flex flex-col items-center justify-center h-full text-white/50 space-y-4">
                        <Activity className="w-16 h-16 opacity-50" />
                        <h2 className="text-xl font-medium text-white/80">Developer Dashboard</h2>
                        <p>Welcome to the {pkg.build.productName} Developer Center.</p>
                    </div>
                );
        }
    };

    return (
        <AppTemplate
            sidebar={devSidebar}
            content={renderContent}
            activeItem={activeTab}
            onItemClick={setActiveTab}
        />
    );
}
