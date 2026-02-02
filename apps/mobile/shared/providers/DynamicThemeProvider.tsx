/**
 * DynamicThemeProvider - 서버에서 테마를 가져와 동적으로 적용
 * @description 활성 테마 API를 호출하여 모드 설정을 가져옴
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const THEME_MODE_KEY = '@theme_mode';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeColors {
    background: string;
    foreground: string;
    card: string;
    'card-foreground': string;
    popover: string;
    'popover-foreground': string;
    primary: string;
    'primary-foreground': string;
    secondary: string;
    'secondary-foreground': string;
    muted: string;
    'muted-foreground': string;
    accent: string;
    'accent-foreground': string;
    destructive: string;
    'destructive-foreground': string;
    border: string;
    input: string;
    ring: string;
}

interface ActiveTheme {
    id: string;
    name: string;
    default_mode?: ThemeMode;
    current_version: {
        light_mode: ThemeColors;
        dark_mode: ThemeColors;
    } | null;
}

interface ThemeContextValue {
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => Promise<void>;
    activeTheme: ActiveTheme | null;
    isLoading: boolean;
    effectiveColorScheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within DynamicThemeProvider');
    }
    return context;
};

interface Props {
    children: React.ReactNode;
}

export const DynamicThemeProvider: React.FC<Props> = ({ children }) => {
    const systemColorScheme = useSystemColorScheme();
    const { setColorScheme } = useColorScheme();
    const [mode, setModeState] = useState<ThemeMode>('system');
    const [activeTheme, setActiveTheme] = useState<ActiveTheme | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Calculate effective color scheme
    const effectiveColorScheme: 'light' | 'dark' =
        mode === 'system'
            ? (systemColorScheme ?? 'dark')
            : mode;

    // Load saved mode from AsyncStorage, or use API default
    useEffect(() => {
        const loadMode = async () => {
            try {
                const savedMode = await AsyncStorage.getItem(THEME_MODE_KEY);
                console.log('[DynamicThemeProvider] AsyncStorage mode:', savedMode);
                if (savedMode && ['light', 'dark', 'system'].includes(savedMode)) {
                    setModeState(savedMode as ThemeMode);
                    return true; // User has custom preference
                }
                return false; // No custom preference, will use API default
            } catch (error) {
                console.warn('[DynamicThemeProvider] Failed to load theme mode:', error);
                return false;
            }
        };

        const fetchThemeAndApplyDefault = async () => {
            const hasCustomPreference = await loadMode();
            console.log('[DynamicThemeProvider] Has custom preference:', hasCustomPreference);
            console.log('[DynamicThemeProvider] System color scheme:', systemColorScheme);

            try {
                console.log('[DynamicThemeProvider] Fetching theme from:', `${API_BASE}/themes/active`);
                const res = await fetch(`${API_BASE}/themes/active`);
                console.log('[DynamicThemeProvider] API response status:', res.status);

                if (res.ok) {
                    const data = await res.json();
                    if (data) {
                        setActiveTheme(data);
                        console.log('[DynamicThemeProvider] Loaded active theme:', data.name);
                        console.log('[DynamicThemeProvider] Theme default_mode:', data.default_mode);
                        console.log('[DynamicThemeProvider] Theme has current_version:', !!data.current_version);

                        // If user hasn't set a preference, use the API default_mode
                        if (!hasCustomPreference && data.default_mode) {
                            setModeState(data.default_mode as ThemeMode);
                            console.log('[DynamicThemeProvider] Applied default mode:', data.default_mode);
                        }
                    }
                } else {
                    console.warn('[DynamicThemeProvider] API returned non-ok status:', res.status);
                }
            } catch (error) {
                console.warn('[DynamicThemeProvider] Failed to fetch active theme:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchThemeAndApplyDefault();
    }, []);

    // Apply NativeWind color scheme
    useEffect(() => {
        console.log('[DynamicThemeProvider] Setting color scheme to:', effectiveColorScheme);
        setColorScheme(effectiveColorScheme);
    }, [effectiveColorScheme, setColorScheme]);


    // Save and set mode
    const setMode = async (newMode: ThemeMode) => {
        try {
            await AsyncStorage.setItem(THEME_MODE_KEY, newMode);
            setModeState(newMode);
        } catch (error) {
            console.warn('[DynamicThemeProvider] Failed to save theme mode:', error);
        }
    };

    const contextValue: ThemeContextValue = {
        mode,
        setMode,
        activeTheme,
        isLoading,
        effectiveColorScheme,
    };

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
};
