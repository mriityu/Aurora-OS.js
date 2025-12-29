import { useState, useMemo } from 'react';
import { IntroSequence } from './IntroSequence';
import { MainMenu } from './MainMenu';
import { BootSequence } from './BootSequence';
import { useFileSystem } from '../../components/FileSystemContext';
import { useAppContext } from '../../components/AppContext';

import { STORAGE_KEYS } from '../../utils/memory';
import { updateStoredVersion } from '../../utils/migrations';

// The "Actual Game" being played is passed as children (The OS Desktop)
interface GameRootProps {
    children: React.ReactNode;
}

type GameState = 'INTRO' | 'MENU' | 'BOOT' | 'GAMEPLAY';

export function GameRoot({ children }: GameRootProps) {
    const [gameState, setGameState] = useState<GameState>('INTRO'); // Default to INTRO
    const { resetFileSystem } = useFileSystem();
    const { setIsLocked } = useAppContext();

    // Check for save data
    const hasSave = useMemo(() => {
        return !!localStorage.getItem(STORAGE_KEYS.VERSION);
    }, []);

    const handleNewGame = () => {
        if (confirm('Start New Game? This will wipe all existing data.')) {
            resetFileSystem();
            updateStoredVersion(); // Mark session as valid
            setIsLocked(false);
            // Wiping filesystem clears users, so currentUser becomes null.
            // AppContent will render LoginScreen because currentUser is null.
            setGameState('BOOT');
        }
    };

    const handleContinue = () => {
        // Force lock so that even if a user is remembered, we show the Login Screen
        setIsLocked(true);
        setGameState('BOOT');
    };

    // Override: If user refreshes page during gameplay, should we go back to menu?
    // User requested "Video Game Flow". Usually games go to intro/menu on refresh.
    // So default behavior is correct.

    switch (gameState) {
        case 'INTRO':
            return <IntroSequence onComplete={() => setGameState('MENU')} />;

        case 'MENU':
            return (
                <MainMenu
                    onNewGame={handleNewGame}
                    onContinue={handleContinue}
                    canContinue={hasSave}
                />
            );

        case 'BOOT':
            return <BootSequence onComplete={() => setGameState('GAMEPLAY')} />;

        case 'GAMEPLAY':
            return (
                <div className="fixed inset-0 w-full h-full bg-black">
                    {/* Add an "ESC" menu listener here if we want a pause menu? */}
                    {children}
                </div>
            );

        default:
            return null;
    }
}
