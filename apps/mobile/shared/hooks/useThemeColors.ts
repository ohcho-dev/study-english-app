/**
 * useThemeColors - API 테마 색상을 인라인 스타일용으로 반환
 * @description HSL 또는 HEX 형식 색상을 HEX로 변환하여 반환합니다.
 */

import { useMemo } from 'react';
import { useTheme } from '../providers';

export interface ThemeColors {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
    success?: string;
    successForeground?: string;
    warning?: string;
    warningForeground?: string;
}

/**
 * Convert HSL values to RGB hex string
 */
const hslToHex = (h: number, s: number, l: number): string => {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) {
        r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
        r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
        r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
        r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
        r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
        r = c; g = 0; b = x;
    }

    const toHex = (n: number) => {
        const hex = Math.round((n + m) * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * Parse color string and convert to hex if needed
 * Supports: hex (#RRGGBB), HSL (H S% L%), hsl(H, S%, L%)
 */
const toHex = (value: string | undefined | null): string | undefined => {
    if (!value) return undefined;

    const trimmed = value.trim();

    // Already hex format
    if (trimmed.startsWith('#')) {
        return trimmed;
    }

    // Named colors or special values
    if (trimmed === 'transparent' || trimmed.startsWith('rgb')) {
        return trimmed;
    }

    let h: number, s: number, l: number;

    // Parse "hsl(H, S%, L%)" or "hsl(H S% L%)" format
    if (trimmed.startsWith('hsl(')) {
        const match = trimmed.match(/hsl\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%\s*\)/);
        if (match) {
            h = parseFloat(match[1]);
            s = parseFloat(match[2]);
            l = parseFloat(match[3]);
            return hslToHex(h, s, l);
        }
    }

    // Parse "H S% L%" format (TailwindCSS/Shadcn format)
    const parts = trimmed.split(/\s+/);
    if (parts.length === 3) {
        h = parseFloat(parts[0]);
        s = parseFloat(parts[1].replace('%', ''));
        l = parseFloat(parts[2].replace('%', ''));
        if (!isNaN(h) && !isNaN(s) && !isNaN(l)) {
            return hslToHex(h, s, l);
        }
    }

    // Return as-is if can't parse
    return trimmed;
};

// Default fallback colors (Premium Slate theme - HEX)
const DEFAULT_LIGHT: ThemeColors = {
    background: '#ffffff',
    foreground: '#17191c',
    card: '#ffffff',
    cardForeground: '#17191c',
    popover: '#ffffff',
    popoverForeground: '#17191c',
    primary: '#2e6fe6',
    primaryForeground: '#ffffff',
    secondary: '#f2f3f4',
    secondaryForeground: '#5c6166',
    muted: '#f2f3f4',
    mutedForeground: '#686d73',
    accent: '#edeff0',
    accentForeground: '#17191c',
    destructive: '#ed3f3f',
    destructiveForeground: '#ffffff',
    border: '#e2e4e6',
    input: '#e2e4e6',
    ring: '#2e6fe6',
    success: '#16a34a',
    successForeground: '#ffffff',
    warning: '#f5a623',
    warningForeground: '#ffffff',
};

const DEFAULT_DARK: ThemeColors = {
    background: '#0e1117',
    foreground: '#f9fafb',
    card: '#181c24',
    cardForeground: '#f9fafb',
    popover: '#181c24',
    popoverForeground: '#f9fafb',
    primary: '#4285f4',
    primaryForeground: '#ffffff',
    secondary: '#252a34',
    secondaryForeground: '#c9ccce',
    muted: '#252a34',
    mutedForeground: '#858a8f',
    accent: '#2d3340',
    accentForeground: '#f9fafb',
    destructive: '#ed3f3f',
    destructiveForeground: '#ffffff',
    border: '#252a34',
    input: '#252a34',
    ring: '#4285f4',
    success: '#22c55e',
    successForeground: '#ffffff',
    warning: '#f5a623',
    warningForeground: '#ffffff',
};

/**
 * Hook to get theme colors from API or fallback to defaults
 * Converts HSL to HEX for React Native compatibility
 */
export const useThemeColors = (): ThemeColors => {
    const { activeTheme, effectiveColorScheme } = useTheme();

    return useMemo(() => {
        const defaults = effectiveColorScheme === 'dark' ? DEFAULT_DARK : DEFAULT_LIGHT;

        if (!activeTheme?.current_version) {
            return defaults;
        }

        const apiColors = effectiveColorScheme === 'dark'
            ? activeTheme.current_version.dark_mode
            : activeTheme.current_version.light_mode;

        // Convert all colors to hex (handles both HSL and hex input)
        return {
            background: toHex(apiColors.background) || defaults.background,
            foreground: toHex(apiColors.foreground) || defaults.foreground,
            card: toHex(apiColors.card) || defaults.card,
            cardForeground: toHex(apiColors['card-foreground']) || defaults.cardForeground,
            popover: toHex(apiColors.popover) || defaults.popover,
            popoverForeground: toHex(apiColors['popover-foreground']) || defaults.popoverForeground,
            primary: toHex(apiColors.primary) || defaults.primary,
            primaryForeground: toHex(apiColors['primary-foreground']) || defaults.primaryForeground,
            secondary: toHex(apiColors.secondary) || defaults.secondary,
            secondaryForeground: toHex(apiColors['secondary-foreground']) || defaults.secondaryForeground,
            muted: toHex(apiColors.muted) || defaults.muted,
            mutedForeground: toHex(apiColors['muted-foreground']) || defaults.mutedForeground,
            accent: toHex(apiColors.accent) || defaults.accent,
            accentForeground: toHex(apiColors['accent-foreground']) || defaults.accentForeground,
            destructive: toHex(apiColors.destructive) || defaults.destructive,
            destructiveForeground: toHex(apiColors['destructive-foreground']) || defaults.destructiveForeground,
            border: toHex(apiColors.border) || defaults.border,
            input: toHex(apiColors.input) || defaults.input,
            ring: toHex(apiColors.ring) || defaults.ring,
            success: toHex(apiColors.success) || defaults.success,
            successForeground: toHex(apiColors['success-foreground']) || defaults.successForeground,
            warning: toHex(apiColors.warning) || defaults.warning,
            warningForeground: toHex(apiColors['warning-foreground']) || defaults.warningForeground,
        };
    }, [activeTheme, effectiveColorScheme]);
};
