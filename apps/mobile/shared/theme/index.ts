/**
 * 테마 통합 export
 * @description 모든 테마 토큰을 한 곳에서 export
 * @layer shared/theme
 */

export {
    colors,
    lightColors,
    darkColors,
    themeColors,
    commonColors,
    type ColorName,
    type ThemeMode,
} from './colors';
export { fontSize, lineHeight, textPresets, type TextPreset } from './typography';
export { spacing, layout, borderRadius, shadow, type SpacingKey, type BorderRadiusKey, type ShadowKey } from './spacing';
export { componentStyles } from './components';

// 통합 테마 객체 (선택적 사용)
import { colors } from './colors';
import { fontSize, lineHeight, textPresets } from './typography';
import { spacing, layout, borderRadius, shadow } from './spacing';
import { componentStyles } from './components';

export const theme = {
    colors,
    fontSize,
    lineHeight,
    textPresets,
    spacing,
    layout,
    borderRadius,
    shadow,
    componentStyles,
} as const;
