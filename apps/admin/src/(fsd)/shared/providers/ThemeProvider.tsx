'use client';

import { useEffect } from 'react';
import { useActiveTheme } from '@/features/theme-form';

/**
 * ThemeProvider - Fetches active theme from API and applies CSS variables
 * 
 * This component should be placed in the app's root layout.
 * It dynamically updates CSS custom properties based on the active theme.
 * 
 * Note: API stores HSL values as "H S% L%" format.
 * CSS requires hsl(H, S%, L%) for color interpretation.
 */
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const { data: activeTheme } = useActiveTheme();

    useEffect(() => {
        if (!activeTheme?.current_version) return;

        const { light_mode, dark_mode } = activeTheme.current_version;

        // Convert HSL value string to CSS hsl() format
        // Input: "224 30% 8%" -> Output: "hsl(224, 30%, 8%)"
        const toHsl = (value: string) => {
            // Check if value already has hsl() wrapper
            if (value.startsWith('hsl(') || value.startsWith('oklch(')) {
                return value;
            }
            // Convert "H S% L%" to "hsl(H, S%, L%)"
            const parts = value.split(' ');
            if (parts.length === 3) {
                return `hsl(${parts[0]}, ${parts[1]}, ${parts[2]})`;
            }
            return value;
        };

        // Apply light mode variables via dynamic style element
        const lightStyleId = 'dynamic-theme-light';
        let lightStyle = document.getElementById(lightStyleId) as HTMLStyleElement | null;

        if (!lightStyle) {
            lightStyle = document.createElement('style');
            lightStyle.id = lightStyleId;
            document.head.appendChild(lightStyle);
        }

        const lightCssVars = Object.entries(light_mode)
            .map(([key, value]) => `--${key}: ${toHsl(value as string)};`)
            .join('\n  ');

        lightStyle.textContent = `:root {\n  ${lightCssVars}\n}`;

        // Apply dark mode variables
        const darkStyleId = 'dynamic-theme-dark';
        let darkStyle = document.getElementById(darkStyleId) as HTMLStyleElement | null;

        if (!darkStyle) {
            darkStyle = document.createElement('style');
            darkStyle.id = darkStyleId;
            document.head.appendChild(darkStyle);
        }

        const darkCssVars = Object.entries(dark_mode)
            .map(([key, value]) => `--${key}: ${toHsl(value as string)};`)
            .join('\n  ');

        darkStyle.textContent = `.dark {\n  ${darkCssVars}\n}`;

        console.log('[ThemeProvider] Applied active theme:', activeTheme.name);

    }, [activeTheme]);

    return <>{children}</>;
};
