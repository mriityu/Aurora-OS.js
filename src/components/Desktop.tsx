import { useState, useEffect, memo, useRef } from 'react';
import type { DesktopIcon } from '../App';
import { useAppContext } from './AppContext';
// import { lightenColor } from '../utils/colors';
import { FileIcon } from './ui/FileIcon';

interface DesktopProps {
  onDoubleClick: () => void;
  icons: DesktopIcon[];
  onUpdateIconPosition: (id: string, position: { x: number; y: number }) => void;
  onIconDoubleClick: (iconId: string) => void;
}



function DesktopComponent({ onDoubleClick, icons, onUpdateIconPosition, onIconDoubleClick }: DesktopProps) {
  const { accentColor, reduceMotion, disableShadows } = useAppContext();

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

  // Re-implement the effect with proper refs logic
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      const { draggingIcons, dragStartPos } = dragStateRef.current;

      if (draggingIcons.length > 0 && dragStartPos) {
        const deltaX = e.clientX - dragStartPos.x;
        const deltaY = e.clientY - dragStartPos.y;
        setDragDelta({ x: deltaX, y: deltaY });
      }

      if (selectionBox) { // access selectionBox from state? It's in dep array so good.
        setSelectionBox(prev => prev ? { ...prev, current: { x: e.clientX, y: e.clientY } } : null);
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      const { draggingIcons, dragStartPos } = dragStateRef.current;

      if (draggingIcons.length > 0 && dragStartPos) {
        const deltaX = e.clientX - dragStartPos.x;
        const deltaY = e.clientY - dragStartPos.y;

        // Commit changes
        draggingIcons.forEach(id => {
          const icon = iconsRef.current.find(i => i.id === id);
          if (icon) {
            const newX = icon.position.x + deltaX;
            let newY = icon.position.y + deltaY;
            newY = Math.max(0, newY);
            onUpdateIconPosition(id, { x: newX, y: newY });
          }
        });

        setDraggingIcons([]);
        setDragStartPos(null);
        setDragDelta({ x: 0, y: 0 });
      }

      if (selectionBox) {
        // Selection logic (same as before)
        // We need to access selectionBox state/ref. 
        // Since selectionBox IS in dep array, this closure is fresh for it.
        // ... (Logic copied from previous) ...
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
  }, [selectionBox, selectedIcons, onUpdateIconPosition]);
  // We include selectionBox/selectedIcons so it updates when they change. 
  // Drag moves don't change these, so listener stays stable during drag!

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

  const handleIconMouseDown = (e: React.MouseEvent, iconId: string) => {
    e.stopPropagation(); // Prevent desktop selection box

    // Selection Logic
    const newSelection = new Set(selectedIcons);
    if (e.ctrlKey || e.shiftKey) {
      if (newSelection.has(iconId)) {
        newSelection.delete(iconId);
      } else {
        newSelection.add(iconId);
      }
    } else {
      if (!newSelection.has(iconId)) {
        newSelection.clear();
        newSelection.add(iconId);
      }
    }
    setSelectedIcons(newSelection);

    // Start Dragging
    setDraggingIcons(Array.from(newSelection.has(iconId) ? newSelection : new Set([iconId])));
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDragDelta({ x: 0, y: 0 });
  };

  return (
    <div
      className="absolute inset-0 w-full h-full"
      onMouseDown={handleDesktopMouseDown}
      onDoubleClick={onDoubleClick}
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)',
      }}
    >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">

      </div>

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
              />
            </div>

            <div className={`text-[11px] leading-tight text-white text-center px-2 py-0.5 rounded
            ${selectedIcons.has(icon.id) ? 'bg-blue-600' : 'bg-black/20 backdrop-blur-sm'}
            ${!disableShadows ? 'drop-shadow-md' : ''} truncate w-full`}>
              {icon.name}
            </div>
          </div>
        );
      })}
    </div >
  );
}


export const Desktop = memo(DesktopComponent);
