export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

/**
 * 미디어 URL 해석 — 절대 URL은 그대로, 상대 경로는 API_BASE_URL 붙임.
 * GCS URL (https://storage...) 과 로컬 URL (/static/audio/...) 모두 처리.
 */
export function resolveMediaUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url; // GCS 등 절대 URL
    }
    return `${API_BASE_URL}${url}`; // 로컬 상대 경로
}

/**
 * 인증 헤더 가져오기 — localStorage에서 토큰 읽기.
 */
function getAuthHeader(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('auth_token');
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
}

interface FetchOptions extends RequestInit {
    params?: Record<string, string>;
}

export const api = {
    get: async <T>(endpoint: string, options?: FetchOptions): Promise<T> => {
        const url = new URL(`${API_BASE_URL}${endpoint}`);
        if (options?.params) {
            Object.entries(options.params).forEach(([key, value]) => {
                url.searchParams.append(key, value);
            });
        }
        const response = await fetch(url.toString(), {
            ...options,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
                ...getAuthHeader(),
                ...options?.headers,
            },
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return response.json();
    },

    post: async <T>(endpoint: string, data?: unknown, options?: FetchOptions): Promise<T> => {
        const url = new URL(`${API_BASE_URL}${endpoint}`);
        if (options?.params) {
            Object.entries(options.params).forEach(([key, value]) => {
                url.searchParams.append(key, value);
            });
        }
        const response = await fetch(url.toString(), {
            ...options,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
                ...getAuthHeader(),
                ...options?.headers,
            },
            body: data ? JSON.stringify(data) : undefined,
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return response.json();
    },

    patch: async <T>(endpoint: string, data?: unknown, options?: FetchOptions): Promise<T> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
                ...getAuthHeader(),
                ...options?.headers,
            },
            body: data ? JSON.stringify(data) : undefined,
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return response.json();
    },

    put: async <T>(endpoint: string, data?: unknown, options?: FetchOptions): Promise<T> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
                ...getAuthHeader(),
                ...options?.headers,
            },
            body: data ? JSON.stringify(data) : undefined,
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return response.json();
    },

    delete: async <T>(endpoint: string, options?: FetchOptions): Promise<T | void> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
                ...getAuthHeader(),
                ...options?.headers,
            },
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        // Handle 204 No Content
        if (response.status === 204 || response.headers.get('content-length') === '0') {
            return undefined as T;
        }
        const text = await response.text();
        return text ? JSON.parse(text) : undefined;
    },
};
