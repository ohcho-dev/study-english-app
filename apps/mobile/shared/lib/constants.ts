/**
 * 테마 상수 (React Native Reusables 패턴)
 * @description CSS 변수와 동기화된 테마 값
 */

import { DarkTheme, DefaultTheme, Theme } from '@react-navigation/native';

/**
 * Theme Mode Configuration
 * 'dark' | 'light' | 'system'
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * ⚡ 여기서 앱 테마를 변경하세요!
 */
export const APP_THEME: ThemeMode = 'dark';

/**
 * CSS 변수와 동기화된 테마 값 (HSL)
 * global.css의 :root 및 .dark:root와 동일한 값
 */
export const THEME = {
    light: {
        background: 'hsl(0, 0%, 100%)',
        foreground: 'hsl(222.2, 84%, 4.9%)',
        card: 'hsl(0, 0%, 100%)',
        cardForeground: 'hsl(222.2, 84%, 4.9%)',
        primary: 'hsl(24.6, 95%, 53.1%)',
        primaryForeground: 'hsl(0, 0%, 100%)',
        secondary: 'hsl(217.2, 91.2%, 59.8%)',
        secondaryForeground: 'hsl(0, 0%, 100%)',
        muted: 'hsl(210, 40%, 96.1%)',
        mutedForeground: 'hsl(215.4, 16.3%, 46.9%)',
        accent: 'hsl(210, 40%, 96.1%)',
        accentForeground: 'hsl(222.2, 47.4%, 11.2%)',
        destructive: 'hsl(0, 84.2%, 60.2%)',
        destructiveForeground: 'hsl(0, 0%, 100%)',
        success: 'hsl(142.1, 76.2%, 36.3%)',
        successForeground: 'hsl(0, 0%, 100%)',
        warning: 'hsl(24.6, 95%, 53.1%)',
        warningForeground: 'hsl(0, 0%, 100%)',
        border: 'hsl(214.3, 31.8%, 91.4%)',
        input: 'hsl(214.3, 31.8%, 91.4%)',
        ring: 'hsl(24.6, 95%, 53.1%)',
    },
    dark: {
        background: 'hsl(222.2, 84%, 4.9%)',
        foreground: 'hsl(210, 40%, 98%)',
        card: 'hsl(217.2, 32.6%, 17.5%)',
        cardForeground: 'hsl(210, 40%, 98%)',
        primary: 'hsl(24.6, 95%, 53.1%)',
        primaryForeground: 'hsl(0, 0%, 100%)',
        secondary: 'hsl(217.2, 91.2%, 59.8%)',
        secondaryForeground: 'hsl(0, 0%, 100%)',
        muted: 'hsl(217.2, 32.6%, 17.5%)',
        mutedForeground: 'hsl(215, 20.2%, 65.1%)',
        accent: 'hsl(217.2, 32.6%, 17.5%)',
        accentForeground: 'hsl(210, 40%, 98%)',
        destructive: 'hsl(0, 70.9%, 59.4%)',
        destructiveForeground: 'hsl(0, 0%, 100%)',
        success: 'hsl(142.1, 70.6%, 45.3%)',
        successForeground: 'hsl(0, 0%, 100%)',
        warning: 'hsl(24.6, 95%, 53.1%)',
        warningForeground: 'hsl(0, 0%, 100%)',
        border: 'hsl(217.2, 32.6%, 17.5%)',
        input: 'hsl(217.2, 32.6%, 17.5%)',
        ring: 'hsl(24.6, 95%, 53.1%)',
    },
} as const;

/**
 * React Navigation 테마 (다크/라이트별 네비게이션 스타일)
 */
export const NAV_THEME: Record<'light' | 'dark', Theme> = {
    light: {
        ...DefaultTheme,
        colors: {
            background: THEME.light.background,
            border: THEME.light.border,
            card: THEME.light.card,
            notification: THEME.light.destructive,
            primary: THEME.light.primary,
            text: THEME.light.foreground,
        },
    },
    dark: {
        ...DarkTheme,
        colors: {
            background: THEME.dark.background,
            border: THEME.dark.border,
            card: THEME.dark.card,
            notification: THEME.dark.destructive,
            primary: THEME.dark.primary,
            text: THEME.dark.foreground,
        },
    },
};
