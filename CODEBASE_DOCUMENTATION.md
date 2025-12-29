# Aurora OS Codebase Documentation

This document serves as the authoritative technical reference for the Aurora OS project. It details the custom logic, components, and utilities implemented in the codebase, organized by directory and file path.

---

## 1. System Utilities (`src/utils`)

### `src/utils/integrity.ts`
**Purpose**: Implements the "Anti-Cheat" and System Identity verification logic.

```typescript
// Constants
const EXPECTED_IDENTITY = { 
    name: 'aurora-os-js', 
    author: 'Cătălin-Robert Drăgoiu', 
    license: 'AGPL-3.0' 
};

// Exports
export function validateIntegrity(): boolean;
/**
 * Verifies critical project metadata against package.json to detect tampering.
 * Checks for a 'DEV_BYPASS' key in localStorage to allow authorized overrides.
 * Returns `true` if secure, `false` if corrupted/tampered.
 */

export function getSystemHealth(): 'OK' | 'CORRUPTED';
/**
 * Wrapper for UI components to get a simple status string.
 */
```

### `src/utils/hardware.ts`
**Purpose**: Real-time probing of the hosting browser's hardware capabilities for immersive logging.

```typescript
// Interfaces
export interface HardwareInfo {
    cpuCores: number;     // navigator.hardwareConcurrency
    memory?: number;      // navigator.deviceMemory (GiB)
    platform: string;     // navigator.platform
    gpuRenderer: string;  // WebGL UNMASKED_RENDERER_WEBGL
    screenResolution: string;
}

// Exports
export function getHardwareInfo(): HardwareInfo;
/**
 * safely probes the DOM APIs to extract hardware specs.
 * Includes error handling for WebGL context failures.
 */
```

### `src/utils/fileSystemUtils.ts`
**Purpose**: Core definitions and logic for the virtual filesystem.

```typescript
// Core Data Structures
export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  children?: FileNode[];
  permissions?: string; // 'rwxr-xr-x'
  owner?: string;
  group?: string;
  size?: number;
  modified?: Date;
}

export interface User {
  username: string;
  password?: string;
  uid: number;
  gid: number;
  fullName: string;
  homeDir: string;
  shell: string;
  groups?: string[];
}

export interface Group {
  groupName: string;
  password?: string;
  gid: number;
  members: string[]; // usernames
}

// Functions
export function checkPermissions(node: FileNode, user: User, op: 'read'|'write'|'execute'): boolean;
/** Implements Linux-style permission enforcement (rwx). Checks Owner, Group, and Others bits. */

export function createUserHome(username: string): FileNode;
/** Generates a standard home directory structure (Desktop, Documents, .Config, etc.). */

export function deepCloneFileSystem(root: FileNode): FileNode;
/** Deep clones the filesystem tree and ensures all nodes have IDs. Used for immutable state updates. */

export function parsePasswd(content: string): User[];
export function formatPasswd(users: User[]): string;
/** Logic to sync User objects with the textual content of /etc/passwd. */

export function moveNodeById(id: string, destPath: string): boolean;
/** Securely moves a node to a new destination by ID. Enforces permissions and prevents cyclic directory moves. */
```

### `src/utils/memory.ts`
**Purpose**: Storage persistence and reset logic.

```typescript
// Exports
export function softReset(): void;
/** Clears "Soft Memory" (Preferences, Desktop Icons, Sound Settings). Safe to run. */

export function hardReset(): void;
/** Full factory wipe. Clears filesystem, users, and all settings. Reloads window. */

export function getStorageStats(): { softMemory: Stats, hardMemory: Stats, total: Stats };
/** Calculates byte usage for storage tiers. */

export function hasSavedSession(username: string): boolean;
/** Checks if a user has active window state in memory. */

export function clearSession(username: string): void;
/** Clears the suspended session data for a specific user. */
```

### `src/utils/gridSystem.ts`
**Purpose**: Desktop icon placement and auto-arrangement logic.

```typescript
export interface GridConfig { 
    cellWidth: number; 
    cellHeight: number; 
    startX: number; 
    startY: number; 
    // ...
}

export interface GridPosition { col: number; row: number; }

export function getGridConfig(winW: number, winH: number): GridConfig;
/** Calculates grid layout based on window dimensions. */

export function snapToGrid(x: number, y: number, config: GridConfig): {x, y};
/** Aligns pixel coordinates to nearest grid cell center. */

export function findNextFreeCell(occupied: Set<string>, config: GridConfig, height: number): GridPosition;
/** Finds next empty slot filling Top->Bottom, Right->Left. */

export function rearrangeGrid(iconIds: string[], currentPos: Record<string, GridPosition>, ...): Record<string, GridPosition>;
/** Complex logic to shift icons aside when dropping one in between others. */
```

### `src/utils/colors.ts`
**Purpose**: Color manipulation utilities for theming.

```typescript
export function lightenColor(hex: string, percent: number): string;
export function darkenColor(hex: string, percent: number): string;
export function mixColors(color1: string, color2: string, weight: number): string;
/** Blends two colors together. Weight 0-1. */

export function getComplementaryColor(hex: string): string;
/** Returns the opposite color on the color wheel. Used for 'Contrast' theme. */

export function hexToRgb(hex: string): { r, g, b };
export function rgbToHsl(r, g, b): { h, s, l };
export function getColorShades(hex: string): { lightest, light, base, dark, darkest };
```

### `src/utils/migrations.ts`
**Purpose**: Automated migration strategy for backward compatibility.
**Mechanism**:
1.  **Version Tracking**: Checks `package.json` vs `localStorage`.
2.  **Detection**: If mismatch, triggers "Smart Merge".
3.  **Result**: Adds new features/files without overwriting user customizations (unless critical).

---

## 2. Core Hooks (`src/hooks`)

### `src/hooks/fileSystem/` (Modularized Context)
*Replaces the monolithic FileSystemContext.*

*   **`useAuth.ts`**: Manages `currentUser`, `login(user, pass)`, `logout()`, `users[]`, `groups[]`.
*   **`useFileSystemState.ts`**: Manages the `fileSystem` tree state.
*   **`useFileSystemMutations.ts`**:
    *   `writeFile(path, content)`
    *   `createDirectory(path)`
    *   `deleteNode(path)`
    *   `chmod/chown`
*   **`useFileSystemQueries.ts`**:
    *   `readFile(path)`
    *   `readdir(path)`

### `src/hooks/useWindowManager.ts`
**Purpose**: Manages the desktop window stack, Z-indexing, and lifecycle.

```typescript
export function useWindowManager(activeUser: string, contentFactory: Function) {
    return {
        windows: WindowState[], // { id, title, component, isActive, isMinimized, zIndex }
        openWindow: (id: string, params?: any) => void,
        closeWindow: (id: string) => void,
        minimizeWindow: (id: string) => void,
        maximizeWindow: (id: string) => void,
        focusWindow: (id: string) => void, // Brings to front (max z-index)
    };
}
```

### `src/hooks/useTerminalLogic.tsx`
**Purpose**: Headless terminal emulator logic. Used by `Terminal.tsx`.

*   **`interface TerminalCommand`**:
    ```typescript
    {
        name: string;
        description: string;
        usage: string;
        execute: (context: CommandContext) => CommandResult | Promise<CommandResult>;
    }
    ```
*   **Capabilities**:
    *   Command Parsing (`cmd arg1 arg2`).
    *   Output redirection (`>` and `>>`).
    *   History navigation (Arrow keys).
    *   **Session Stack**: Supports `activeTerminalUser[]` for nested `su` sessions.
    *   **Scoped Filesystem**: Wraps operations to enforce specific user permissions.

### `src/hooks/useThemeColors.ts`
**Purpose**: Centralized hook for "Glassmorphism" theme variables.

```typescript
export function useThemeColors() {
    return {
        themeMode: 'neutral' | 'shades' | 'contrast',
        blurEnabled: boolean,
        windowBackground: string, // 'rgba(255,255,255,0.05)' etc.
        blurStyle: CSSProperties, // { backdropFilter: 'blur(12px)' }
        accentColor: string,
        // ... helpers like getBackgroundColor(opacity)
    };
}
```

### `src/hooks/useAppStorage.ts`
**Purpose**: Namespaced persistence hook.
Wraps `localStorage` with `aurora-os-app-${appId}` prefix to prevent collisions between apps.

---

## 3. Core/Game Components (`src/components/Game`)

### `BootSequence.tsx`
**Logic**:
*   **Dynamic Logs**: Imports `package.json` to generate "module loading" logs based on actual project dependencies.
*   **Hardware Integration**: Calls `getHardwareInfo()` to display real CPU/RAM stats.
*   **Integrity Check**: Calls `validateIntegrity()` to verify software identity.

### `IntroSequence.tsx`
**Logic**:
*   Handles the "Power On" button interaction.
*   Initializes the `AudioContext` (required for Howler.js).
*   Triggers the "fan spin" audio and logo animation.

### `LoginScreen.tsx`
**Logic**:
*   **Overlay**: Covers the entire desktop until authenticated.
*   **Quick Resume**: Checks `hasSavedSession()` to offer a "Fast Boot" active session restore.
*   **Authentication**: Validates input against the virtual `/etc/passwd`.
*   **Wrapper**: Renders children (The OS) behind it, creating the "Locked" effect.

---

## 4. Main Architecture (`src/components`)

### `App.tsx`
**Role**: The Root Orchestrator.
*   **Overlay Architecture**: Renders `<OS />` for the active user *behind* the `<LoginScreen />` when `isLocked` is true.
*   **Session State**: Hydrates `WindowState` and `IconPositions` from `localStorage` keyed by `activeUser`.

### `OS.tsx`
**Role**: The Desktop Environment.
*   **Lazy Loaded**: Imported via `React.lazy` to prevent bundle bloat affecting the boot sequence.
*   **Layout**: Renders `Desktop` (Icons), `Dock` (Taskbar), `MenuBar` (Top bar), and `WindowManager` (Windows).

### `FileManager.tsx` (Finder)
**Role**: The primary file explorer.
*   **Security**: Pre-checks `read` and `execute` permissions (`checkPermissions`) before navigating to any folder.
*   **UI**: Implements Sidebar, Breadcrumb navigation, and Grid/List views.

---

## 5. UI Library (`src/components/ui`)

### `GlassButton.tsx`
Standardized button component for the "Mental OS" design system.
```tsx
<GlassButton 
   variant="ghost" | "solid" 
   size="sm" | "md" 
   onClick={...}
>
   {children}
</GlassButton>
```

### `GlassInput.tsx`
Standardized text input with focus rings and translucent background.

### `GameScreenLayout.tsx`
Wrapper for full-screen "immersive" interfaces (Login, Recovery Mode). Handles z-indexing (`50000`) to sit above the desktop.

---

## 6. Services (`src/services`)

### `src/services/sound.ts`
**Singleton**: `SoundManager.getInstance()`
**Purpose**: Centralized audio controller.
```typescript
type SoundType = 'success' | 'warning' | 'error' | 'click' | 'hover' | 'folder' | 'window-open' | 'window-close';
type SoundCategory = 'master' | 'system' | 'ui' | 'feedback';

class SoundManager {
  play(type: SoundType): void
  setVolume(category: SoundCategory, value: number): void
  setMute(muted: boolean): void
}
```

### `src/services/notifications.tsx`
**Exports**: `notify.system(type, source, message)`
**Purpose**: Triggers system toasts (via `sonner`) paired with audio feedback.
```typescript
notify.system('success', 'System', 'Operation completed'); // Plays 'success' sound + Shows Toast
```
