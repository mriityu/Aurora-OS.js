import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from './App';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Mock ResizeObserver
class ResizeObserverMock {
    observe() { }
    unobserve() { }
    disconnect() { }
}
window.ResizeObserver = ResizeObserverMock;

// Mock motion/react
vi.mock('motion/react', () => ({
    motion: {

        div: ({ children, ...props }: any) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { initial, animate, exit, transition, whileHover, whileTap, ...validProps } = props;
            return <div {...validProps}>{children}</div>;
        },

        button: ({ children, ...props }: any) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { initial, animate, exit, transition, whileHover, whileTap, ...validProps } = props;
            return <button {...validProps}>{children}</button>;
        },
    },

    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('Aurora OS Integration', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    it('boots and renders the Dock', () => {
        render(<App />);

        // Verify Dock buttons are present
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);

        const finder = buttons.find(b => b.getAttribute('aria-label') === 'Finder');
        expect(finder).toBeInTheDocument();

        const trash = buttons.find(b => b.getAttribute('aria-label') === 'Trash');
        expect(trash).toBeInTheDocument();
    });

    it('loads persistence data on boot', () => {
        render(<App />);
        expect(localStorageMock.getItem).toHaveBeenCalledWith('aurora-os-settings');
        expect(localStorageMock.getItem).toHaveBeenCalledWith('aurora-filesystem');
    });
});
