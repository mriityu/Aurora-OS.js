import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

import {
  FileNode,
  deepCloneFileNode,
  deepCloneFileSystem,
  ensureIds,
  isDescendant,
  findNodeAndParent,
  initialFileSystem
} from '../utils/fileSystemUtils';

export type { FileNode } from '../utils/fileSystemUtils';



export interface FileSystemContextType {
  fileSystem: FileNode;
  currentPath: string;
  currentUser: string;
  homePath: string;
  setCurrentPath: (path: string) => void;
  getNodeAtPath: (path: string) => FileNode | null;
  createFile: (path: string, name: string, content?: string) => boolean;
  createDirectory: (path: string, name: string) => boolean;
  deleteNode: (path: string) => boolean;
  writeFile: (path: string, content: string) => boolean;
  readFile: (path: string) => string | null;
  listDirectory: (path: string) => FileNode[] | null;
  moveNode: (fromPath: string, toPath: string) => boolean;
  moveNodeById: (id: string, destParentPath: string) => boolean;
  moveToTrash: (path: string) => boolean;
  emptyTrash: () => void;
  resolvePath: (path: string) => string;
  resetFileSystem: () => void;
}

const STORAGE_KEY = 'aurora-filesystem';

// Load filesystem from localStorage or return initial
function loadFileSystem(): FileNode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure IDs exist on stored data (migration)
      return ensureIds(parsed);
    }
  } catch (e) {
    console.warn('Failed to load filesystem from storage:', e);
  }
  return deepCloneFileSystem(initialFileSystem);
}

// Save filesystem to localStorage
function saveFileSystem(fs: FileNode): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fs));
  } catch (e) {
    console.warn('Failed to save filesystem to storage:', e);
  }
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

export function FileSystemProvider({ children }: { children: ReactNode }) {
  const [fileSystem, setFileSystem] = useState<FileNode>(() => loadFileSystem());
  const [currentUser] = useState('user'); // Default user - could be extended for login system
  const homePath = currentUser === 'root' ? '/root' : `/home/${currentUser}`;
  const [currentPath, setCurrentPath] = useState(homePath);

  // Persist filesystem changes to localStorage (Debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveFileSystem(fileSystem);
    }, 1000); // 1000ms debounce

    return () => clearTimeout(timeoutId);
  }, [fileSystem]);

  // Resolve ~ and . and .. in paths
  const resolvePath = useCallback((path: string): string => {
    // Handle home shortcut
    let resolved = path.replace(/^~/, homePath);

    // Map top-level user directories for better UX (Desktop OS feel)
    const userDirs = ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos'];
    for (const dir of userDirs) {
      if (resolved.startsWith(`/${dir}`)) {
        resolved = resolved.replace(`/${dir}`, `${homePath}/${dir}`);
        break;
      }
    }

    // Handle relative paths
    if (!resolved.startsWith('/')) {
      resolved = currentPath + '/' + resolved;
    }

    // Normalize path (handle . and ..)
    const parts = resolved.split('/').filter(p => p && p !== '.');
    const stack: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        stack.pop();
      } else {
        stack.push(part);
      }
    }

    return '/' + stack.join('/');
  }, [homePath, currentPath]);

  // Reset filesystem to initial state
  const resetFileSystem = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setFileSystem(deepCloneFileSystem(initialFileSystem));
    setCurrentPath(homePath);
  }, [homePath]);

  const getNodeAtPath = useCallback((path: string): FileNode | null => {
    const resolved = resolvePath(path);
    if (resolved === '/') return fileSystem;

    const parts = resolved.split('/').filter(p => p);
    let current: FileNode | null = fileSystem;

    for (const part of parts) {
      if (!current || current.type !== 'directory' || !current.children) {
        return null;
      }
      current = current.children.find(child => child.name === part) || null;
    }

    return current;
  }, [fileSystem, resolvePath]);

  const listDirectory = useCallback((path: string): FileNode[] | null => {
    const node = getNodeAtPath(path);
    if (!node || node.type !== 'directory') return null;
    return node.children || [];
  }, [getNodeAtPath]);

  const readFile = useCallback((path: string): string | null => {
    const node = getNodeAtPath(path);
    if (!node || node.type !== 'file') return null;
    return node.content || '';
  }, [getNodeAtPath]);

  const deleteNode = useCallback((path: string): boolean => {
    const resolved = resolvePath(path);
    if (resolved === '/') return false;

    const parts = resolved.split('/').filter(p => p);
    const name = parts.pop();
    if (!name) return false;

    setFileSystem(prevFS => {
      const newFS = deepCloneFileSystem(prevFS);
      let parent = newFS;

      for (const part of parts) {
        if (parent.children) {
          parent = parent.children.find((child: FileNode) => child.name === part)!;
        }
      }

      if (parent && parent.children) {
        parent.children = parent.children.filter((child: FileNode) => child.name !== name);
      }

      return newFS;
    });

    return true;
  }, [resolvePath]);

  // Re-implemented moveNode with strict name check feature
  const moveNode = useCallback((fromPath: string, toPath: string): boolean => {
    const resolvedFrom = resolvePath(fromPath);
    const resolvedTo = resolvePath(toPath);

    const node = getNodeAtPath(resolvedFrom);
    if (!node) return false;

    // Clone the node to move
    const nodeToMove = deepCloneFileNode(node);

    // Get parent directory of destination
    const toParts = resolvedTo.split('/').filter(p => p);
    const newName = toParts.pop();
    const parentPath = '/' + toParts.join('/');

    if (!newName) return false;

    const destParent = getNodeAtPath(parentPath);
    if (!destParent || destParent.type !== 'directory' || !destParent.children) return false;

    // Check for collision at destination
    if (destParent.children.some(child => child.name === newName)) {
      return false;
    }

    // Delete from original location
    const deleteSuccess = deleteNode(resolvedFrom);
    if (!deleteSuccess) return false;

    // Update name if moving to different location
    nodeToMove.name = newName;

    // Add to new location
    setFileSystem(prevFS => {
      const newFS = deepCloneFileSystem(prevFS);
      const parts = parentPath.split('/').filter(p => p);
      let current = newFS;

      for (const part of parts) {
        if (current.children) {
          current = current.children.find(child => child.name === part)!;
        }
      }

      if (current && current.children) {
        current.children.push(nodeToMove);
      }

      return newFS;
    });

    return true;
  }, [getNodeAtPath, deleteNode, resolvePath]);



  const moveNodeById = useCallback((id: string, destParentPath: string): boolean => {
    // 1. Find the source node and its parent using ID
    const result = findNodeAndParent(fileSystem, id);
    if (!result) return false;

    const { node: nodeToMove } = result;
    const destParent = getNodeAtPath(resolvePath(destParentPath));

    // 2. Validate destination
    if (!destParent || destParent.type !== 'directory' || !destParent.children) return false;

    // Safety Checks: Prevent recursive moves
    if (nodeToMove.id === destParent.id) {
      toast.error('Operation blocked: Cannot move a directory into itself')
      //console.warn('Operation blocked: Cannot move a directory into itself');
      return false;
    }
    if (isDescendant(nodeToMove, destParent.id)) {
      toast.error('Operation blocked: Cannot move a directory into its own descendant');
      //console.warn('Operation blocked: Cannot move a directory into its own descendant');
      return false;
    }

    // 3. Collision Check: Don't overwrite existing name at destination
    if (destParent.children.some(child => child.name === nodeToMove.name)) {
      return false;
    }

    // 4. Perform Move
    setFileSystem(prevFS => {
      const newFS = deepCloneFileSystem(prevFS);

      const findInClone = (root: FileNode): { node: FileNode, parent: FileNode } | null => {
        if (root.children) {
          for (const child of root.children) {
            if (child.id === id) return { node: child, parent: root };
            if (child.type === 'directory') {
              const res = findInClone(child);
              if (res) return res;
            }
          }
        }
        return null;
      };

      const sourceRes = findInClone(newFS);
      if (!sourceRes) return newFS;

      const { node: cloneNode, parent: cloneSourceParent } = sourceRes;

      const destResolved = resolvePath(destParentPath);
      const destParts = destResolved.split('/').filter(p => p);
      let cloneDestParent = newFS;
      for (const part of destParts) {
        if (cloneDestParent.children) {
          const found = cloneDestParent.children.find(c => c.name === part);
          if (found) cloneDestParent = found;
        }
      }

      if (!cloneDestParent.children) return newFS;

      cloneSourceParent.children = cloneSourceParent.children!.filter(c => c.id !== id);
      cloneDestParent.children.push(cloneNode);

      return newFS;
    });

    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileSystem, resolvePath, getNodeAtPath, findNodeAndParent]);

  const moveToTrash = useCallback((path: string): boolean => {
    const resolved = resolvePath(path);
    const trashPath = resolvePath('~/.Trash');

    // If already in trash, permanent delete
    if (resolved.startsWith(trashPath)) {
      return deleteNode(path);
    }

    const fileName = resolved.split('/').pop();
    if (!fileName) return false;

    // Handle collision
    let destPath = `${trashPath}/${fileName}`;
    let counter = 1;

    while (getNodeAtPath(destPath)) {
      const extIndex = fileName.lastIndexOf('.');
      if (extIndex > 0) {
        const name = fileName.substring(0, extIndex);
        const ext = fileName.substring(extIndex);
        destPath = `${trashPath}/${name} ${counter}${ext}`;
      } else {
        destPath = `${trashPath}/${fileName} ${counter}`;
      }
      counter++;
    }

    return moveNode(path, destPath);
  }, [resolvePath, getNodeAtPath, moveNode, deleteNode]);

  const emptyTrash = useCallback(() => {
    setFileSystem(prevFS => {
      const newFS = deepCloneFileSystem(prevFS);
      const trashPath = resolvePath('~/.Trash'); // resolve in callback? context resolvePath is stable
      // Actually resolvePath depends on currentPath/homePath in scope, but we know .Trash is always at ~
      // And we need to find it in the newFS tree.
      // Simpler: Just find .Trash in newFS manually or use standard traversal since we know structure

      // We assume .Trash is at root or user home.
      // Let's use the same traversal logic as deleteNode but target .Trash children
      const parts = trashPath.split('/').filter(p => p);
      let current = newFS;

      for (const part of parts) {
        if (current.children) {
          const found = current.children.find(c => c.name === part);
          if (found) current = found;
          else return newFS; // Trash not found?
        }
      }

      if (current && current.children) {
        current.children = [];
      }

      return newFS;
    });
  }, [resolvePath]);

  const createFile = useCallback((path: string, name: string, content: string = ''): boolean => {
    const resolved = resolvePath(path);
    const node = getNodeAtPath(resolved);
    if (!node || node.type !== 'directory' || !node.children) return false;

    // Check for existing node (file OR directory) with same name
    if (node.children.some(child => child.name === name)) {
      return false;
    }

    const newFile: FileNode = {
      id: crypto.randomUUID(),
      name,
      type: 'file',
      content,
      size: content.length,
      modified: new Date(),
      owner: currentUser,
      permissions: '-rw-r--r--',
    };

    setFileSystem(prevFS => {
      const newFS = deepCloneFileSystem(prevFS);
      const parts = resolved.split('/').filter(p => p);
      let current = newFS;

      for (const part of parts) {
        if (current.children) {
          current = current.children.find(child => child.name === part)!;
        }
      }

      if (current && current.children) {
        current.children.push(newFile);
      }
      return newFS;
    });

    return true;
  }, [getNodeAtPath, resolvePath, currentUser]);

  const createDirectory = useCallback((path: string, name: string): boolean => {
    const resolved = resolvePath(path);
    const node = getNodeAtPath(resolved);
    if (!node || node.type !== 'directory' || !node.children) return false;

    // Check for existing node (file OR directory) with same name
    if (node.children.some(child => child.name === name)) {
      return false;
    }

    const newDir: FileNode = {
      id: crypto.randomUUID(),
      name,
      type: 'directory',
      children: [],
      modified: new Date(),
      owner: currentUser,
      permissions: 'drwxr-xr-x',
    };

    setFileSystem(prevFS => {
      const newFS = deepCloneFileSystem(prevFS);
      const parts = resolved.split('/').filter(p => p);
      let current = newFS;

      for (const part of parts) {
        if (current.children) {
          current = current.children.find(child => child.name === part)!;
        }
      }

      if (current && current.children) {
        current.children.push(newDir);
      }

      return newFS;
    });

    return true;
  }, [getNodeAtPath, resolvePath, currentUser]);

  const writeFile = useCallback((path: string, content: string): boolean => {
    const resolved = resolvePath(path);

    setFileSystem(prevFS => {
      const newFS = deepCloneFileSystem(prevFS);
      const parts = resolved.split('/').filter(p => p);
      let current = newFS;

      for (let i = 0; i < parts.length - 1; i++) {
        if (current.children) {
          current = current.children.find((child: FileNode) => child.name === parts[i])!;
        }
      }

      if (current && current.children) {
        const file = current.children.find((child: FileNode) => child.name === parts[parts.length - 1]);
        if (file && file.type === 'file') {
          file.content = content;
          file.size = content.length;
          file.modified = new Date();
        }
      }

      return newFS;
    });

    return true;
  }, [resolvePath]);

  return (
    <FileSystemContext.Provider
      value={{
        fileSystem,
        currentPath,
        currentUser,
        homePath,
        setCurrentPath,
        getNodeAtPath,
        createFile,
        createDirectory,
        deleteNode,
        writeFile,
        readFile,
        listDirectory,
        moveNode,
        moveNodeById,
        moveToTrash,
        emptyTrash,
        resolvePath,
        resetFileSystem,
      }}
    >
      {children}
    </FileSystemContext.Provider>
  );
}

export function useFileSystem() {
  const context = useContext(FileSystemContext);
  if (!context) {
    throw new Error('useFileSystem must be used within FileSystemProvider');
  }
  return context;
}
