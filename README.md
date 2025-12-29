# Aurora OS.js [![Version](https://img.shields.io/badge/Version-v0.7.2_patch4-blue)](https://github.com/mental-os/Aurora-OS.js) [![GitHub Pages](https://github.com/mental-os/Aurora-OS.js/actions/workflows/deploy.yml/badge.svg)](https://github.com/mental-os/Aurora-OS.js/actions/workflows/deploy.yml) [![Dependabot](https://github.com/mental-os/Aurora-OS.js/actions/workflows/dependabot/dependabot-updates/badge.svg)](https://github.com/mental-os/Aurora-OS.js/actions/workflows/dependabot/dependabot-updates) [![Build](https://github.com/mental-os/Aurora-OS.js/actions/workflows/ci.yml/badge.svg)](https://github.com/mental-os/Aurora-OS.js/actions/workflows/ci.yml)

A modern, web-based desktop operating system interface built with React, Tailwind CSS, and Radix UI.

## Features

- **Project Integrity**: Built-in identity validation ("Safe Mode" degradation on tampering) and hidden attribution ("Insurance Policy").
- **Desktop Environment**: Windows 11-inspired grid layout, multi-select drag-and-drop, and fluid window management with snap-like behavior.
- **Window Management**: Minimize, maximize, close, and focus management with preserved state and independent navigation.
- **Virtual Filesystem**: Complete in-memory Linux-style filesystem (`/bin`, `/etc`, `/home`, etc.) with permissions (Owner/Group/Others, Sticky Bit) and persistent storage.
- **User Management**: Multi-user support with bidirectional `/etc/passwd` syncing and dedicated Settings panel.
- **App Ecosystem**:
  - **Finder**: Full-featured file manager with breadcrumbs navigation, drag-and-drop file moving, and list/grid views.
  - **Terminal**: Zsh-like experience with autocomplete, command history, pipe support, stealth commands, and ability to launch GUI apps (`Finder /home`).
  - **Settings**: System control panel for Appearance (Accent Colors, Themes), Performance (Motion/Shadows), and Data Management (Soft/Hard Reset).
  - **Browser**: Functional web browser simulation with bookmarks, history, and tab management.
  - **Media**: Interactive Music, Messages, and Photos apps demonstrating UI patterns.
- **Security & Performance**:
  - **Content Security Policy**: Strict CSP preventing XSS and `eval` execution in production.
  - **Debounced Persistence**: Efficiently saves state to localStorage without UI freezing.
  - **Native Integration**: Electron support with native window frame options and shell integration.
- **Customization**:
  - **Theming**: "2025" Color Palette with dynamic Neutral, Shades, and Contrast modes.
  - **Accessibility**: Reduce Motion and Disable Shadows options for lower-end devices.

## Tech Stack

- **Framework**: React 19 (Vite 7)
- **Styling**: Tailwind CSS
- **UI Primitives**: Radix UI
- **Icons**: Lucide React
- **Animation**: Motion (Framer Motion)
- **Testing**: Vitest

## Getting Started

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Start the development server:
    ```bash
    npm run dev
    ```

3.  Build for production:
    ```bash
    npm run build
    ```

### Testing
This project uses **Vitest** for unit & integration testing.
```bash
npm test
```

## Release Notes

### v0.7.3
- **Boot Generation Engine**:
    - **Dynamic Parsing**: The boot sequence now analyzes `package.json` in real-time to generate authentic log entries based on your actual dependencies (`react`, `framer-motion`, etc.).
    - **Hardware Probing**: Integrated `hardware.ts` to safe-probe the host machine, displaying real CPU core counts, RAM, and specific GPU models (e.g., "Apple M1", "NVIDIA RTX") in the logs.
    - **Variable Speed**: Implemented non-linear log scrolling logic to simulate realistic processing delays and network bursts.
- **System Integrity**:
    - **Secure Boot**: Integrated `integrity.ts` into the startup flow to verify the "Distributor" identity against the signed codebase.
    - **Visual Feedback**: Boot logs now strictly adhere to the "Mental OS" palette (Cyan `SECURE` / Pink `WARNING`) instead of generic rainbow colors.
    - **Identity**: Added support for a custom `"nickname"` field in `package.json` to display hacker aliases in the boot logs.
- **Documentation**:
    - **Definitive Reference**: Completely rewrote `CODEBASE_DOCUMENTATION.md` into a file-by-file technical manual.
    - **Restoration**: Restored detailed TypeScript interfaces and function signatures for all utilities, hooks, and services.
- **Architecture**:
    - **Lazy Loading**: The core `OS` component is now lazily loaded to prioritize the Boot Sequence performance.
    - **Robustness**: Implemented defensive error boundaries and type-safety fixes for the hardware probing logic.

[View full version history](HISTORY.md)

# License & Others

- **Licensed as**: [AGPL-3.0e](LICENSE)
- **AI Disclosure**: This project, "Aurora OS," is human-written, with AI tools assisting in documentation, GitHub integrations, bug testing, and roadmap tracking.

# Community
Soon
