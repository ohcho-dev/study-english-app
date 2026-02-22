'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { fetchMe, getToken, logout, type AuthUser } from '@/(fsd)/shared/lib/auth';

interface AuthContextValue {
    user: AuthUser | null;
    loading: boolean;
    logout: () => void;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
    user: null,
    loading: true,
    logout: () => { },
    refresh: async () => { },
});

export const useAuth = () => useContext(AuthContext);

/**
 * 현재 경로가 허용된 경로 목록에 포함되는지 확인.
 * /conversations/my-turn/xxx 같은 하위 경로도 /conversations/my-turn 에 매칭.
 */
function isRouteAllowed(pathname: string, allowedRoutes: string[]): boolean {
    return allowedRoutes.some((route) =>
        pathname === route || pathname.startsWith(route + '/')
    );
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const refresh = useCallback(async () => {
        const token = getToken();
        if (!token) {
            setUser(null);
            setLoading(false);
            if (pathname !== '/login') {
                router.replace('/login');
            }
            return;
        }

        const me = await fetchMe();
        setUser(me);
        setLoading(false);

        if (!me && pathname !== '/login') {
            router.replace('/login');
        }
    }, [pathname, router]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // tester 경로 접근 제어
    useEffect(() => {
        if (!user || user.role === 'admin' || pathname === '/login') return;

        if (!isRouteAllowed(pathname, user.allowed_routes)) {
            // 허용된 첫 번째 경로로 리다이렉트
            const fallback = user.allowed_routes[0] || '/';
            router.replace(fallback);
        }
    }, [user, pathname, router]);

    // 로그인 페이지에서는 로딩 없이 바로 렌더
    if (pathname === '/login') {
        return (
            <AuthContext.Provider value={{ user, loading: false, logout, refresh }}>
                {children}
            </AuthContext.Provider>
        );
    }

    // 인증 확인 중 또는 리다이렉트 중
    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-muted-foreground text-sm">로딩 중...</div>
            </div>
        );
    }

    // tester가 허용되지 않은 경로 → 로딩 표시 (리다이렉트 중)
    if (user.role !== 'admin' && !isRouteAllowed(pathname, user.allowed_routes)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-muted-foreground text-sm">접근 권한이 없습니다. 이동 중...</div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, loading, logout, refresh }}>
            {children}
        </AuthContext.Provider>
    );
};
