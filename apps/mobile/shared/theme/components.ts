/**
 * 컴포넌트 스타일 프리셋
 * @description 버튼, 입력필드, 카드 등 공통 스타일
 * @layer shared/theme
 */

import { colors } from './colors';
import { spacing, borderRadius, layout } from './spacing';
import { fontSize } from './typography';
import { fontFamily } from '../config/fonts';

export const componentStyles = {
    // 버튼 스타일
    button: {
        primary: {
            backgroundColor: colors.primary,
            paddingVertical: layout.buttonPadding,
            paddingHorizontal: spacing[6],
            borderRadius: borderRadius.lg,
        },
        secondary: {
            backgroundColor: colors.backgroundSecondary,
            paddingVertical: layout.buttonPadding,
            paddingHorizontal: spacing[6],
            borderRadius: borderRadius.lg,
        },
        outline: {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: layout.buttonPadding,
            paddingHorizontal: spacing[6],
            borderRadius: borderRadius.lg,
        },
    },

    // 입력 필드 스타일
    input: {
        default: {
            height: 48,
            paddingHorizontal: layout.inputPadding,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.md,
            fontSize: fontSize.md,
            fontFamily: fontFamily.regular,
        },
    },

    // 카드 스타일
    card: {
        default: {
            backgroundColor: colors.background,
            padding: layout.cardPadding,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
        },
    },
} as const;
