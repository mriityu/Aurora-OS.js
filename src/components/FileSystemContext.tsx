import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { notify } from '../services/notifications';

import {
  FileNode,
  deepCloneFileNode,
  deepCloneFileSystem,
  ensureIds,
  isDescendant,
  findNodeAndParent,
  initialFileSystem,
  User,
  parsePasswd,
  formatPasswd,
  createUserHome,
  checkPermissions,
  octalToPermissions,
  Group,
  parseGroup,
  formatGroup
} from '../utils/fileSystemUtils';

export type { FileNode, User, Group } from '../utils/fileSystemUtils';

export interface FileSystemContextType {
  fileSystem: FileNode;
  currentPath: string;
  currentUser: string | null;
  users: User[];
  homePath: string;
  setCurrentPath: (path: string) => void;
  getNodeAtPath: (path: string) => FileNode | null;
  createFile: (path: string, name: string, content?: string) => boolean;
  createDirectory: (path: string, name: string) => boolean;
  deleteNode: (path: string) => boolean;
  addUser: (username: string, fullName: string, password?: string) => boolean;
  deleteUser: (username: string) => boolean;
  writeFile: (path: string, content: string) => boolean;
  readFile: (path: string) => string | null;
  listDirectory: (path: string) => FileNode[] | null;
  moveNode: (fromPath: string, toPath: string) => boolean;
  moveNodeById: (id: string, destParentPath: string) => boolean;
  moveToTrash: (path: string) => boolean;
  emptyTrash: () => void;
  resolvePath: (path: string) => string;
  resetFileSystem: () => void;
  login: (username: string, password?: string) => boolean;
  logout: () => void;
  chmod: (path: string, mode: string) => boolean;
  chown: (path: string, owner: string, group?: string) => boolean;
  groups: Group[];
  addGroup: (groupName: string, members?: string[]) => boolean;
  deleteGroup: (groupName: string) => boolean;
}

const STORAGE_KEY = 'aurora-filesystem';
const USERS_STORAGE_KEY = 'aurora-users';

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

const DEFAULT_USERS: User[] = [
  { username: 'root', password: 'admin', uid: 0, gid: 0, fullName: 'System Administrator', homeDir: '/root', shell: '/bin/bash', groups: ['root'] },
  { username: 'user', password: '1234', uid: 1000, gid: 1000, fullName: 'User', homeDir: '/home/user', shell: '/bin/bash', groups: ['users', 'admin'] },
  { username: 'guest', password: 'guest', uid: 1001, gid: 1001, fullName: 'Guest', homeDir: '/home/guest', shell: '/bin/bash', groups: ['users'] },
];

// Load users from localStorage
function loadUsers(): User[] {
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    if (stored) {
      console.log('Loaded users from storage:', JSON.parse(stored));
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(u => u.username && typeof u.uid === 'number')) {
        // Heal/Migrate users: If standard users are missing passwords (legacy data), restore defaults
        return parsed.map(u => {
          const defaultUser = DEFAULT_USERS.find(du => du.username === u.username);
          // If it's a default user identity but has no password (or 'x'), restore default password
          if (defaultUser && (!u.password || u.password === 'x')) {
            console.log(`Restoring default password for user: ${u.username}`);
            return { ...u, password: defaultUser.password };
          }
          return u;
        });
      }
      console.warn('Stored users data corrupted or empty, reverting to defaults');
    }
  } catch (e) {
    console.warn('Failed to load users:', e);
  }
  console.log('Using default users');
  return DEFAULT_USERS;
}

const GROUPS_STORAGE_KEY = 'aurora-groups';

const DEFAULT_GROUPS: Group[] = [
  { groupName: 'root', gid: 0, members: ['root'], password: 'x' },
  { groupName: 'users', gid: 100, members: ['user', 'guest'], password: 'x' },
  { groupName: 'admin', gid: 10, members: ['user'], password: 'x' },
];

function loadGroups(): Group[] {
  try {
    const stored = localStorage.getItem(GROUPS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load groups:', e);
  }
  return DEFAULT_GROUPS;
}

// Helper to get current user object
const getCurrentUser = (username: string | null, users: User[]): User => {
  if (!username) return { username: 'nobody', uid: 65534, gid: 65534, fullName: 'Nobody', homeDir: '/', shell: '' };
  return users.find(u => u.username === username) || {
    username: 'nobody', uid: 65534, gid: 65534, fullName: 'Nobody', homeDir: '/', shell: ''
  };
};

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

export function FileSystemProvider({ children }: { children: ReactNode }) {
  const [fileSystem, setFileSystem] = useState<FileNode>(() => loadFileSystem());
  const [users, setUsers] = useState<User[]>(() => loadUsers());
  const [groups, setGroups] = useState<Group[]>(() => loadGroups());
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const homePath = currentUser === 'root' ? '/root' : currentUser ? `/home/${currentUser}` : '/';
  const [currentPath, setCurrentPath] = useState(homePath);

  // Update currentPath when user logs in if currently at root or undefined
  useEffect(() => {
    if (currentUser) {
      const newHome = currentUser === 'root' ? '/root' : `/home/${currentUser}`;
      setCurrentPath(newHome);
    }
  }, [currentUser]);

  const userObj = getCurrentUser(currentUser, users);

  const login = useCallback((username: string, password?: string) => {
    // 1. File Authority: Try to read /etc/passwd from current filesystem
    let targetUser: User | undefined;
    const etc = fileSystem.children?.find(c => c.name === 'etc');
    if (etc && etc.children) {
      const passwdFile = etc.children.find(c => c.name === 'passwd');
      if (passwdFile && passwdFile.content) {
        try {
          const fileUsers = parsePasswd(passwdFile.content);
          targetUser = fileUsers.find(u => u.username === username);
          // console.log('Auth: using /etc/passwd authority');
        } catch {
          console.warn('Auth: /etc/passwd corrupted, falling back to memory');
        }
      }
    }

    // 2. Fallback: Memory
    if (!targetUser) {
      targetUser = users.find(u => u.username === username);
      // console.log('Auth: using memory fallback');
    }

    if (targetUser) {
      // Check password (if user has one set)
      if (targetUser.password && targetUser.password !== password) {
        notify.system('error', 'Auth', 'Incorrect password');
        return false;
      }
      setCurrentUser(username);
      notify.system('success', 'Auth', `Logged in as ${username}`);
      return true;
    } else {
      notify.system('error', 'Auth', 'User not found');
      return false;
    }
  }, [fileSystem, users]); // Depend on fileSystem to ensure fresh read

  const logout = useCallback(() => {
    setCurrentUser(null);
    notify.system('success', 'Auth', 'Logged out');
  }, []);

  // Persist users & groups
  useEffect(() => {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
  }, [groups]);

  // Sync users State -> Filesystem (/etc/passwd)
  useEffect(() => {
    const passwdContent = formatPasswd(users);

    setFileSystem(prevFS => {
      const newFS = deepCloneFileSystem(prevFS);
      const etc = newFS.children?.find(c => c.name === 'etc');
      if (etc && etc.children) {
        let passwd = etc.children.find(c => c.name === 'passwd');
        if (!passwd) {
          passwd = { id: crypto.randomUUID(), name: 'passwd', type: 'file', content: '', owner: 'root', permissions: '-rw-r--r--' };
          etc.children.push(passwd);
        }

        if (passwd.content !== passwdContent) {
          passwd.content = passwdContent;
          passwd.modified = new Date();
          return newFS;
        }
      }
      return prevFS;
    });
  }, [users]);

  // Sync groups State -> Filesystem (/etc/group)
  useEffect(() => {
    const groupContent = formatGroup(groups);

    setFileSystem(prevFS => {
      const newFS = deepCloneFileSystem(prevFS);
      const etc = newFS.children?.find(c => c.name === 'etc');
      if (etc && etc.children) {
        let groupFile = etc.children.find(c => c.name === 'group');
        if (!groupFile) {
          groupFile = { id: crypto.randomUUID(), name: 'group', type: 'file', content: '', owner: 'root', permissions: '-rw-r--r--' };
          etc.children.push(groupFile);
        }

        if (groupFile.content !== groupContent) {
          groupFile.content = groupContent;
          groupFile.modified = new Date();
          return newFS;
        }
      }
      return prevFS;
    });
  }, [groups]);

  // Persist filesystem changes to localStorage (Debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveFileSystem(fileSystem);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [fileSystem]);

  // Resolve ~ and . and .. in paths
  const resolvePath = useCallback((path: string): string => {
    let resolved = path.replace(/^~/, homePath);
    const userDirs = ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos'];
    for (const dir of userDirs) {
      if (resolved.startsWith(`/${dir}`)) {
        resolved = resolved.replace(`/${dir}`, `${homePath}/${dir}`);
        break;
      }
    }
    if (!resolved.startsWith('/')) {
      resolved = currentPath + '/' + resolved;
    }
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
    localStorage.removeItem(USERS_STORAGE_KEY);
    localStorage.removeItem(GROUPS_STORAGE_KEY);
    setFileSystem(deepCloneFileSystem(initialFileSystem));
    setUsers(DEFAULT_USERS);
    setGroups(DEFAULT_GROUPS);
    setCurrentUser(null);
    notify.system('success', 'System', 'System reset to factory defaults');
  }, []);

  const getNodeAtPath = useCallback((path: string): FileNode | null => {
    const resolved = resolvePath(path);
    if (resolved === '/') return fileSystem;
    const parts = resolved.split('/').filter(p => p);
    let current: FileNode | null = fileSystem;
    for (const part of parts) {
      if (!current || current.type !== 'directory' || !current.children) return null;
      if (!checkPermissions(current, userObj, 'execute')) return null;
      current = current.children.find(child => child.name === part) || null;
    }
    return current;
  }, [fileSystem, resolvePath, userObj]);

  const listDirectory = useCallback((path: string): FileNode[] | null => {
    const node = getNodeAtPath(path);
    if (!node || node.type !== 'directory') return null;
    if (!checkPermissions(node, userObj, 'read')) {
      notify.system('error', 'Permission Denied', `Cannot open directory ${node.name}: Permission denied`);
      return null;
    }
    return node.children || [];
  }, [getNodeAtPath, userObj]);

  const readFile = useCallback((path: string): string | null => {
    const node = getNodeAtPath(path);
    if (!node || node.type !== 'file') return null;
    if (!checkPermissions(node, userObj, 'read')) {
      notify.system('error', 'Permission Denied', `Cannot read file ${node.name}: Permission denied`);
      return null;
    }
    return node.content || '';
  }, [getNodeAtPath, userObj]);

  const deleteNode = useCallback((path: string): boolean => {
    const resolved = resolvePath(path);
    if (resolved === '/') return false;
    const parts = resolved.split('/').filter(p => p);
    const name = parts.pop();
    if (!name) return false;
    const parentPath = resolved.substring(0, resolved.lastIndexOf('/')) || '/';
    const parentNode = getNodeAtPath(parentPath);
    if (!parentNode) return false;
    if (!checkPermissions(parentNode, userObj, 'write')) {
      notify.system('error', 'Permission Denied', `Cannot delete ${name}: Permission denied`);
      return false;
    }
    const targetNode = parentNode.children?.find(c => c.name === name);
    if (!targetNode) return false;
    const perms = parentNode.permissions || '';
    const isSticky = perms.endsWith('t') || perms.endsWith('T');
    if (isSticky) {
      const isOwnerOfFile = targetNode.owner === currentUser;
      const isOwnerOfParent = parentNode.owner === currentUser;
      if (!isOwnerOfFile && !isOwnerOfParent && currentUser !== 'root') {
        notify.system('error', 'Permission Denied', `Sticky bit constraint: You can only delete your own files in ${parentNode.name}`);
        return false;
      }
    }
    setFileSystem(prevFS => {
      const newFS = deepCloneFileSystem(prevFS);
      let parent = newFS;
      for (const part of parts) {
        if (parent.children) parent = parent.children.find((child: FileNode) => child.name === part)!;
      }
      if (parent && parent.children) parent.children = parent.children.filter((child: FileNode) => child.name !== name);
      return newFS;
    });
    return true;
  }, [resolvePath, getNodeAtPath, userObj, currentUser]);

  const moveNode = useCallback((fromPath: string, toPath: string): boolean => {
    const resolvedFrom = resolvePath(fromPath);
    const resolvedTo = resolvePath(toPath);
    const node = getNodeAtPath(resolvedFrom);
    if (!node) return false;
    const sourceParentPath = resolvedFrom.substring(0, resolvedFrom.lastIndexOf('/')) || '/';
    const sourceParent = getNodeAtPath(sourceParentPath);
    if (!sourceParent || !checkPermissions(sourceParent, userObj, 'write')) {
      notify.system('error', 'Permission Denied', `Cannot move from ${sourceParentPath}`);
      return false;
    }
    const nodeToMove = deepCloneFileNode(node);
    const toParts = resolvedTo.split('/').filter(p => p);
    const newName = toParts.pop();
    const parentPath = '/' + toParts.join('/');
    if (!newName) return false;
    const destParent = getNodeAtPath(parentPath);
    if (!destParent || destParent.type !== 'directory' || !destParent.children) return false;
    if (!checkPermissions(destParent, userObj, 'write')) {
      notify.system('error', 'Permission Denied', `Cannot move to ${parentPath}`);
      return false;
    }
    if (destParent.children.some(child => child.name === newName)) return false;
    const deleteSuccess = deleteNode(resolvedFrom);
    if (!deleteSuccess) return false;
    nodeToMove.name = newName;
    setFileSystem(prevFS => {
      const newFS = deepCloneFileSystem(prevFS);
      const parts = parentPath.split('/').filter(p => p);
      let current = newFS;
      for (const part of parts) {
        if (current.children) current = current.children.find(child => child.name === part)!;
      }
      if (current && current.children) current.children.push(nodeToMove);
      return newFS;
    });
    return true;
  }, [getNodeAtPath, deleteNode, resolvePath, userObj]);

  const moveNodeById = useCallback((id: string, destParentPath: string): boolean => {
    const result = findNodeAndParent(fileSystem, id);
    if (!result) return false;
    const { node: nodeToMove, parent: sourceParent } = result;
    const destParent = getNodeAtPath(resolvePath(destParentPath));
    if (!checkPermissions(sourceParent, userObj, 'write')) {
      notify.system('error', 'Permission Denied', `Cannot move from ${sourceParent.name}`);
      return false;
    }
    if (!destParent || destParent.type !== 'directory' || !destParent.children) return false;
    if (!checkPermissions(destParent, userObj, 'write')) {
      notify.system('error', 'Permission Denied', `Cannot move to ${destParent.name}`);
      return false;
    }
    if (nodeToMove.id === destParent.id) return false;
    if (isDescendant(nodeToMove, destParent.id)) return false;
    if (destParent.children.some(child => child.name === nodeToMove.name)) return false;

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
  }, [fileSystem, resolvePath, getNodeAtPath, userObj]);

  const moveToTrash = useCallback((path: string): boolean => {
    const resolved = resolvePath(path);
    const trashPath = resolvePath('~/.Trash');
    if (resolved.startsWith(trashPath)) return deleteNode(path);
    const fileName = resolved.split('/').pop();
    if (!fileName) return false;
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
      const trashPath = resolvePath('~/.Trash');
      const parts = trashPath.split('/').filter(p => p);
      let current = newFS;
      for (const part of parts) {
        if (current.children) {
          const found = current.children.find(c => c.name === part);
          if (found) current = found;
          else return newFS;
        }
      }
      if (current && current.children) current.children = [];
      return newFS;
    });
  }, [resolvePath]);

  const createFile = useCallback((path: string, name: string, content: string = ''): boolean => {
    const resolved = resolvePath(path);
    const node = getNodeAtPath(resolved);
    if (!node || node.type !== 'directory' || !node.children) return false;
    if (!checkPermissions(node, userObj, 'write')) {
      notify.system('error', 'Permission Denied', `Cannot create file in ${resolved}`);
      return false;
    }
    if (node.children.some(child => child.name === name)) return false;
    const newFile: FileNode = {
      id: crypto.randomUUID(),
      name,
      type: 'file',
      content,
      size: content.length,
      modified: new Date(),
      owner: currentUser || 'root',
      permissions: '-rw-r--r--',
    };
    setFileSystem(prevFS => {
      const newFS = deepCloneFileSystem(prevFS);
      const parts = resolved.split('/').filter(p => p);
      let current = newFS;
      for (const part of parts) {
        if (current.children) current = current.children.find(child => child.name === part)!;
      }
      if (current && current.children) current.children.push(newFile);
      return newFS;
    });
    return true;
  }, [getNodeAtPath, resolvePath, currentUser, userObj]);

  const createDirectory = useCallback((path: string, name: string): boolean => {
    const resolved = resolvePath(path);
    const node = getNodeAtPath(resolved);
    if (!node || node.type !== 'directory' || !node.children) return false;
    if (!checkPermissions(node, userObj, 'write')) {
      notify.system('error', 'Permission Denied', `Cannot create directory in ${resolved}`);
      return false;
    }
    if (node.children.some(child => child.name === name)) return false;
    const newDir: FileNode = {
      id: crypto.randomUUID(),
      name,
      type: 'directory',
      children: [],
      modified: new Date(),
      owner: currentUser || 'root',
      permissions: 'drwxr-xr-x',
    };
    setFileSystem(prevFS => {
      const newFS = deepCloneFileSystem(prevFS);
      const parts = resolved.split('/').filter(p => p);
      let current = newFS;
      for (const part of parts) {
        if (current.children) current = current.children.find(child => child.name === part)!;
      }
      if (current && current.children) current.children.push(newDir);
      return newFS;
    });
    return true;
  }, [getNodeAtPath, resolvePath, currentUser, userObj]);

  const writeFile = useCallback((path: string, content: string): boolean => {
    const resolved = resolvePath(path);
    const node = getNodeAtPath(resolved);
    if (node) {
      if (!checkPermissions(node, userObj, 'write')) {
        notify.system('error', 'Permission Denied', `Cannot write to ${resolved}`);
        return false;
      }
    }
    setFileSystem(prevFS => {
      const newFS = deepCloneFileSystem(prevFS);
      const parts = resolved.split('/').filter(p => p);
      let current = newFS;
      for (let i = 0; i < parts.length - 1; i++) {
        if (current.children) current = current.children.find((child: FileNode) => child.name === parts[i])!;
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

    if (resolved === '/etc/passwd') {
      try {
        const parsedUsers = parsePasswd(content);
        if (JSON.stringify(parsedUsers) !== JSON.stringify(users)) setUsers(parsedUsers);
      } catch (e) {
        console.error('Failed to parse /etc/passwd update:', e);
      }
    }
    if (resolved === '/etc/group') {
      try {
        const parsedGroups = parseGroup(content);
        if (JSON.stringify(parsedGroups) !== JSON.stringify(groups)) setGroups(parsedGroups);
      } catch (e) {
        console.error('Failed to parse /etc/group update:', e);
      }
    }

    return true;
  }, [resolvePath, users, groups, getNodeAtPath, userObj]);

  const addUser = useCallback((username: string, fullName: string, password?: string): boolean => {
    if (users.some(u => u.username === username)) return false;
    const maxUid = Math.max(...users.map(u => u.uid));
    const newUid = maxUid < 1000 ? 1000 : maxUid + 1;
    const newUser: User = {
      username,
      password: password || 'x',
      uid: newUid,
      gid: newUid,
      fullName,
      homeDir: `/home/${username}`,
      shell: '/bin/bash'
    };
    setUsers(prev => [...prev, newUser]);
    const homeNode = ensureIds(createUserHome(username));
    setFileSystem(prevFS => {
      const newFS = deepCloneFileSystem(prevFS);
      let homeDir = newFS.children?.find(c => c.name === 'home');
      if (!homeDir) {
        homeDir = { id: crypto.randomUUID(), name: 'home', type: 'directory', children: [], owner: 'root', permissions: 'drwxr-xr-x' };
        if (newFS.children) newFS.children.push(homeDir);
        else newFS.children = [homeDir];
      }
      if (homeDir && homeDir.children) {
        if (!homeDir.children.some(c => c.name === username)) homeDir.children.push(homeNode);
      }
      return newFS;
    });
    return true;
  }, [users]);

  const deleteUser = useCallback((username: string): boolean => {
    if (username === 'root' || username === 'user') {
      notify.system('error', 'User Management', 'Cannot delete default system users');
      return false;
    }
    const target = users.find(u => u.username === username);
    if (!target) return false;
    setUsers(prev => prev.filter(u => u.username !== username));
    return true;
  }, [users]);

  const addGroup = useCallback((groupName: string, members: string[] = []): boolean => {
    if (groups.some(g => g.groupName === groupName)) return false;
    const maxGid = Math.max(...groups.map(g => g.gid));
    const newGid = maxGid < 100 ? 100 : maxGid + 1;
    const newGroup: Group = {
      groupName,
      gid: newGid,
      members: members,
      password: 'x'
    };
    setGroups(prev => [...prev, newGroup]);
    return true;
  }, [groups]);

  const deleteGroup = useCallback((groupName: string): boolean => {
    if (['root', 'users', 'admin'].includes(groupName)) {
      notify.system('error', 'Group Management', 'Cannot delete system group');
      return false;
    }
    if (!groups.some(g => g.groupName === groupName)) return false;
    setGroups(prev => prev.filter(g => g.groupName !== groupName));
    return true;
  }, [groups]);

  const chmod = useCallback((path: string, mode: string): boolean => {
    const resolved = resolvePath(path);
    const node = getNodeAtPath(resolved);
    if (!node) return false;

    // Only owner or root can chmod
    if (currentUser !== 'root' && node.owner !== currentUser) {
      notify.system('error', 'Permission Denied', 'Operation not permitted');
      return false;
    }

    // Convert mode if numeric
    let newPerms = node.permissions || (node.type === 'directory' ? 'drwxr-xr-x' : '-rw-r--r--');
    if (/^[0-7]{3}$/.test(mode)) {
      newPerms = octalToPermissions(mode, node.type);
    } else if (mode.length === 10) {
      newPerms = mode; // direct
    } else {
      // invalid mode?
      return false;
    }

    setFileSystem(prevFS => {
      const newFS = deepCloneFileSystem(prevFS);
      const parts = resolved.split('/').filter(p => p);
      let current = newFS;
      for (const part of parts) {
        if (current.children) current = current.children.find(child => child.name === part)!;
      }
      if (current) current.permissions = newPerms;
      return newFS;
    });

    return true;
  }, [resolvePath, getNodeAtPath, currentUser]);

  const chown = useCallback((path: string, owner: string, group?: string): boolean => {
    const resolved = resolvePath(path);
    const node = getNodeAtPath(resolved);
    if (!node) return false;

    // Only root can chown (strict)
    if (currentUser !== 'root') {
      notify.system('error', 'Permission Denied', 'Operation not permitted');
      return false;
    }

    setFileSystem(prevFS => {
      const newFS = deepCloneFileSystem(prevFS);
      const parts = resolved.split('/').filter(p => p);
      let current = newFS;
      for (const part of parts) {
        if (current.children) current = current.children.find(child => child.name === part)!;
      }
      if (current) {
        if (owner) current.owner = owner;
        if (group) current.group = group;
      }
      return newFS;
    });
    return true;
  }, [resolvePath, getNodeAtPath, currentUser]);

  return (
    <FileSystemContext.Provider
      value={{
        fileSystem,
        currentPath,
        currentUser,
        users,
        homePath,
        setCurrentPath,
        getNodeAtPath,
        createFile,
        createDirectory,
        deleteNode,
        addUser,
        deleteUser,
        writeFile,
        readFile,
        listDirectory,
        moveNode,
        moveNodeById,
        moveToTrash,
        emptyTrash,
        resolvePath,
        resetFileSystem,
        login,
        logout,
        chmod,
        chown,
        groups,
        addGroup,
        deleteGroup
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
