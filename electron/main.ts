import { app, BrowserWindow, shell, ipcMain, screen } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// @ts-ignore - types are defined in electron-env.d.ts but often missed by IDE
import squirrelStartup from 'electron-squirrel-startup';
import si from 'systeminformation';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Settings Persistence
const SETTINGS_PATH = path.join(app.getPath('userData'), 'display-settings.json');

interface DisplaySettings {
    mode: 'fullscreen' | 'borderless' | 'windowed';
    width: number;
    height: number;
    frame: boolean;
}

const DEFAULT_SETTINGS: DisplaySettings = {
    mode: 'fullscreen',
    width: 1920,
    height: 1080,
    frame: false
};

function loadSettings(): DisplaySettings {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
        }
    } catch (e) {
        console.error('Failed to load display settings:', e);
    }
    return DEFAULT_SETTINGS;
}

function saveSettings(settings: DisplaySettings) {
    try {
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    } catch (e) {
        console.error('Failed to save display settings:', e);
    }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (squirrelStartup) {
    app.quit();
}

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception in Main Process:', error);
});


// Flag to prevent app quit when recreating window
let isRecreatingWindow = false;

let mainWindow: BrowserWindow | null = null;
let currentSettings = loadSettings();

function createWindow() {
    // Create the browser window with initial settings
    mainWindow = new BrowserWindow({
        width: currentSettings.width,
        height: currentSettings.height,
        minWidth: 1024,
        minHeight: 768,
        show: false,
        frame: currentSettings.mode === 'windowed' ? currentSettings.frame : false,
        transparent: currentSettings.mode !== 'windowed' || !currentSettings.frame,
        useContentSize: currentSettings.mode === 'windowed',
        backgroundColor: '#000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false, // Required for ESM preload to work with imports
        },
    });

    applyDisplaySettings(currentSettings);

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    // Development or Production
    if (process.env.VITE_DEV_SERVER_URL) {
        process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'; // Suppress "Insecure CSP" warning in dev
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:')) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });

    // --- SECURITY HARDENING ---
    if (!process.env.VITE_DEV_SERVER_URL) {
        mainWindow.webContents.on('devtools-opened', () => {
            mainWindow?.webContents.closeDevTools();
        });

        mainWindow.webContents.on('before-input-event', (event, input) => {
            if (input.control && input.shift && input.key.toLowerCase() === 'i') event.preventDefault();
            if (input.key === 'F12') event.preventDefault();
        });
    }

    // --- FULLSCREEN EVENTS ---
    mainWindow.on('enter-full-screen', () => {
        mainWindow?.webContents.send('display-change', { ...currentSettings, mode: 'fullscreen' });
    });

    mainWindow.on('leave-full-screen', () => {
        // When leaving native fullscreen (e.g. Esc key), sync the state
        // We use a small delay to ensure isMaximized() is accurate and 
        // doesn't fight with explicit applyDisplaySettings calls.
        setTimeout(() => {
            if (mainWindow && currentSettings.mode === 'fullscreen') {
                const isMax = mainWindow.isMaximized();
                currentSettings.mode = isMax ? 'borderless' : 'windowed';
                mainWindow.webContents.send('display-change', currentSettings);
                saveSettings(currentSettings);
            }
        }, 100);
    });
}

function applyDisplaySettings(settings: DisplaySettings) {
    if (!mainWindow) return;

    currentSettings = settings;
    saveSettings(settings);

    // Reset properties to avoid conflicts
    mainWindow.setMovable(true);
    mainWindow.setResizable(true);

    if (settings.mode === 'fullscreen') {
        mainWindow.setFullScreen(true);
    } else if (settings.mode === 'borderless') {
        if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
        mainWindow.setMenuBarVisibility(false);
        mainWindow.maximize();
    } else if (settings.mode === 'windowed') {
        if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
        if (mainWindow.isMaximized()) mainWindow.unmaximize();

        // setContentSize/setSize might be unreliable for frameless windows on some platforms
        if (settings.frame) {
            mainWindow.setContentSize(settings.width, settings.height);
            mainWindow.center();
        } else {
            // Force update with setBounds to ensure it resizes correctly even if it was full width
            const display = screen.getDisplayMatching(mainWindow.getBounds());
            const x = display.bounds.x + Math.round((display.bounds.width - settings.width) / 2);
            const y = display.bounds.y + Math.round((display.bounds.height - settings.height) / 2);

            mainWindow.setBounds({ x, y, width: settings.width, height: settings.height });
        }
    }

    // Notify renderer
    mainWindow.webContents.send('display-change', currentSettings);
}

// IPC Handlers
ipcMain.handle('get-locale', () => app.getLocale());

ipcMain.handle('get-battery', async () => {
    try {
        return await si.battery();
    } catch (error) {
        return null;
    }
});

ipcMain.handle('get-display-settings', () => currentSettings);

ipcMain.handle('set-display-settings', (event, settings: DisplaySettings) => {
    // If frame change is requested, we might need a restart or complex logic.
    // For now, let's focus on mode and resolution.
    if (mainWindow) {
        // If changing frame, we reload the app/window for simplicity (typical for BIOS)
        // We only need to rebuild if the 'frame' property actually changes.
        // Fullscreen, Borderless, and Windowed (No Frame) all effectively have frame: false.
        // Only Windowed (Frame) has frame: true.
        const willBeFrame = settings.mode === 'windowed' ? settings.frame : false;
        const wasFrame = currentSettings.mode === 'windowed' ? currentSettings.frame : false;

        const needsRebuild = willBeFrame !== wasFrame;

        if (needsRebuild) {
            currentSettings = settings;
            saveSettings(settings);

            // Set flag to prevent app quit
            isRecreatingWindow = true;

            // In dev mode, app.relaunch() kills the process monitored by 'concurrently',
            // causing the whole dev server to exit. We should just recreate the window instead.
            if (mainWindow) {
                mainWindow.removeAllListeners();
                mainWindow.destroy();
                mainWindow = null;
            }
            createWindow();
            isRecreatingWindow = false;
        } else {
            applyDisplaySettings(settings);
        }
    }
    return true;
});

// OS specific behaviors
app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (!isRecreatingWindow && process.platform !== 'darwin') {
        app.quit();
    }
});
