/**
 * useThemeColors - API 테마 색상을 인라인 스타일용으로 반환
 * @description HSL 또는 HEX 형식 색상을 HEX로 변환하여 반환합니다.
 */

import { useMemo } from 'react';
import { useTheme } from '../providers';
import { lightenColor } from '../reusables/lib/colorUtils';

export interface ThemeColors {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    primaryLight: string;
    secondary: string;
    secondaryForeground: string;
    secondaryLight: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    accentLight: string;
    destructive: string;
    destructiveForeground: string;
    destructiveLight: string;
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

// Default fallback colors (User Provided - Orange Primary) - HEX format
const DEFAULT_LIGHT: ThemeColors = {
    background: '#ffffff',
    foreground: '#020817',
    card: '#ffffff',
    cardForeground: '#020817',
    popover: '#ffffff',
    popoverForeground: '#020817',
    primary: '#f97316',
    primaryForeground: '#ffffff',
    primaryLight: '#fb9248', // calculated
    secondary: '#3b82f6',
    secondaryForeground: '#ffffff',
    secondaryLight: '#609bf8', // calculated
    muted: '#f1f5f9',
    mutedForeground: '#64748b',
    accent: '#e2e8f0',
    accentForeground: '#0f172a',
    accentLight: '#eef2f6', // calculated
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',
    destructiveLight: '#f36b6b', // calculated
    success: '#16a34a',
    successForeground: '#ffffff',
    warning: '#f97316',
    warningForeground: '#ffffff',
    border: '#cbd5e1',
    input: '#cbd5e1',
    ring: '#f97316',
};

const DEFAULT_DARK: ThemeColors = {
    background: '#020817',
    foreground: '#f8fafc',
    card: '#1e293b',
    cardForeground: '#f8fafc',
    popover: '#020817',
    popoverForeground: '#f8fafc',
    primary: '#f97316',
    primaryForeground: '#ffffff',
    primaryLight: '#fb9248', // calculated
    secondary: '#3b82f6',
    secondaryForeground: '#ffffff',
    secondaryLight: '#609bf8', // calculated
    muted: '#1e293b',
    mutedForeground: '#94a3b8',
    accent: '#334155',
    accentForeground: '#f8fafc',
    accentLight: '#515d6e', // calculated
    destructive: '#7f1d1d',
    destructiveForeground: '#ffffff',
    destructiveLight: '#a13e3e', // calculated
    success: '#166534',
    successForeground: '#ffffff',
    warning: '#f97316',
    warningForeground: '#ffffff',
    border: '#334155',
    input: '#334155',
    ring: '#f97316',
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
        const primary = toHex(apiColors.primary) || defaults.primary;
        const secondary = toHex(apiColors.secondary) || defaults.secondary;
        const accent = toHex(apiColors.accent) || defaults.accent;
        const destructive = toHex(apiColors.destructive) || defaults.destructive;

        return {
            background: toHex(apiColors.background) || defaults.background,
            foreground: toHex(apiColors.foreground) || defaults.foreground,
            card: toHex(apiColors.card) || defaults.card,
            cardForeground: toHex(apiColors['card-foreground']) || defaults.cardForeground,
            popover: toHex(apiColors.popover) || defaults.popover,
            popoverForeground: toHex(apiColors['popover-foreground']) || defaults.popoverForeground,
            primary,
            primaryForeground: toHex(apiColors['primary-foreground']) || defaults.primaryForeground,
            primaryLight: toHex(apiColors['primary-light']) ?? lightenColor(primary, 15),
            secondary,
            secondaryForeground: toHex(apiColors['secondary-foreground']) || defaults.secondaryForeground,
            secondaryLight: toHex(apiColors['secondary-light']) ?? lightenColor(secondary, 15),
            muted: toHex(apiColors.muted) || defaults.muted,
            mutedForeground: toHex(apiColors['muted-foreground']) || defaults.mutedForeground,
            accent,
            accentForeground: toHex(apiColors['accent-foreground']) || defaults.accentForeground,
            accentLight: toHex(apiColors['accent-light']) ?? lightenColor(accent, 15),
            destructive,
            destructiveForeground: toHex(apiColors['destructive-foreground']) || defaults.destructiveForeground,
            destructiveLight: toHex(apiColors['destructive-light']) ?? lightenColor(destructive, 15),
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
