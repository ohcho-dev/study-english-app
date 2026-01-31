/**
 * 컬러 팔레트
 * @description 앱 전체에서 사용하는 색상 정의 (라이트/다크 모드 지원)
 * @layer shared/theme
 */

// 라이트 모드 컬러
export const lightColors = {
    // 브랜드 컬러
    primary: '#6366F1',
    primaryLight: '#818CF8',
    primaryDark: '#4F46E5',

    secondary: '#22D3EE',
    secondaryLight: '#67E8F9',
    secondaryDark: '#06B6D4',

    // 시맨틱 컬러
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    // 배경
    background: '#FFFFFF',
    backgroundSecondary: '#F9FAFB',
    backgroundTertiary: '#F3F4F6',

    // 텍스트
    text: '#1F2937',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    textInverse: '#FFFFFF',

    // 보더
    border: '#E5E7EB',
    borderFocus: '#6366F1',

    // 탭바
    tint: '#6366F1',
    tabIconDefault: '#9CA3AF',
    tabIconSelected: '#6366F1',

    // 오버레이
    overlay: 'rgba(0, 0, 0, 0.5)',
} as const;

// 다크 모드 컬러
export const darkColors = {
    // 브랜드 컬러
    primary: '#818CF8',
    primaryLight: '#A5B4FC',
    primaryDark: '#6366F1',

    secondary: '#67E8F9',
    secondaryLight: '#A5F3FC',
    secondaryDark: '#22D3EE',

    // 시맨틱 컬러
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#60A5FA',

    // 배경
    background: '#111827',
    backgroundSecondary: '#1F2937',
    backgroundTertiary: '#374151',

    // 텍스트
    text: '#F9FAFB',
    textSecondary: '#D1D5DB',
    textTertiary: '#9CA3AF',
    textInverse: '#111827',

    // 보더
    border: '#374151',
    borderFocus: '#818CF8',

    // 탭바
    tint: '#FFFFFF',
    tabIconDefault: '#6B7280',
    tabIconSelected: '#FFFFFF',

    // 오버레이
    overlay: 'rgba(0, 0, 0, 0.7)',
} as const;

// 공통 컬러 (모드 상관없이 동일)
export const commonColors = {
    // SSO 브랜드 컬러 (고정)
    kakao: '#FEE500',
    naver: '#03C75A',
    google: '#FFFFFF',
    apple: '#000000',
} as const;

// 기본 colors export (라이트 모드 기준)
export const colors = { ...lightColors, ...commonColors };

// 테마별 컬러 객체
export const themeColors = {
    light: { ...lightColors, ...commonColors },
    dark: { ...darkColors, ...commonColors },
} as const;

export type ColorName = keyof typeof colors;
export type ThemeMode = 'light' | 'dark';
