/**
 * Shared layer exports
 * @description 공유 모듈 통합 export
 */

// Config
export { fonts, fontFamily, type FontFamily } from './config/fonts';

// Hooks
export { useAppFonts } from './hooks/useAppFonts';
export { useColorScheme } from './hooks/useColorScheme';
export { useClientOnlyValue } from './hooks/useClientOnlyValue';

// Theme
export {
    colors,
    lightColors,
    darkColors,
    themeColors,
    commonColors,
    fontSize,
    lineHeight,
    textPresets,
    spacing,
    layout,
    borderRadius,
    shadow,
    componentStyles,
    theme,
    type ColorName,
    type ThemeMode,
    type TextPreset,
    type SpacingKey,
    type BorderRadiusKey,
    type ShadowKey,
} from './theme';

// UI Components
export { Text, View, useThemeColor, type TextProps, type ViewProps } from './ui';
