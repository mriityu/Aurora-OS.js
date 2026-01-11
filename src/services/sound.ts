import { Howl, Howler } from 'howler';
import { STORAGE_KEYS } from '../utils/memory';

// Sound constants
import successSound from '../assets/sounds/warning.wav';
import warningSound from '../assets/sounds/warning.wav';
import errorSound from '../assets/sounds/error.wav';
import folderSound from '../assets/sounds/folder.wav';
import windowOpenSound from '../assets/sounds/window-open.wav';
import windowCloseSound from '../assets/sounds/window-close.wav';
import clickSound from '../assets/sounds/click.wav';
import hoverSound from '../assets/sounds/hover.wav';

const SOUNDS = {
    // System
    success: successSound,
    warning: warningSound,
    error: errorSound,

    // UI
    folder: folderSound,
    'window-open': windowOpenSound,
    'window-close': windowCloseSound,

    // Feedback
    click: clickSound,
    hover: hoverSound,
};

type SoundType = keyof typeof SOUNDS;

// Define sound categories
export type SoundCategory = 'master' | 'system' | 'ui' | 'feedback' | 'music';

const SOUND_CATEGORIES: Record<SoundType, Exclude<SoundCategory, 'master' | 'music'>> = {
    success: 'system',
    warning: 'system',
    error: 'system',
    folder: 'ui',
    'window-open': 'ui',
    'window-close': 'ui',
    click: 'feedback',
    hover: 'feedback',
};

interface VolumeState {
    master: number;
    system: number;
    ui: number;
    feedback: number;
    music: number;
}

const DEFAULT_VOLUMES: VolumeState = {
    master: 0.75,
    system: 1,
    ui: 0.5,
    feedback: 0.25,
    music: 0.75,
};

const STORAGE_KEY = STORAGE_KEYS.SOUND;

class SoundManager {
    private static instance: SoundManager;
    private sounds: Partial<Record<SoundType, Howl>> = {};
    private volumes: VolumeState;
    private listeners: Set<() => void> = new Set();
    private isMuted: boolean = false;

    private constructor() {
        this.volumes = this.loadSettings();
        this.initializeSounds();
    }

    public static getInstance(): SoundManager {
        if (!SoundManager.instance) {
            SoundManager.instance = new SoundManager();
        }
        return SoundManager.instance;
    }

    private loadSettings(): VolumeState {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                return { ...DEFAULT_VOLUMES, ...JSON.parse(stored) };
            }
        } catch (e) {
            console.warn('Failed to load sound settings:', e);
        }
        return { ...DEFAULT_VOLUMES };
    }

    private saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.volumes));
        } catch (e) {
            console.warn('Failed to save sound settings:', e);
        }
    }

    private initializeSounds() {
        // Initialize sounds with base config
        // Note: Real volume is calculated at play time to allow real-time adjustment
        Object.entries(SOUNDS).forEach(([key, src]) => {
            this.sounds[key as SoundType] = new Howl({
                src: [src],
                preload: true,
            });
        });
    }

    public play(type: SoundType) {
        if (this.isMuted || this.volumes.master === 0) return;

        const sound = this.sounds[type];
        if (sound) {
            const category = SOUND_CATEGORIES[type];
            const categoryVolume = this.volumes[category];

            if (categoryVolume > 0) {
                // Howler volume is 0.0 - 1.0
                // Calculate final volume: Master * Category
                const finalVolume = this.volumes.master * categoryVolume;
                sound.volume(finalVolume);
                sound.play();
            }
        }
    }

    public setVolume(category: SoundCategory, value: number) {
        this.volumes[category] = Math.max(0, Math.min(1, value));
        this.saveSettings();
        this.notifyListeners();
    }

    public getVolume(category: SoundCategory): number {
        return this.volumes[category];
    }

    public setMute(muted: boolean) {
        this.isMuted = muted;
        Howler.mute(muted);
        this.notifyListeners();
    }

    public getMuted(): boolean {
        return this.isMuted;
    }

    public subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener());
    }
}

export const soundManager = SoundManager.getInstance();
