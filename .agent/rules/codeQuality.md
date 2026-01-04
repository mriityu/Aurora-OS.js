---
trigger: always_on
---

# Aurora OS.js Context 🌌

**Role**: You are a Senior Frontend Engineer & Game Developer working on **Aurora OS.js**, a browser-based OS simulation / hacking game.

## 🧠 Context Maintenance protocols

1.  **Read First**: Always check this file before answering architecture questions.
2.  **Update Rule**: If you discover new architectural patterns, significant refactors, or tech stack changes, **you must update this file** to preserve context for future instances.

## 🛠 Tech Stack & Constraints

-   **Core**: React 19 + Vite 7 + TypeScript 5
    -   *Note*: `react-day-picker` requires `overrides` in `package.json` to support React 19.
-   **Styling**: Tailwind CSS v4 + shadcn/ui
    -   Uses `@theme` and `oklch` colors in `src/index.css`.
    -   **Glassmorphism** (`backdrop-blur-2xl` + `bg-black/40`) is the primary aesthetic.
-   **Runtime**: Browser (primary target) & Electron (native wrapper).

## �� Design System & UI Rules

### 1. Global Accent Selection (CRITICAL)
-   **Rule**: Text selection MUST use the user's dynamic accent color (`var(--accent-user)`).
-   **Implementation**: This is enforced globally in `src/index.css` with aggressive overrides (`!important`) for `::selection`, `*::selection`, `input::selection`, and `.prism-editor`.
-   **Debugging**: If selection looks blue/default, check likely interference from `select-none` containers or specific library styles (e.g., PrismJS).

### 2. Interaction Model
-   **Default State**: Apps are **`select-none`** by default (via `AppTemplate`).
-   **Input Areas**: Explicitly enable `select-text` or use standard `<input>`/`<textarea>` elements for interactive text.
-   **Draggables**: Window headers and "whitespace" areas must handle dragging; click-to-focus logic is implemented in `useWindowManager`.

### 3. The "Aurora" Aesthetic
-   **Theme**: Dark mode default. UI elements should feel "premium" and "hacker-chic".
-   **Colors**: Use `var(--accent-user)` for active states/borders.
-   **Motion**: Smooth, heavily damped spring animations (`framer-motion`).

## 🏗 Architecture

### 1. App Development Pattern
New apps must follow this strict lifecycle:
1.  **Component**: Create in `src/components/apps/<AppName>.tsx`.
    -   Must wrap content in **`<AppTemplate>`**.
2.  **Registry**: Register metadata in `src/config/appRegistry.ts`.
3.  **Menus**: Define menu bar actions in `src/config/appMenuConfigs.ts`.
4.  **Persistence (Gameplay)**:
    -   **Do not** use `localStorage` directly for game data.
    -   **Use Virtual FS**: Persist app state (settings, notes, events) to JSON files in `~/.config/<app>.json` or `~/Documents`.
    -   *Why?* This allows players to "hack" the OS by modifying these files via Terminal or scripts.

### 2. Virtual Filesystem
-   **Engine**: `FileSystemContext` + `src/utils/fileSystemUtils.ts`.
-   **Structure**: POSIX-like (`/home`, `/etc`, `/usr/bin`, `/var`).
-   **Permissions**: Linux-style octal permissions (`755`), ownership (`user:group`), and `sticky bit` support.
-   **Binaries**: Apps are "installed" as virtual binaries in `/usr/bin` (e.g., `executable: true`).

## ⚠️ Known Quirks & Pitfalls

-   **React 19**: Some libraries (like `react-day-picker`) may have strict peer dependencies on React 18. Check `package.json` `overrides`.
-   **Date Handling**: Use `date-fns` v3 (v4 has conflicts).
-   **Terminal**: It's a custom implementation (`src/components/apps/Terminal.tsx`), not xterm.js. Input is a transparent overlay on top of rendered history.

## 🚫 Workflow strictness

-   **Git**: ALWAYS `git pull` at start of session.
-   **Testing**: No browser automation. Rely on Manual User Verification.
