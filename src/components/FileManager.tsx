/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  FileText,
  Download,
  HardDrive,
  Search,
  Grid3x3,
  List,
  Monitor,
  Music,
  Image,
  Trash2,
  Settings,
  Home
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppContext } from './AppContext';
import { AppTemplate } from './apps/AppTemplate';
import { ResponsiveGrid } from './ui/ResponsiveGrid';
import { useFileSystem, FileNode } from './FileSystemContext';
import { useAppStorage } from '../hooks/useAppStorage';
import { useElementSize } from '../hooks/useElementSize';
import { FileIcon } from './ui/FileIcon';

export function FileManager({ initialPath }: { initialPath?: string }) {
  const { accentColor } = useAppContext();
  // Drag and Drop Logic
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const { listDirectory, homePath, moveNodeById } = useFileSystem();

  const [containerRef, { width }] = useElementSize();
  const isMobile = width < 450;

  // Persisted state (viewMode survives refresh)
  const [appState, setAppState] = useAppStorage('finder', {
    viewMode: 'grid' as 'grid' | 'list',
  });

  // Each FileManager instance has its own navigation state (independent windows, NOT persisted)
  const startPath = initialPath || homePath;
  const [currentPath, setCurrentPath] = useState(startPath);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [items, setItems] = useState<FileNode[]>([]);
  const [history, setHistory] = useState<string[]>([startPath]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Load directory contents when path changes
  useEffect(() => {
    const contents = listDirectory(currentPath);
    if (contents) {
      // Sort: directories first, then files, both alphabetically
      const sorted = [...contents].sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
      setItems(sorted);
    } else {
      setItems([]);
    }
    setSelectedItem(null);
  }, [currentPath, listDirectory]);

  // Navigate to a directory
  const navigateTo = (path: string) => {
    // Add to history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(path);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentPath(path);
  };

  // Handle item double-click
  const handleItemDoubleClick = (item: FileNode) => {
    if (item.type === 'directory') {
      const newPath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
      navigateTo(newPath);
    }
  };

  // Go back in history
  const goBack = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCurrentPath(history[historyIndex - 1]);
    }
  };

  // Go forward in history
  const goForward = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setCurrentPath(history[historyIndex + 1]);
    }
  };

  // Get current directory name
  const getCurrentDirName = () => {
    if (currentPath === '/') return '/';
    const parts = currentPath.split('/');
    return parts[parts.length - 1] || '/';
  };

  const handleDragStart = (e: React.DragEvent, item: FileNode) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: item.id,
      name: item.name,
      type: item.type
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, item: FileNode) => {
    e.preventDefault(); // allow drop
    if (item.type === 'directory') {
      e.dataTransfer.dropEffect = 'move';
      setDragTargetId(item.id);
    } else {
      e.dataTransfer.dropEffect = 'none';
      setDragTargetId(null);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragTargetId(null);
  };

  const handleDrop = (e: React.DragEvent, targetItem: FileNode) => {
    e.preventDefault();
    setDragTargetId(null);

    if (targetItem.type !== 'directory') return;

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.id && data.id !== targetItem.id) {
        // Resolve destination path (currentPath + targetName)
        const destPath = currentPath === '/'
          ? `/${targetItem.name}`
          : `${currentPath}/${targetItem.name}`;

        // Execute robust ID-based move
        moveNodeById(data.id, destPath);
      }
    } catch (err) {
      console.error('Failed to parse drag data', err);
    }
  };

  // Sidebar Drop Logic
  const handleSidebarDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSidebarDrop = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.id) {
        const success = moveNodeById(data.id, targetPath);
        if (success) {
          toast.success(`Moved to ${targetPath.split('/').pop()}`);
        } else {
          toast.error(`Could not move to ${targetPath.split('/').pop()}`);
        }
      }
    } catch (err) {
      console.error('Failed to drop on sidebar', err);
      toast.error('Failed to process drop');
    }
  };

  // Helper to create sidebar action props
  const sidebarDropProps = (path: string) => ({
    onDragOver: handleSidebarDragOver,
    onDrop: (e: React.DragEvent) => handleSidebarDrop(e, path)
  });

  // Sidebar configuration
  const fileManagerSidebar = {
    sections: [
      {
        title: 'Favourites',
        items: [
          {
            id: 'home',
            icon: Home,
            label: 'Home',
            action: () => navigateTo(homePath),
            ...sidebarDropProps(homePath)
          },
          {
            id: 'desktop',
            icon: Monitor,
            label: 'Desktop',
            action: () => navigateTo(`${homePath}/Desktop`),
            ...sidebarDropProps(`${homePath}/Desktop`)
          },
          {
            id: 'documents',
            icon: FileText,
            label: 'Documents',
            action: () => navigateTo(`${homePath}/Documents`),
            ...sidebarDropProps(`${homePath}/Documents`)
          },
          {
            id: 'downloads',
            icon: Download,
            label: 'Downloads',
            action: () => navigateTo(`${homePath}/Downloads`),
            ...sidebarDropProps(`${homePath}/Downloads`)
          },
          {
            id: 'pictures',
            icon: Image,
            label: 'Pictures',
            action: () => navigateTo(`${homePath}/Pictures`),
            ...sidebarDropProps(`${homePath}/Pictures`)
          },
          {
            id: 'music',
            icon: Music,
            label: 'Music',
            action: () => navigateTo(`${homePath}/Music`),
            ...sidebarDropProps(`${homePath}/Music`)
          },
        ]
      },
      {
        title: 'System',
        items: [
          {
            id: 'root',
            icon: HardDrive,
            label: '/',
            action: () => navigateTo('/'),
            ...sidebarDropProps('/')
          },
          {
            id: 'usr',
            icon: FolderOpen,
            label: '/usr',
            action: () => navigateTo('/usr'),
            ...sidebarDropProps('/usr')
          },
          {
            id: 'etc',
            icon: Settings,
            label: '/etc',
            action: () => navigateTo('/etc'),
            ...sidebarDropProps('/etc')
          },
        ]
      },
      {
        title: 'Locations',
        items: [
          {
            id: 'trash',
            icon: Trash2,
            label: 'Trash',
            action: () => navigateTo(`${homePath}/.Trash`),
            ...sidebarDropProps(`${homePath}/.Trash`)
          },
        ]
      },
    ]
  };

  const toolbar = (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        <button
          onClick={goBack}
          disabled={historyIndex === 0}
          className={`p-1.5 rounded-md transition-colors ${historyIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/5'}`}
        >
          <ChevronLeft className="w-4 h-4 text-white/50" />
        </button>
        <button
          onClick={goForward}
          disabled={historyIndex >= history.length - 1}
          className={`p-1.5 rounded-md transition-colors ${historyIndex >= history.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/5'}`}
        >
          <ChevronRight className="w-4 h-4 text-white/50" />
        </button>
        <div className="ml-3 px-3 py-1 bg-gray-700/50 rounded-md text-sm text-white/90">
          {getCurrentDirName()}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <button
            onClick={() => setAppState(s => ({ ...s, viewMode: 'grid' }))}
            className={`p-1.5 rounded-md transition-colors ${appState.viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5'
              }`}
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setAppState(s => ({ ...s, viewMode: 'list' }))}
            className={`p-1.5 rounded-md transition-colors ${appState.viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5'
              }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
        <button className="p-1.5 hover:bg-white/5 rounded-md transition-colors">
          <Search className="w-4 h-4 text-white/50" />
        </button>
      </div>
    </div>
  );

  const content = (
    <div ref={containerRef} className="flex-1 overflow-auto p-6">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-white/40">
          <FolderOpen className="w-16 h-16 mb-4" />
          <p>This folder is empty</p>
        </div>
      ) : appState.viewMode === 'grid' ? (
        <ResponsiveGrid minItemWidth={110} className="gap-6">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item.id)}
              onDoubleClick={() => handleItemDoubleClick(item)}
              draggable
              onDragStart={(e) => handleDragStart(e, item)}
              onDragOver={(e) => handleDragOver(e, item)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, item)}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-colors group relative
              ${selectedItem === item.id ? 'bg-white/10' : 'hover:bg-white/5'}
              ${dragTargetId === item.id ? 'bg-blue-500/20 ring-2 ring-blue-500' : ''}`}
            >
              <div className="w-20 h-20 flex items-center justify-center pointer-events-none">
                <FileIcon name={item.name} type={item.type} accentColor={accentColor} />
              </div>
              <div className="w-full text-center pointer-events-none">
                <div className="text-sm text-white/90 truncate px-1 w-full">
                  {item.name}
                </div>
                {item.type === 'directory' && item.children && (
                  <div className="text-xs mt-0.5" style={{ color: accentColor }}>
                    {item.children.length} item{item.children.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </button>
          ))}
        </ResponsiveGrid>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item.id)}
              onDoubleClick={() => handleItemDoubleClick(item)}
              draggable
              onDragStart={(e) => handleDragStart(e, item)}
              onDragOver={(e) => handleDragOver(e, item)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, item)}
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors 
              ${selectedItem === item.id ? 'bg-white/10' : 'hover:bg-white/5'}
              ${dragTargetId === item.id ? 'bg-blue-500/20 ring-1 ring-blue-500' : ''}`}
            >
              <div className="w-8 h-8 flex items-center justify-center shrink-0 pointer-events-none">
                <FileIcon name={item.name} type={item.type} accentColor={accentColor} />
              </div>
              <div className="flex-1 text-left min-w-0 pointer-events-none">
                <div className="text-sm text-white/90 truncate">{item.name}</div>
              </div>
              <div className="text-xs text-white/40 shrink-0 pointer-events-none">
                {item.type === 'directory'
                  ? `${item.children?.length || 0} items`
                  : item.size ? `${item.size} bytes` : ''}
              </div>
              {item.permissions && !isMobile && (
                <div className="text-xs text-white/50 font-mono shrink-0 whitespace-nowrap text-right min-w-[90px] pointer-events-none">
                  {item.permissions}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return <AppTemplate sidebar={fileManagerSidebar} toolbar={toolbar} content={content} />;
}
