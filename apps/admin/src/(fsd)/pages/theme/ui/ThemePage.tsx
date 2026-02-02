'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import { Save, Upload, Plus, Check, Loader2 } from 'lucide-react';
import {
    DEFAULT_THEME_TEMPLATE,
    type ThemeColors,
} from '@/entities/theme';
import {
    ThemeColorForm,
    ThemeVersionHistory,
    JsonUploadModal,
    SaveVersionDialog,
    useThemes,
    useTheme,
    useCreateTheme,
    useCreateThemeVersion,
    useUpdateTheme,
    useRollbackTheme,
} from '@/features/theme-form';

export const ThemePage = () => {
    // State
    const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [defaultMode, setDefaultMode] = useState<'light' | 'dark' | 'system'>('system');
    const [lightMode, setLightMode] = useState<ThemeColors>(DEFAULT_THEME_TEMPLATE.light_mode as ThemeColors);
    const [darkMode, setDarkMode] = useState<ThemeColors>(DEFAULT_THEME_TEMPLATE.dark_mode as ThemeColors);
    const [jsonModalOpen, setJsonModalOpen] = useState(false);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Queries
    const { data: themesData, isLoading: isLoadingThemes } = useThemes();
    const { data: selectedTheme } = useTheme(selectedThemeId);

    // Mutations
    const createTheme = useCreateTheme();
    const createVersion = useCreateThemeVersion();
    const updateTheme = useUpdateTheme();
    const rollbackTheme = useRollbackTheme();

    // Load selected theme data
    useEffect(() => {
        if (selectedTheme?.current_version) {
            setName(selectedTheme.name);
            setDescription(selectedTheme.description || '');
            setDefaultMode(selectedTheme.default_mode || 'system');
            setLightMode(selectedTheme.current_version.light_mode as ThemeColors);
            setDarkMode(selectedTheme.current_version.dark_mode as ThemeColors);
            setHasChanges(false);
        }
    }, [selectedTheme]);

    // Handlers
    const handleLightModeChange = (key: keyof ThemeColors, value: string) => {
        setLightMode((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleDarkModeChange = (key: keyof ThemeColors, value: string) => {
        setDarkMode((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleJsonApply = (data: { light_mode: ThemeColors; dark_mode: ThemeColors }) => {
        setLightMode(data.light_mode);
        setDarkMode(data.dark_mode);
        setHasChanges(true);
    };

    const handleCreateNew = () => {
        setSelectedThemeId(null);
        setName('새 테마');
        setDescription('');
        setLightMode(DEFAULT_THEME_TEMPLATE.light_mode as ThemeColors);
        setDarkMode(DEFAULT_THEME_TEMPLATE.dark_mode as ThemeColors);
        setHasChanges(true);
    };

    const handleSaveClick = () => {
        if (!name.trim()) return;
        setSaveDialogOpen(true);
    };

    const handleSave = async (versionDescription: string) => {
        if (!name.trim()) return;

        if (selectedThemeId) {
            // Update existing theme - create new version with description
            await createVersion.mutateAsync({
                themeId: selectedThemeId,
                data: {
                    description: versionDescription || undefined,
                    light_mode: lightMode,
                    dark_mode: darkMode
                },
            });
            // Update name/description if changed
            if (name !== selectedTheme?.name || description !== selectedTheme?.description) {
                await updateTheme.mutateAsync({
                    themeId: selectedThemeId,
                    data: { name, description: description || undefined },
                });
            }
        } else {
            // Create new theme
            const newTheme = await createTheme.mutateAsync({
                name,
                description: description || undefined,
                light_mode: lightMode,
                dark_mode: darkMode,
            });
            setSelectedThemeId(newTheme.id);
        }
        setHasChanges(false);
        setSaveDialogOpen(false);
    };

    const handleActivate = async () => {
        if (!selectedThemeId) return;
        await updateTheme.mutateAsync({
            themeId: selectedThemeId,
            data: { is_active: true },
        });
    };

    const handleRollback = async (versionId: string) => {
        if (!selectedThemeId) return;
        await rollbackTheme.mutateAsync({ themeId: selectedThemeId, versionId });
    };

    const isSaving = createTheme.isPending || createVersion.isPending || updateTheme.isPending;
    const isRollingBack = rollbackTheme.isPending;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">테마 관리</h1>
                    <p className="text-muted-foreground">
                        앱의 색상 테마를 설정합니다. 저장 시 버전이 기록됩니다.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setJsonModalOpen(true)}>
                        <Upload className="h-4 w-4 mr-2" />
                        JSON 업로드
                    </Button>
                    <Button variant="outline" onClick={handleCreateNew}>
                        <Plus className="h-4 w-4 mr-2" />
                        새 테마
                    </Button>
                    <Button onClick={handleSaveClick} disabled={isSaving || !hasChanges}>
                        {isSaving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        저장
                    </Button>
                </div>
            </div>

            {/* Theme Selector */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">테마 목록</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingThemes ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : themesData?.items.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">
                            등록된 테마가 없습니다. 새 테마를 만들어주세요.
                        </p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {themesData?.items.map((theme) => (
                                <Button
                                    key={theme.id}
                                    variant={selectedThemeId === theme.id ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setSelectedThemeId(theme.id)}
                                >
                                    {theme.name}
                                    {theme.is_active && (
                                        <Badge variant="secondary" className="ml-2 text-xs">
                                            활성
                                        </Badge>
                                    )}
                                </Button>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Theme Form */}
            {(selectedThemeId || hasChanges) && (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">기본 정보</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">테마 이름</label>
                                    <Input
                                        value={name}
                                        onChange={(e) => {
                                            setName(e.target.value);
                                            setHasChanges(true);
                                        }}
                                        placeholder="Premium Slate"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">설명</label>
                                    <Input
                                        value={description}
                                        onChange={(e) => {
                                            setDescription(e.target.value);
                                            setHasChanges(true);
                                        }}
                                        placeholder="어두운 슬레이트 색상 기반 테마"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">앱 기본 모드</label>
                                    <select
                                        value={defaultMode}
                                        onChange={async (e) => {
                                            const newMode = e.target.value as 'light' | 'dark' | 'system';
                                            setDefaultMode(newMode);
                                            if (!selectedThemeId) return;
                                            await updateTheme.mutateAsync({
                                                themeId: selectedThemeId,
                                                data: { default_mode: newMode },
                                            });
                                        }}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    >
                                        <option value="light">☀️ 라이트</option>
                                        <option value="dark">🌙 다크</option>
                                        <option value="system">🖥️ 시스템 설정</option>
                                    </select>
                                </div>
                            </div>
                            {selectedThemeId && !selectedTheme?.is_active && (
                                <Button variant="outline" size="sm" onClick={handleActivate}>
                                    <Check className="h-4 w-4 mr-2" />
                                    이 테마 활성화
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                    {/* Color Forms */}
                    <div className="grid grid-cols-2 gap-6">
                        <ThemeColorForm
                            mode="light"
                            colors={lightMode}
                            onChange={handleLightModeChange}
                        />
                        <ThemeColorForm
                            mode="dark"
                            colors={darkMode}
                            onChange={handleDarkModeChange}
                        />
                    </div>

                    {/* Version History */}
                    {selectedTheme && (
                        <ThemeVersionHistory
                            versions={selectedTheme.versions}
                            currentVersionId={selectedTheme.current_version?.id}
                            onRollback={handleRollback}
                            isRollingBack={isRollingBack}
                        />
                    )}
                </>
            )}

            {/* JSON Upload Modal */}
            <JsonUploadModal
                open={jsonModalOpen}
                onOpenChange={setJsonModalOpen}
                onApply={handleJsonApply}
            />

            {/* Save Version Dialog */}
            <SaveVersionDialog
                open={saveDialogOpen}
                onOpenChange={setSaveDialogOpen}
                onSave={handleSave}
                isSaving={isSaving}
            />
        </div>
    );
};

