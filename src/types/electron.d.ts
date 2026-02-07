export interface DisplaySettings {
    mode: 'fullscreen' | 'borderless' | 'windowed';
    width: number;
    height: number;
    frame: boolean;
}

export interface IElectronAPI {
    getLocale: () => Promise<string>;
    getBattery: () => Promise<any>;
    getDisplaySettings: () => Promise<DisplaySettings>;
    setDisplaySettings: (settings: DisplaySettings) => Promise<boolean>;
    onDisplayChange: (callback: (settings: DisplaySettings) => void) => () => void;
}

declare global {
    interface Window {
        electron: IElectronAPI;
    }
}

declare module 'electron-squirrel-startup' {
    const squirrelStartup: boolean;
    export default squirrelStartup;
}
