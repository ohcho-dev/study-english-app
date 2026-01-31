/**
 * 타이포그래피
 * @description 폰트 사이즈, 라인하이트, 텍스트 프리셋
 * @layer shared/theme
 */

import { fontFamily } from '../config/fonts';

export const fontSize = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
} as const;

export const lineHeight = {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
} as const;

// 텍스트 프리셋 (자주 사용하는 조합)
export const textPresets = {
    h1: {
        fontSize: fontSize['3xl'],
        fontFamily: fontFamily.bold,
        lineHeight: fontSize['3xl'] * lineHeight.tight,
    },
    h2: {
        fontSize: fontSize['2xl'],
        fontFamily: fontFamily.bold,
        lineHeight: fontSize['2xl'] * lineHeight.tight,
    },
    h3: {
        fontSize: fontSize.xl,
        fontFamily: fontFamily.semiBold,
        lineHeight: fontSize.xl * lineHeight.tight,
    },
    body: {
        fontSize: fontSize.md,
        fontFamily: fontFamily.regular,
        lineHeight: fontSize.md * lineHeight.normal,
    },
    bodySmall: {
        fontSize: fontSize.sm,
        fontFamily: fontFamily.regular,
        lineHeight: fontSize.sm * lineHeight.normal,
    },
    caption: {
        fontSize: fontSize.xs,
        fontFamily: fontFamily.regular,
        lineHeight: fontSize.xs * lineHeight.normal,
    },
    button: {
        fontSize: fontSize.md,
        fontFamily: fontFamily.semiBold,
        lineHeight: fontSize.md,
    },
} as const;

export type TextPreset = keyof typeof textPresets;
