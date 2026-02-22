/**
 * 인증 유틸 — 로그인, 로그아웃, 세션 관리.
 */

import { API_BASE_URL } from './api';

const TOKEN_KEY = 'auth_token';

export interface AuthUser {
    id: string;
    username: string;
    display_name: string | null;
    role: 'admin' | 'tester';
    allowed_routes: string[];
}

// -----------------------------------------------------------
// Token 관리
// -----------------------------------------------------------

export function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
}

// -----------------------------------------------------------
// Auth API
// -----------------------------------------------------------

export async function login(username: string, password: string): Promise<{
    token: string;
    username: string;
    display_name: string | null;
    role: string;
}> {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: 'Login failed' }));
        throw new Error(error.detail || 'Login failed');
    }

    const data = await res.json();
    setToken(data.token);
    return data;
}

export async function fetchMe(): Promise<AuthUser | null> {
    const token = getToken();
    if (!token) return null;

    try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
            removeToken();
            return null;
        }

        return await res.json();
    } catch {
        return null;
    }
}

export function logout(): void {
    removeToken();
    window.location.href = '/login';
}

// -----------------------------------------------------------
// Auth Header Helper
// -----------------------------------------------------------

export function getAuthHeaders(): Record<string, string> {
    const token = getToken();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
}
