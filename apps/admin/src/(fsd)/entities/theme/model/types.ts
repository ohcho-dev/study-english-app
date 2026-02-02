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
    'primary-light'?: string;
    secondary: string;
    'secondary-foreground': string;
    'secondary-light'?: string;
    muted: string;
    'muted-foreground': string;
    accent: string;
    'accent-foreground': string;
    'accent-light'?: string;
    destructive: string;
    'destructive-foreground': string;
    'destructive-light'?: string;
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

// Default theme template (User Provided - Orange Primary) - HEX format
// 원본 HSL 값을 정확히 변환한 HEX 색상
export const DEFAULT_THEME_TEMPLATE = {
    light_mode: {
        background: '#ffffff',
        foreground: '#020817',
        card: '#ffffff',
        'card-foreground': '#020817',
        popover: '#ffffff',
        'popover-foreground': '#020817',
        primary: '#f97316',
        'primary-foreground': '#ffffff',
        'primary-light': '#fb9248', // calculated
        secondary: '#3b82f6',
        'secondary-foreground': '#ffffff',
        'secondary-light': '#609bf8', // calculated
        muted: '#f1f5f9',
        'muted-foreground': '#64748b',
        accent: '#e2e8f0',
        'accent-foreground': '#0f172a',
        'accent-light': '#eef2f6', // calculated
        destructive: '#ef4444',
        'destructive-foreground': '#ffffff',
        'destructive-light': '#f36b6b', // calculated
        success: '#16a34a',
        'success-foreground': '#ffffff',
        warning: '#f97316',
        'warning-foreground': '#ffffff',
        border: '#cbd5e1',
        input: '#cbd5e1',
        ring: '#f97316',
    },
    dark_mode: {
        background: '#020817',
        foreground: '#f8fafc',
        card: '#1e293b',
        'card-foreground': '#f8fafc',
        popover: '#020817',
        'popover-foreground': '#f8fafc',
        primary: '#f97316',
        'primary-foreground': '#ffffff',
        'primary-light': '#fb9248', // calculated
        secondary: '#3b82f6',
        'secondary-foreground': '#ffffff',
        'secondary-light': '#609bf8', // calculated
        muted: '#1e293b',
        'muted-foreground': '#94a3b8',
        accent: '#334155',
        'accent-foreground': '#f8fafc',
        'accent-light': '#515d6e', // calculated
        destructive: '#7f1d1d',
        'destructive-foreground': '#ffffff',
        'destructive-light': '#a13e3e', // calculated
        success: '#166534',
        'success-foreground': '#ffffff',
        warning: '#f97316',
        'warning-foreground': '#ffffff',
        border: '#334155',
        input: '#334155',
        ring: '#f97316',
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
    'primary-light',
    'secondary',
    'secondary-foreground',
    'secondary-light',
    'muted',
    'muted-foreground',
    'accent',
    'accent-foreground',
    'accent-light',
    'destructive',
    'destructive-foreground',
    'destructive-light',
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
    'primary-light': '기본 강조 (Light)',
    secondary: '보조',
    'secondary-foreground': '보조 텍스트',
    'secondary-light': '보조 (Light)',
    muted: '음소거 배경',
    'muted-foreground': '음소거 텍스트',
    accent: '액센트',
    'accent-foreground': '액센트 텍스트',
    'accent-light': '액센트 (Light)',
    destructive: '위험/삭제',
    'destructive-foreground': '위험/삭제 텍스트',
    'destructive-light': '위험/삭제 (Light)',
    success: '성공',
    'success-foreground': '성공 텍스트',
    warning: '경고',
    'warning-foreground': '경고 텍스트',
    border: '테두리',
    input: '입력 테두리',
    ring: '포커스 링',
};
