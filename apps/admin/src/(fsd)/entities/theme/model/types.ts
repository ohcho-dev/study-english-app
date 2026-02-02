// Theme 엔티티 타입 정의

export interface ThemeColors {
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
    success: string;
    'success-foreground': string;
    warning: string;
    'warning-foreground': string;
    border: string;
    input: string;
    ring: string;
}


export interface ThemeVersion {
    id: string;
    theme_id: string;
    version: number;
    description: string | null;
    light_mode: ThemeColors;
    dark_mode: ThemeColors;
    created_by: string | null;
    created_at: string;
}

export interface Theme {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    default_mode: 'light' | 'dark' | 'system';
    created_at: string;
    updated_at: string;
}

export interface ThemeWithVersions extends Theme {
    versions: ThemeVersion[];
    current_version: ThemeVersion | null;
}

export interface ThemeCreate {
    name: string;
    description?: string;
    light_mode: ThemeColors;
    dark_mode: ThemeColors;
}

export interface ThemeUpdate {
    name?: string;
    description?: string;
    is_active?: boolean;
    default_mode?: 'light' | 'dark' | 'system';
}

export interface ThemeVersionCreate {
    description?: string;
    light_mode: ThemeColors;
    dark_mode: ThemeColors;
}

// Default theme template (Premium Slate) - HEX format
// 원본 HSL 값을 정확히 변환한 HEX 색상
export const DEFAULT_THEME_TEMPLATE = {
    light_mode: {
        // 원본: 0 0% 100% → 흰색
        background: '#ffffff',
        // 원본: 220 10% 10% → 아주 어두운 회청색
        foreground: '#17191c',
        // 원본: 0 0% 100%
        card: '#ffffff',
        'card-foreground': '#17191c',
        popover: '#ffffff',
        'popover-foreground': '#17191c',
        // 원본: 220 80% 55% → 파란색 (기본 강조)
        primary: '#2e6fe6',
        'primary-foreground': '#ffffff',
        // 원본: 220 10% 96% → 아주 밝은 회색
        secondary: '#f2f3f4',
        // 원본: 220 10% 40%
        'secondary-foreground': '#5c6166',
        // 원본: 220 10% 96%
        muted: '#f2f3f4',
        // 원본: 220 10% 45%
        'muted-foreground': '#686d73',
        // 원본: 220 10% 94%
        accent: '#edeff0',
        'accent-foreground': '#17191c',
        // 원본: 0 84% 60% → 빨간색
        destructive: '#ed3f3f',
        'destructive-foreground': '#ffffff',
        // 원본: 142 76% 36% → 녹색
        success: '#16a34a',
        'success-foreground': '#ffffff',
        // 원본: 38 92% 50% → 주황/노란색
        warning: '#f5a623',
        'warning-foreground': '#ffffff',
        // 원본: 220 10% 90%
        border: '#e2e4e6',
        input: '#e2e4e6',
        // 원본: 220 80% 55%
        ring: '#2e6fe6',
    },
    dark_mode: {
        // 원본: 224 30% 8% → 매우 어두운 남색
        background: '#0e1117',
        // 원본: 220 10% 98%
        foreground: '#f9fafb',
        // 원본: 224 25% 12%
        card: '#181c24',
        'card-foreground': '#f9fafb',
        popover: '#181c24',
        'popover-foreground': '#f9fafb',
        // 원본: 220 80% 60%
        primary: '#4285f4',
        'primary-foreground': '#ffffff',
        // 원본: 224 20% 18%
        secondary: '#252a34',
        // 원본: 220 10% 80%
        'secondary-foreground': '#c9ccce',
        // 원본: 224 20% 18%
        muted: '#252a34',
        // 원본: 220 10% 55%
        'muted-foreground': '#858a8f',
        // 원본: 224 20% 22%
        accent: '#2d3340',
        'accent-foreground': '#f9fafb',
        // 원본: 0 84% 60%
        destructive: '#ed3f3f',
        'destructive-foreground': '#ffffff',
        // 원본: 142 70% 45%
        success: '#22c55e',
        'success-foreground': '#ffffff',
        // 원본: 38 92% 50%
        warning: '#f5a623',
        'warning-foreground': '#ffffff',
        // 원본: 224 20% 18%
        border: '#252a34',
        input: '#252a34',
        // 원본: 220 80% 60%
        ring: '#4285f4',
    },
} as const;

// Color keys for form iteration
export const THEME_COLOR_KEYS: (keyof ThemeColors)[] = [
    'background',
    'foreground',
    'card',
    'card-foreground',
    'popover',
    'popover-foreground',
    'primary',
    'primary-foreground',
    'secondary',
    'secondary-foreground',
    'muted',
    'muted-foreground',
    'accent',
    'accent-foreground',
    'destructive',
    'destructive-foreground',
    'success',
    'success-foreground',
    'warning',
    'warning-foreground',
    'border',
    'input',
    'ring',
];

export const COLOR_LABELS: Record<keyof ThemeColors, string> = {
    background: '배경',
    foreground: '텍스트',
    card: '카드 배경',
    'card-foreground': '카드 텍스트',
    popover: '팝오버 배경',
    'popover-foreground': '팝오버 텍스트',
    primary: '기본 강조',
    'primary-foreground': '기본 강조 텍스트',
    secondary: '보조',
    'secondary-foreground': '보조 텍스트',
    muted: '음소거 배경',
    'muted-foreground': '음소거 텍스트',
    accent: '액센트',
    'accent-foreground': '액센트 텍스트',
    destructive: '위험/삭제',
    'destructive-foreground': '위험/삭제 텍스트',
    success: '성공',
    'success-foreground': '성공 텍스트',
    warning: '경고',
    'warning-foreground': '경고 텍스트',
    border: '테두리',
    input: '입력 테두리',
    ring: '포커스 링',
};
