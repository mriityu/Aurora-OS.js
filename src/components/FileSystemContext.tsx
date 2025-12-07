import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  children?: FileNode[];
  permissions?: string;
  owner?: string;
  group?: string;
  size?: number;
  modified?: Date;
}

// Efficient deep clone function for FileNode
function deepCloneFileNode(node: FileNode): FileNode {
  const cloned: FileNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    content: node.content,
    permissions: node.permissions,
    owner: node.owner,
    group: node.group,
    size: node.size,
    modified: node.modified ? new Date(node.modified) : undefined,
  };

  if (node.children) {
    cloned.children = node.children.map(child => deepCloneFileNode(child));
  }

  return cloned;
}

// Ensure every node has an ID (recursive)
function ensureIds(node: any): FileNode {
  if (!node.id) {
    node.id = crypto.randomUUID();
  }

  if (node.children) {
    node.children.forEach((child: any) => ensureIds(child));
  }

  return node as FileNode;
}

// Efficient deep clone for entire file system with ID assurance
function deepCloneFileSystem(root: FileNode): FileNode {
  const cloned = deepCloneFileNode(root);
  return ensureIds(cloned);
}

// Helper to create a user home directory structure (macOS-inspired)
function createUserHome(username: string): any {
  return {
    name: username,
    type: 'directory',
    owner: username,
    permissions: 'drwxr-x---',
    children: [
      { name: 'Desktop', type: 'directory', children: [], owner: username, permissions: 'drwxr-xr-x' },
      { name: 'Documents', type: 'directory', children: [], owner: username, permissions: 'drwxr-xr-x' },
      { name: 'Downloads', type: 'directory', children: [], owner: username, permissions: 'drwxr-xr-x' },
      { name: 'Pictures', type: 'directory', children: [], owner: username, permissions: 'drwxr-xr-x' },
      { name: 'Music', type: 'directory', children: [], owner: username, permissions: 'drwxr-xr-x' },
      { name: 'Videos', type: 'directory', children: [], owner: username, permissions: 'drwxr-xr-x' },
      { name: 'Config', type: 'directory', children: [], owner: username, permissions: 'drwxr-x---' },
      { name: '.Trash', type: 'directory', children: [], owner: username, permissions: 'drwx------' },
    ],
  };
}

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
  resolvePath: (path: string) => string;
  resetFileSystem: () => void;
}

const STORAGE_KEY = 'aurora-filesystem';

// Grey Hack / Linux inspired file system hierarchy
// Note: IDs will be injected by ensureIds on load
const initialFileSystem: any = {
  name: '/',
  type: 'directory',
  permissions: 'drwxr-xr-x',
  owner: 'root',
  children: [
    // Essential command binaries
    {
      name: 'bin',
      type: 'directory',
      permissions: 'drwxr-xr-x',
      owner: 'root',
      children: [
        { name: 'ls', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!/bin/bash\n# list directory contents' },
        { name: 'cat', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!/bin/bash\n# concatenate files' },
        { name: 'cd', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!/bin/bash\n# change directory' },
        { name: 'pwd', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!/bin/bash\n# print working directory' },
        { name: 'mkdir', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!/bin/bash\n# make directories' },
        { name: 'rm', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!/bin/bash\n# remove files or directories' },
        { name: 'cp', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!/bin/bash\n# copy files' },
        { name: 'mv', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!/bin/bash\n# move files' },
        { name: 'touch', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!/bin/bash\n# create empty file' },
        { name: 'echo', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!/bin/bash\n# display a line of text' },
        { name: 'clear', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!/bin/bash\n# clear terminal screen' },
        { name: 'whoami', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!/bin/bash\n# print effective userid' },
      ],
    },
    // Boot loader files
    {
      name: 'boot',
      type: 'directory',
      permissions: 'drwxr-xr-x',
      owner: 'root',
      children: [
        { name: 'kernel', type: 'file', permissions: '-rw-r--r--', owner: 'root', content: 'Aurora OS Kernel v0.5.2' },
        { name: 'initrd', type: 'file', permissions: '-rw-r--r--', owner: 'root', content: 'Initial ramdisk' },
      ],
    },
    // System configuration files
    {
      name: 'etc',
      type: 'directory',
      permissions: 'drwxr-xr-x',
      owner: 'root',
      children: [
        { name: 'passwd', type: 'file', permissions: '-rw-r--r--', owner: 'root', content: 'root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000:User:/home/user:/bin/bash\nguest:x:1001:1001:Guest:/home/guest:/bin/bash' },
        { name: 'group', type: 'file', permissions: '-rw-r--r--', owner: 'root', content: 'root:x:0:\nusers:x:100:user,guest\nadmin:x:10:user' },
        { name: 'hostname', type: 'file', permissions: '-rw-r--r--', owner: 'root', content: 'aurora' },
        { name: 'hosts', type: 'file', permissions: '-rw-r--r--', owner: 'root', content: '127.0.0.1\tlocalhost\n::1\t\tlocalhost' },
        { name: 'os-release', type: 'file', permissions: '-rw-r--r--', owner: 'root', content: 'NAME="Aurora OS"\nVERSION="0.5.2"\nID=aurora\nPRETTY_NAME="Aurora OS.js"' },
        {
          name: 'apt',
          type: 'directory',
          permissions: 'drwxr-xr-x',
          owner: 'root',
          children: [
            { name: 'sources.list', type: 'file', permissions: '-rw-r--r--', owner: 'root', content: '# Aurora package sources\ndeb https://packages.aurora.os/stable main' },
          ],
        },
      ],
    },
    // User home directories
    {
      name: 'home',
      type: 'directory',
      permissions: 'drwxr-xr-x',
      owner: 'root',
      children: [
        {
          ...createUserHome('user'),
          children: [
            { name: 'Desktop', type: 'directory', children: [], owner: 'user', permissions: 'drwxr-xr-x' },
            {
              name: 'Documents',
              type: 'directory',
              owner: 'user',
              permissions: 'drwxr-xr-x',
              children: [
                { name: 'README.txt', type: 'file', content: 'Welcome to Aurora OS!\n\nThis is your personal documents folder.', size: 60, owner: 'user', permissions: '-rw-r--r--' },
                { name: 'Notes', type: 'directory', children: [], owner: 'user', permissions: 'drwxr-xr-x' },
              ],
            },
            {
              name: 'Downloads',
              type: 'directory',
              owner: 'user',
              permissions: 'drwxr-xr-x',
              children: [
                { name: 'sample.pdf', type: 'file', content: '[PDF content placeholder]', size: 1024, owner: 'user', permissions: '-rw-r--r--' },
              ],
            },
            { name: 'Pictures', type: 'directory', children: [{ name: 'Screenshots', type: 'directory', children: [], owner: 'user' }], owner: 'user', permissions: 'drwxr-xr-x' },
            { name: 'Music', type: 'directory', children: [], owner: 'user', permissions: 'drwxr-xr-x' },
            { name: 'Videos', type: 'directory', children: [], owner: 'user', permissions: 'drwxr-xr-x' },
            { name: 'Config', type: 'directory', children: [], owner: 'user', permissions: 'drwxr-x---' },
            { name: '.Trash', type: 'directory', children: [], owner: 'user', permissions: 'drwx------' },
          ],
        },
        createUserHome('guest'),
      ],
    },
    // Essential shared libraries
    {
      name: 'lib',
      type: 'directory',
      permissions: 'drwxr-xr-x',
      owner: 'root',
      children: [
        { name: 'libc.so', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '# C standard library' },
        { name: 'libm.so', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '# Math library' },
      ],
    },
    // Root user home directory
    {
      name: 'root',
      type: 'directory',
      permissions: 'drwx------',
      owner: 'root',
      children: [
        { name: 'Desktop', type: 'directory', children: [], owner: 'root', permissions: 'drwxr-xr-x' },
        { name: 'Downloads', type: 'directory', children: [], owner: 'root', permissions: 'drwxr-xr-x' },
        { name: 'Config', type: 'directory', children: [], owner: 'root', permissions: 'drwx------' },
        { name: '.Trash', type: 'directory', children: [], owner: 'root', permissions: 'drwx------' },
        { name: '.bashrc', type: 'file', content: '# Root bash configuration\nexport PS1="root@aurora# "', owner: 'root', permissions: '-rw-------' },
      ],
    },
    // Kernel and system files
    {
      name: 'sys',
      type: 'directory',
      permissions: 'drwxr-xr-x',
      owner: 'root',
      children: [
        {
          name: 'kernel',
          type: 'directory',
          permissions: 'drwxr-xr-x',
          owner: 'root',
          children: [
            { name: 'version', type: 'file', permissions: '-r--r--r--', owner: 'root', content: '0.5.2-aurora' },
          ],
        },
        {
          name: 'devices',
          type: 'directory',
          permissions: 'drwxr-xr-x',
          owner: 'root',
          children: [
            { name: 'cpu', type: 'directory', children: [], permissions: 'drwxr-xr-x', owner: 'root' },
            { name: 'memory', type: 'directory', children: [], permissions: 'drwxr-xr-x', owner: 'root' },
          ],
        },
      ],
    },
    // User binaries and applications
    {
      name: 'usr',
      type: 'directory',
      permissions: 'drwxr-xr-x',
      owner: 'root',
      children: [
        {
          name: 'bin',
          type: 'directory',
          permissions: 'drwxr-xr-x',
          owner: 'root',
          children: [
            { name: 'nano', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!/bin/bash\n# text editor' },
            { name: 'vim', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!/bin/bash\n# vi improved' },
            { name: 'grep', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!/bin/bash\n# search text patterns' },
            { name: 'Finder', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!app finder' },
            { name: 'Browser', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!app browser' },
            { name: 'Mail', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!app messages' },
            { name: 'Music', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!app music' },
            { name: 'Photos', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!app photos' },
            { name: 'Settings', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!app settings' },
            { name: 'Terminal', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!app terminal' },
            { name: 'find', type: 'file', permissions: '-rwxr-xr-x', owner: 'root', content: '#!/bin/bash\n# search for files' },
          ],
        },
        {
          name: 'lib',
          type: 'directory',
          permissions: 'drwxr-xr-x',
          owner: 'root',
          children: [],
        },
        {
          name: 'share',
          type: 'directory',
          permissions: 'drwxr-xr-x',
          owner: 'root',
          children: [
            {
              name: 'applications',
              type: 'directory',
              permissions: 'drwxr-xr-x',
              owner: 'root',
              children: [
                { name: 'Finder.desktop', type: 'file', permissions: '-rw-r--r--', owner: 'root', content: '[Desktop Entry]\nName=Finder\nExec=finder\nType=Application' },
                { name: 'Terminal.desktop', type: 'file', permissions: '-rw-r--r--', owner: 'root', content: '[Desktop Entry]\nName=Terminal\nExec=terminal\nType=Application' },
                { name: 'Settings.desktop', type: 'file', permissions: '-rw-r--r--', owner: 'root', content: '[Desktop Entry]\nName=Settings\nExec=settings\nType=Application' },
              ],
            },
          ],
        },
      ],
    },
    // Variable data files
    {
      name: 'var',
      type: 'directory',
      permissions: 'drwxr-xr-x',
      owner: 'root',
      children: [
        {
          name: 'log',
          type: 'directory',
          permissions: 'drwxr-xr-x',
          owner: 'root',
          children: [
            { name: 'system.log', type: 'file', permissions: '-rw-r-----', owner: 'root', content: `[${new Date().toISOString()}] System initialized\n[${new Date().toISOString()}] Aurora OS started` },
            { name: 'auth.log', type: 'file', permissions: '-rw-r-----', owner: 'root', content: '' },
          ],
        },
        {
          name: 'tmp',
          type: 'directory',
          permissions: 'drwxrwxrwt',
          owner: 'root',
          children: [],
        },
        {
          name: 'cache',
          type: 'directory',
          permissions: 'drwxr-xr-x',
          owner: 'root',
          children: [],
        },
      ],
    },
  ],
};

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

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

export function FileSystemProvider({ children }: { children: ReactNode }) {
  const [fileSystem, setFileSystem] = useState<FileNode>(() => loadFileSystem());
  const [currentUser] = useState('user'); // Default user - could be extended for login system
  const homePath = currentUser === 'root' ? '/root' : `/home/${currentUser}`;
  const [currentPath, setCurrentPath] = useState(homePath);

  // Persist filesystem changes to localStorage
  useEffect(() => {
    saveFileSystem(fileSystem);
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

  // Helper to find node and its parent by ID
  const findNodeAndParent = useCallback((root: FileNode, targetId: string): { node: FileNode, parent: FileNode } | null => {
    if (root.children) {
      for (const child of root.children) {
        if (child.id === targetId) {
          return { node: child, parent: root };
        }
        if (child.type === 'directory') {
          const result = findNodeAndParent(child, targetId);
          if (result) return result;
        }
      }
    }
    return null;
  }, []);

  const moveNodeById = useCallback((id: string, destParentPath: string): boolean => {
    // 1. Find the source node and its parent using ID
    const result = findNodeAndParent(fileSystem, id);
    if (!result) return false;

    const { node: nodeToMove } = result;
    const destParent = getNodeAtPath(resolvePath(destParentPath));

    // 2. Validate destination
    if (!destParent || destParent.type !== 'directory' || !destParent.children) return false;

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
  }, [fileSystem, resolvePath, getNodeAtPath, findNodeAndParent]);

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
