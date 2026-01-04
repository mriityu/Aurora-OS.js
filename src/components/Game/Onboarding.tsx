import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Check, User, Globe, Palette, Loader2 } from "lucide-react";
import { GameScreenLayout } from "./GameScreenLayout";
import { useFileSystem } from "../FileSystemContext";
import { useAppContext } from "../AppContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../ui/card";
import { GlassInput } from "../ui/GlassInput";
import { GlassButton } from "../ui/GlassButton";
import { cn } from "../ui/utils";
import { STORAGE_KEYS } from "../../utils/memory";

import { updateStoredVersion } from "../../utils/migrations";

interface OnboardingProps {
    onContinue: () => void;
}

type Step = "language" | "account" | "theme" | "finishing";

export function Onboarding({ onContinue }: OnboardingProps) {
    const [step, setStep] = useState<Step>("language");
    const { addUser, addUserToGroup } = useFileSystem();
    const { 
        setAccentColor, 
        setThemeMode, 
        accentColor, 
        themeMode,
        switchUser
    } = useAppContext();

    // Step 1: Language
    const [language, setLanguage] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEYS.LANGUAGE) || "en";
        } catch {
            return "en";
        }
    });

    // Auto-save language
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.LANGUAGE, language);
    }, [language]);

    // Step 2: Account
    const [fullName, setFullName] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [hint, setHint] = useState("");
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    const [error, setError] = useState("");

    // Step 3: Theme (Local state for preview, applied on finish)
    const [previewAccent, setPreviewAccent] = useState(accentColor || "#3b82f6");
    
    // Handlers
    const handleLanguageNext = () => {
        setStep("account");
    };

    const handleAccountNext = async () => {
        if (!fullName || !username || !password) {
            setError("Please fill in all required fields");
            return;
        }
        
        // Basic validation
        if (password.length < 4) {
            setError("Password must be at least 4 characters");
            return;
        }

        setIsCreatingUser(true);
        setError("");

        // Simulate network/disk delay for realism
        setTimeout(() => {
            // Attempt to create user as 'root' (system)
            // Note: We use 'root' as the acting user to bypass permission checks since we are in setup mode.
            // Populating home with mock files for the main admin user
            const success = addUser(username, fullName, password, hint, "root", true);
            
            if (success) {
                // Add to admin group
                // We use addUserToGroup because 'admin' and 'users' groups already exist
                addUserToGroup(username, "admin");
                addUserToGroup(username, "users"); 
                
                setStep("theme");
            } else {
                setError("User already exists. Please choose another username.");
            }
            setIsCreatingUser(false);
        }, 800);
    };

    const handleThemeNext = () => {
        setStep("finishing");
        
        // Apply steps
        // 1. Switch context to new user so settings save to their profile
        switchUser(username);
        
        // 2. Apply theme settings
        setAccentColor(previewAccent);
        // themeMode is already set via UI binding if we bind it directly, 
        // but let's make sure we are setting it for the *new* user context.
        // Actually switchUser updates the context state to load that user's prefs.
        // We need to wait for switch to happen? 
        // switchUser updates state immediately but saves to LS on effect.
        
        // Delay slightly to show "Finishing up..."
        setTimeout(() => {
            updateStoredVersion(); // Commit the session as valid
            onContinue();
        }, 1500);
    };

    // Auto-generate username from full name
    const handleNameChange = (val: string) => {
        setFullName(val);
        if (!username) {
            const slug = val.toLowerCase().replace(/[^a-z0-9]/g, "");
            setUsername(slug);
        }
    };

    const presetColors = [
        "#3b82f6", // Blue
        "#e11d48", // Rose
        "#f59e0b", // Amber
        "#10b981", // Emerald
        "#8b5cf6", // Violet
    ];

    return (
        <GameScreenLayout zIndex={40000}>
            {/* Modal Overlay matching SettingsModal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                <Card className="w-full max-w-lg bg-zinc-900/90 backdrop-blur-xl border-white/10 shadow-2xl p-2">
                    <CardHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                                {step === "language" && <Globe className="w-5 h-5 text-white" />}
                                {step === "account" && <User className="w-5 h-5 text-white" />}
                                {step === "theme" && <Palette className="w-5 h-5 text-white" />}
                                {step === "finishing" && <Loader2 className="w-5 h-5 text-white animate-spin" />}
                            </div>
                            <div>
                                <CardTitle className="text-xl text-white font-bold tracking-wide">
                                    {step === "language" && "Welcome to Aurora"}
                                    {step === "account" && "Create Your Account"}
                                    {step === "theme" && "Personalize"}
                                    {step === "finishing" && "Setting up..."}
                                </CardTitle>
                                <CardDescription className="text-white/60">
                                    {step === "language" && "Select your language to get started"}
                                    {step === "account" && "Set up the primary administrator account"}
                                    {step === "theme" && "Make it yours"}
                                    {step === "finishing" && "Applying configuration"}
                                </CardDescription>
                            </div>
                        </div>
                        
                        {/* Progress Stepper */}
                        {step !== 'finishing' && (
                            <div className="flex gap-2 mt-4">
                                <div className={cn("h-1 flex-1 rounded-full transition-colors", step === "language" ? "bg-white" : "bg-white/10")} />
                                <div className={cn("h-1 flex-1 rounded-full transition-colors", step === "account" ? "bg-white" : "bg-white/10")} />
                                <div className={cn("h-1 flex-1 rounded-full transition-colors", step === "theme" ? "bg-white" : "bg-white/10")} />
                            </div>
                        )}
                    </CardHeader>

                    <CardContent className="py-6 min-h-[320px]">
                        <AnimatePresence mode="wait">
                            {step === "language" && (
                                <motion.div
                                    key="lang"
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="space-y-3"
                                >
                                    {[
                                        { id: "en", label: "English" },
                                        { id: "es", label: "Español (Unavailable)", disabled: true },
                                        { id: "fr", label: "Français (Unavailable)", disabled: true }
                                    ].map((lang) => (
                                        <button
                                            key={lang.id}
                                            disabled={lang.disabled}
                                            onClick={() => setLanguage(lang.id)}
                                            className={cn(
                                                "w-full p-4 rounded-xl border text-left flex justify-between items-center transition-all group",
                                                language === lang.id 
                                                    ? "bg-white/10 border-white/40 ring-1 ring-white/20" 
                                                    : "bg-transparent border-white/5 hover:bg-white/5 hover:border-white/10",
                                                lang.disabled && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            <span className={cn("font-medium transition-colors", language === lang.id ? "text-white" : "text-white/70 group-hover:text-white")}>{lang.label}</span>
                                            {language === lang.id && <Check className="w-5 h-5 text-white" />}
                                        </button>
                                    ))}
                                </motion.div>
                            )}

                            {step === "account" && (
                                <motion.div
                                    key="account"
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="space-y-4"
                                >
                                    <div className="grid gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-white/80">Full Name</label>
                                            <GlassInput 
                                                placeholder="Example: John Doe" 
                                                value={fullName}
                                                onChange={(e) => handleNameChange(e.target.value)}
                                                autoFocus
                                                className="bg-black/20 focus:bg-black/40"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-white/80">Username</label>
                                            <GlassInput 
                                                placeholder="johndoe" 
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                                                className="bg-black/20 focus:bg-black/40"
                                            />
                                            {username && <p className="text-xs text-white/40 font-mono">/home/{username}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-white/80">Password</label>
                                            <GlassInput 
                                                type="password"
                                                placeholder="••••••••" 
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="bg-black/20 focus:bg-black/40"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-white/80">Password Hint (Optional)</label>
                                            <GlassInput 
                                                placeholder="Example: Name of your first pet" 
                                                value={hint}
                                                onChange={(e) => setHint(e.target.value)}
                                                className="bg-black/20 focus:bg-black/40"
                                            />
                                        </div>
                                    </div>
                                    {error && (
                                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                            {error}
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {step === "theme" && (
                                <motion.div
                                    key="theme"
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="space-y-6"
                                >
                                    <div className="space-y-3">
                                        <label className="text-sm font-medium text-white/80">Theme Mode</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button 
                                                onClick={() => setThemeMode('neutral')} // Previewing
                                                className={cn(
                                                    "p-4 rounded-xl border transition-all text-left group",
                                                    themeMode === 'neutral' ? "bg-white/10 border-white/40" : "bg-black/20 border-white/5 hover:border-white/10"
                                                )}
                                            >
                                                <div className="w-full h-24 bg-[#09090b] rounded-lg mb-3 border border-white/10 relative overflow-hidden">
                                                     <div className="absolute top-2 left-2 w-16 h-4 bg-white/10 rounded" />
                                                     <div className="absolute top-8 left-2 w-8 h-8 bg-white/5 rounded-full" />
                                                </div>
                                                <div className="text-white font-medium group-hover:text-white/90">Dark (Neutral)</div>
                                            </button>
                                            <div className="relative opacity-50 cursor-not-allowed">
                                                 <div className="p-4 rounded-xl border border-white/5 bg-white/5 text-left h-full">
                                                    <div className="w-full h-24 bg-gray-100 rounded-lg mb-3 border border-black/5 relative overflow-hidden">
                                                         <div className="absolute top-2 left-2 w-16 h-4 bg-black/10 rounded" />
                                                    </div>
                                                    <div className="text-white font-medium">Light</div>
                                                 </div>
                                                 <div className="absolute inset-0 flex items-center justify-center">
                                                     <span className="bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full text-xs text-white font-medium">Coming Soon</span>
                                                 </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-sm font-medium text-white/80">Accent Color</label>
                                        <div className="flex gap-4">
                                            {presetColors.map((color) => (
                                                <button
                                                    key={color}
                                                    onClick={() => setPreviewAccent(color)}
                                                    className={cn(
                                                        "w-10 h-10 rounded-full transition-all border-2 relative",
                                                        previewAccent === color 
                                                            ? "border-white scale-110 shadow-lg shadow-white/10" 
                                                            : "border-transparent hover:scale-105 opacity-80 hover:opacity-100"
                                                    )}
                                                    style={{ backgroundColor: color }}
                                                >
                                                    {previewAccent === color && (
                                                        <motion.div 
                                                            layoutId="active-check"
                                                            className="absolute inset-0 flex items-center justify-center"
                                                        >
                                                            <Check className="w-5 h-5 text-white drop-shadow-md" />
                                                        </motion.div>
                                                    )}
                                                </button>
                                            ))}
                                            <div className="w-px h-10 bg-white/10 mx-2" />
                                            <div className="relative group">
                                                <input 
                                                    type="color" 
                                                    value={previewAccent}
                                                    onChange={(e) => setPreviewAccent(e.target.value)}
                                                    className="w-10 h-10 rounded-full opacity-0 cursor-pointer absolute inset-0 z-10"
                                                />
                                                <div 
                                                    className="w-10 h-10 rounded-full border-2 border-white/20 flex items-center justify-center transition-transform group-hover:scale-105"
                                                    style={{ backgroundColor: previewAccent }}
                                                >
                                                    <Palette className="w-4 h-4 text-white drop-shadow-md" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {step === "finishing" && (
                                <motion.div
                                    key="finishing"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex flex-col items-center justify-center h-full py-12 text-center"
                                >
                                    <h3 className="text-2xl font-bold text-white mb-2">You're all set!</h3>
                                    <p className="text-white/60 mb-8 max-w-xs mx-auto">
                                        Aurora OS is ready. Redirecting you to the login screen...
                                    </p>
                                    <div className="w-64 bg-white/10 rounded-full h-1.5 overflow-hidden">
                                        <motion.div 
                                            className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                                            initial={{ width: "0%" }}
                                            animate={{ width: "100%" }}
                                            transition={{ duration: 1.5, ease: "easeInOut" }}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </CardContent>

                    {step !== 'finishing' && (
                        <CardFooter className="flex justify-between border-t border-white/5 pt-6 p-6">
                            {step === "language" ? (
                                <div /> // Spacer
                            ) : (
                                <GlassButton 
                                    variant="ghost" 
                                    onClick={() => setStep(step === "theme" ? "account" : "language")}
                                    className="text-white/60 hover:text-white"
                                >
                                    Back
                                </GlassButton>
                            )}

                            {step === "language" && (
                                <GlassButton onClick={handleLanguageNext} className="group">
                                    Next <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                                </GlassButton>
                            )}
                            
                            {step === "account" && (
                                <GlassButton 
                                    onClick={handleAccountNext} 
                                    disabled={isCreatingUser}
                                    className="min-w-[100px]"
                                >
                                    {isCreatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Next <ChevronRight className="w-4 h-4 ml-2" /></>}
                                </GlassButton>
                            )}

                            {step === "theme" && (
                                <GlassButton onClick={handleThemeNext} style={{ backgroundColor: previewAccent }} className="px-6 shadow-lg shadow-black/20 hover:shadow-black/40">
                                    Start Using Aurora
                                </GlassButton>
                            )}
                        </CardFooter>
                    )}
                </Card>
            </div>
        </GameScreenLayout>
    );
}