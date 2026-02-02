'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

type ThemeMode = 'light' | 'dark' | 'system';

const THEME_MODE_KEY = 'admin-theme-mode';

const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyTheme = (mode: ThemeMode) => {
    const effectiveTheme = mode === 'system' ? getSystemTheme() : mode;
    const root = document.documentElement;

    if (effectiveTheme === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
};

export const ModeToggle = () => {
    const [mode, setMode] = useState<ThemeMode>('dark');
    const [mounted, setMounted] = useState(false);

    // Load saved mode
    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem(THEME_MODE_KEY) as ThemeMode | null;
        if (saved && ['light', 'dark', 'system'].includes(saved)) {
            setMode(saved);
            applyTheme(saved);
        }

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            const currentMode = localStorage.getItem(THEME_MODE_KEY) as ThemeMode | null;
            if (currentMode === 'system') {
                applyTheme('system');
            }
        };
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const handleModeChange = (newMode: ThemeMode) => {
        setMode(newMode);
        localStorage.setItem(THEME_MODE_KEY, newMode);
        applyTheme(newMode);
    };

    if (!mounted) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                    {mode === 'light' && <Sun className="h-4 w-4" />}
                    {mode === 'dark' && <Moon className="h-4 w-4" />}
                    {mode === 'system' && <Monitor className="h-4 w-4" />}
                    <span className="sr-only">테마 변경</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleModeChange('light')}>
                    <Sun className="h-4 w-4 mr-2" />
                    라이트
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleModeChange('dark')}>
                    <Moon className="h-4 w-4 mr-2" />
                    다크
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleModeChange('system')}>
                    <Monitor className="h-4 w-4 mr-2" />
                    시스템
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
