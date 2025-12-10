import { useState, useEffect, memo, useRef } from 'react';
import type { DesktopIcon } from '../App';
import { useAppContext } from './AppContext';
// import { lightenColor } from '../utils/colors';
import { FileIcon } from './ui/FileIcon';
import { useFileSystem } from './FileSystemContext';

interface DesktopProps {
  onDoubleClick: () => void;
  icons: DesktopIcon[];
  onUpdateIconPosition: (id: string, position: { x: number; y: number }) => void;
  onIconDoubleClick: (iconId: string) => void;
}

// Helper for hiding native drag ghost
const emptyImage = new Image();
emptyImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function DesktopComponent({ onDoubleClick, icons, onUpdateIconPosition, onIconDoubleClick }: DesktopProps) {
  const { accentColor, reduceMotion, disableShadows } = useAppContext();
  const { moveNodeById } = useFileSystem();

  // Selection State
  const [selectedIcons, setSelectedIcons] = useState<Set<string>>(new Set());
  const [selectionBox, setSelectionBox] = useState<{ start: { x: number, y: number }, current: { x: number, y: number } } | null>(null);

  // Dragging State
  const [draggingIcons, setDraggingIcons] = useState<string[]>([]);
  const [dragStartPos, setDragStartPos] = useState<{ x: number, y: number } | null>(null);
  const [dragDelta, setDragDelta] = useState<{ x: number, y: number }>({ x: 0, y: 0 });

  // Refs for current values in event listeners
  const iconsRef = useRef(icons);
  useEffect(() => { iconsRef.current = icons; }, [icons]);

  // Ref for mutable drag state to keep event listeners stable
  const dragStateRef = useRef({
    draggingIcons: [] as string[],
    dragStartPos: null as { x: number, y: number } | null,
  });

  // Sync refs with state
  useEffect(() => {
    dragStateRef.current.draggingIcons = draggingIcons;
    dragStateRef.current.dragStartPos = dragStartPos;
  }, [draggingIcons, dragStartPos]);

  // Handle Internal Drag Visuals via DragOver (Native DnD)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const { draggingIcons, dragStartPos } = dragStateRef.current;

    // If we are dragging internal icons, update the visual delta
    // We use e.clientX/Y from the dragover event on the container
    if (draggingIcons.length > 0 && dragStartPos) {
      setDragDelta({
        x: e.clientX - dragStartPos.x,
        y: e.clientY - dragStartPos.y
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));

      // Case 1: Internal Drop (Desktop -> Desktop)
      if (data.source === 'desktop') {
        const { draggingIcons, dragStartPos } = dragStateRef.current;
        if (draggingIcons.length > 0 && dragStartPos) {
          const deltaX = e.clientX - dragStartPos.x;
          const deltaY = e.clientY - dragStartPos.y;

          draggingIcons.forEach(id => {
            const icon = iconsRef.current.find(i => i.id === id);
            if (icon) {
              const newX = icon.position.x + deltaX;
              let newY = icon.position.y + deltaY;
              newY = Math.max(0, newY);
              onUpdateIconPosition(id, { x: newX, y: newY });
            }
          });
        }
      }
      // Case 2: External Drop (Finder -> Desktop)
      else if (data.id) {
        moveNodeById(data.id, '~/Desktop');
      }
    } catch (err) {
      console.error('Failed to handle desktop drop', err);
    }

    // Reset state
    setDraggingIcons([]);
    setDragStartPos(null);
    setDragDelta({ x: 0, y: 0 });
  };

  const handleDragEnd = (_e: React.DragEvent) => {
    // Fired on the source element when drag completes (success or cancel)
    // This ensures we clean up if the drop happened outside or was cancelled
    setDraggingIcons([]);
    setDragStartPos(null);
    setDragDelta({ x: 0, y: 0 });
  };

  const handleDesktopMouseDown = (e: React.MouseEvent) => {
    // If clicking on background, clear selection unless Shift/Ctrl
    if (!e.shiftKey && !e.ctrlKey) {
      setSelectedIcons(new Set());
    }

    // Start selection box
    setSelectionBox({
      start: { x: e.clientX, y: e.clientY },
      current: { x: e.clientX, y: e.clientY }
    });
  };

  // Selection Box Logic (Keep mouse events for selection box ONLY)
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (selectionBox) {
        setSelectionBox(prev => prev ? { ...prev, current: { x: e.clientX, y: e.clientY } } : null);
      }
    };

    const handleGlobalMouseUp = (_e: MouseEvent) => {
      if (selectionBox) {
        // Selection Box Commit
        const boxRect = {
          left: Math.min(selectionBox.start.x, selectionBox.current.x),
          top: Math.min(selectionBox.start.y, selectionBox.current.y),
          right: Math.max(selectionBox.start.x, selectionBox.current.x),
          bottom: Math.max(selectionBox.start.y, selectionBox.current.y)
        };

        const newSelection = new Set(selectedIcons);
        iconsRef.current.forEach(icon => {
          const iconCenter = { x: icon.position.x + 50, y: icon.position.y + 50 };
          if (
            iconCenter.x >= boxRect.left &&
            iconCenter.x <= boxRect.right &&
            iconCenter.y >= boxRect.top &&
            iconCenter.y <= boxRect.bottom
          ) {
            newSelection.add(icon.id);
          }
        });
        setSelectedIcons(newSelection);
        setSelectionBox(null);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [selectionBox, selectedIcons]);

  const handleIconMouseDown = (e: React.MouseEvent, iconId: string) => {
    e.stopPropagation();
    const newSelection = new Set(selectedIcons);
    if (e.ctrlKey || e.shiftKey) {
      if (newSelection.has(iconId)) newSelection.delete(iconId);
      else newSelection.add(iconId);
    } else {
      if (!newSelection.has(iconId)) {
        newSelection.clear();
        newSelection.add(iconId);
      }
    }
    setSelectedIcons(newSelection);
  };

  // --- Native Drag Support ---
  const handleNativeDragStart = (e: React.DragEvent, icon: DesktopIcon) => {
    // START DRAG
    const { clientX, clientY } = e;
    setDragStartPos({ x: clientX, y: clientY });

    // Set Dragged Items
    let itemsToDrag = Array.from(selectedIcons);
    if (!itemsToDrag.includes(icon.id)) {
      itemsToDrag = [icon.id];
      setSelectedIcons(new Set([icon.id]));
    }
    setDraggingIcons(itemsToDrag);

    // Set Native Data
    e.dataTransfer.setDragImage(emptyImage, 0, 0);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: icon.id,
      name: icon.name,
      type: icon.type === 'folder' ? 'directory' : 'file',
      source: 'desktop'
    }));
  };

  return (
    <div
      className="absolute inset-0 w-full h-full"
      onMouseDown={handleDesktopMouseDown}
      onDoubleClick={onDoubleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)',
      }}
    >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" />

      {/* Selection Box */}
      {selectionBox && (
        <div
          className="absolute border border-blue-400/50 bg-blue-500/20 z-50 pointer-events-none"
          style={{
            left: Math.min(selectionBox.start.x, selectionBox.current.x),
            top: Math.min(selectionBox.start.y, selectionBox.current.y),
            width: Math.abs(selectionBox.current.x - selectionBox.start.x),
            height: Math.abs(selectionBox.current.y - selectionBox.start.y),
          }}
        />
      )}

      {/* Desktop Icons */}
      {icons.map((icon) => {
        // Calculate temporary position if being dragged
        const isDragging = draggingIcons.includes(icon.id);
        const position = isDragging
          ? { x: icon.position.x + dragDelta.x, y: icon.position.y + dragDelta.y }
          : icon.position;

        return (
          <div
            key={icon.id}
            draggable
            onDragStart={(e) => handleNativeDragStart(e, icon)}
            onDragEnd={handleDragEnd}
            className={`absolute flex flex-col items-center gap-1 p-2 rounded-lg cursor-pointer select-none 
            ${(!reduceMotion && !isDragging) ? 'transition-all duration-75' : ''} 
            ${selectedIcons.has(icon.id) ? 'bg-white/20 backdrop-blur-sm ring-1 ring-white/30' : 'hover:bg-white/5'}`}
            style={{
              left: position.x,
              top: position.y,
              width: '100px',
              // Disable transition during drag for instant feel
              transition: isDragging ? 'none' : undefined
            }}
            onMouseDown={(e) => handleIconMouseDown(e, icon.id)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onIconDoubleClick(icon.id);
            }}
          >
            <div className={`relative w-14 h-14 mb-1 ${!disableShadows ? 'drop-shadow-lg' : ''}`}>
              <FileIcon
                name={icon.name}
                type={icon.type === 'folder' ? 'directory' : 'file'}
                accentColor={accentColor}
                className="w-full h-full"
                isEmpty={icon.isEmpty}
              />
            </div>

            <div className={`text-[11px] leading-tight text-white text-center px-2 py-0.5 rounded
            ${!disableShadows ? 'drop-shadow-md text-shadow-sm' : ''} truncate w-full`}>
              {icon.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const Desktop = memo(DesktopComponent);
