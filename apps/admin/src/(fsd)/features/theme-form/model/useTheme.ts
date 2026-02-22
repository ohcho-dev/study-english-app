'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    ThemeCreate,
    ThemeUpdate,
    ThemeVersionCreate,
    ThemeWithVersions,
} from '@/entities/theme';
import { API_BASE_URL } from '@/(fsd)/shared/lib/api';

const API_BASE = `${API_BASE_URL}/api/v1`;

// Fetch all themes
export const useThemes = () => {
    return useQuery<{ items: ThemeWithVersions[]; total: number }>({
        queryKey: ['themes'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/themes`);
            if (!res.ok) throw new Error('Failed to fetch themes');
            return res.json();
        },
    });
};

// Fetch single theme with versions
export const useTheme = (themeId: string | null) => {
    return useQuery<ThemeWithVersions>({
        queryKey: ['themes', themeId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/themes/${themeId}`);
            if (!res.ok) throw new Error('Failed to fetch theme');
            return res.json();
        },
        enabled: !!themeId,
    });
};

// Fetch active theme
export const useActiveTheme = () => {
    return useQuery<ThemeWithVersions | null>({
        queryKey: ['themes', 'active'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/themes/active`);
            if (!res.ok) throw new Error('Failed to fetch active theme');
            const data = await res.json();
            return data || null;
        },
    });
};

// Fetch JSON template
export const useThemeTemplate = () => {
    return useQuery<{ light_mode: Record<string, string>; dark_mode: Record<string, string> }>({
        queryKey: ['themes', 'template'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/themes/template`);
            if (!res.ok) throw new Error('Failed to fetch template');
            return res.json();
        },
    });
};

// Create theme
export const useCreateTheme = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: ThemeCreate) => {
            const res = await fetch(`${API_BASE}/themes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create theme');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['themes'] });
        },
    });
};

// Update theme metadata
export const useUpdateTheme = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ themeId, data }: { themeId: string; data: ThemeUpdate }) => {
            const res = await fetch(`${API_BASE}/themes/${themeId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update theme');
            return res.json();
        },
        onSuccess: (_, { themeId }) => {
            queryClient.invalidateQueries({ queryKey: ['themes'] });
            queryClient.invalidateQueries({ queryKey: ['themes', themeId] });
            queryClient.invalidateQueries({ queryKey: ['themes', 'active'] });
        },
    });
};

// Create new version (save)
export const useCreateThemeVersion = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ themeId, data }: { themeId: string; data: ThemeVersionCreate }) => {
            const res = await fetch(`${API_BASE}/themes/${themeId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create version');
            return res.json();
        },
        onSuccess: (_, { themeId }) => {
            queryClient.invalidateQueries({ queryKey: ['themes', themeId] });
            queryClient.invalidateQueries({ queryKey: ['themes', 'active'] });
        },
    });
};

// Rollback to version
export const useRollbackTheme = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ themeId, versionId }: { themeId: string; versionId: string }) => {
            const res = await fetch(`${API_BASE}/themes/${themeId}/rollback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version_id: versionId }),
            });
            if (!res.ok) throw new Error('Failed to rollback');
            return res.json();
        },
        onSuccess: (_, { themeId }) => {
            queryClient.invalidateQueries({ queryKey: ['themes', themeId] });
            queryClient.invalidateQueries({ queryKey: ['themes', 'active'] });
        },
    });
};
