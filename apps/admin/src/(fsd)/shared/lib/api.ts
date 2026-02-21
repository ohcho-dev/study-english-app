export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

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
                ...options?.headers,
            },
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return response.json();
    },

    post: async <T>(endpoint: string, data?: unknown, options?: FetchOptions): Promise<T> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
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
