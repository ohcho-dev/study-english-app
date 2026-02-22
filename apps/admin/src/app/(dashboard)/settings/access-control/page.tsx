'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/(fsd)/shared/providers/AuthProvider';
import { api } from '@/(fsd)/shared/lib/api';
import { useRouter } from 'next/navigation';
import { Shield, Plus, Trash2, Users, FileText, Layout, KeyRound } from 'lucide-react';

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

interface Account {
    id: string;
    username: string;
    display_name: string | null;
    role: string;
    is_active: boolean;
}

interface Permission {
    id: string;
    route_path: string;
    route_name: string;
    route_group: string | null;
    is_public_to_tester: boolean;
}

interface TemplateVisibility {
    id: string;
    name: string;
    is_public_to_tester: boolean;
}

// -----------------------------------------------------------
// Component
// -----------------------------------------------------------

const AccessControlPage = () => {
    const { user } = useAuth();
    const router = useRouter();

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [templates, setTemplates] = useState<TemplateVisibility[]>([]);

    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newDisplayName, setNewDisplayName] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [changingPasswordId, setChangingPasswordId] = useState<string | null>(null);
    const [changePassword, setChangePassword] = useState('');

    // Admin 전용 페이지
    useEffect(() => {
        if (user && user.role !== 'admin') {
            router.push('/');
        }
    }, [user, router]);

    // 데이터 로드
    useEffect(() => {
        if (user?.role !== 'admin') return;
        loadData();
    }, [user]);

    const loadData = async () => {
        try {
            const [accs, perms, tmps] = await Promise.all([
                api.get<Account[]>('/api/v1/admin/accounts'),
                api.get<Permission[]>('/api/v1/admin/permissions'),
                api.get<TemplateVisibility[]>('/api/v1/admin/templates/visibility'),
            ]);
            setAccounts(accs);
            setPermissions(perms);
            setTemplates(tmps);
        } catch (err) {
            console.error('Failed to load access control data:', err);
        }
    };

    // -----------------------------------------------------------
    // Handlers
    // -----------------------------------------------------------

    const handleCreateAccount = async () => {
        if (!newUsername || !newPassword) return;
        try {
            await api.post('/api/v1/admin/accounts', {
                username: newUsername,
                password: newPassword,
                display_name: newDisplayName || null,
            });
            setNewUsername('');
            setNewPassword('');
            setNewDisplayName('');
            setShowCreateForm(false);
            await loadData();
        } catch (err) {
            alert('계정 생성 실패: 이미 존재하는 username일 수 있습니다.');
        }
    };

    const handleDeleteAccount = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
            await api.delete(`/api/v1/admin/accounts/${id}`);
            await loadData();
        } catch {
            alert('삭제 실패');
        }
    };

    const handleChangePassword = async (id: string) => {
        if (!changePassword) return;
        try {
            await api.put(`/api/v1/admin/accounts/${id}/password`, {
                new_password: changePassword,
            });
            setChangingPasswordId(null);
            setChangePassword('');
            alert('비밀번호가 변경되었습니다.');
        } catch {
            alert('비밀번호 변경 실패');
        }
    };

    const handleTogglePermission = (id: string) => {
        setPermissions((prev) =>
            prev.map((p) =>
                p.id === id ? { ...p, is_public_to_tester: !p.is_public_to_tester } : p
            )
        );
    };

    const handleSavePermissions = async () => {
        setSaving(true);
        try {
            await api.put('/api/v1/admin/permissions', {
                permissions: permissions.map((p) => ({
                    id: p.id,
                    is_public_to_tester: p.is_public_to_tester,
                })),
            });
        } catch {
            alert('저장 실패');
        }
        setSaving(false);
    };

    const handleToggleTemplate = (id: string) => {
        setTemplates((prev) =>
            prev.map((t) =>
                t.id === id ? { ...t, is_public_to_tester: !t.is_public_to_tester } : t
            )
        );
    };

    const handleSaveTemplates = async () => {
        setSaving(true);
        try {
            await api.put('/api/v1/admin/templates/visibility', {
                templates: templates.map((t) => ({
                    id: t.id,
                    is_public_to_tester: t.is_public_to_tester,
                })),
            });
        } catch {
            alert('저장 실패');
        }
        setSaving(false);
    };

    if (user?.role !== 'admin') return null;

    // 그룹별 정리
    const permissionGroups = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
        const group = p.route_group || '기타';
        if (!acc[group]) acc[group] = [];
        acc[group].push(p);
        return acc;
    }, {});

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-3">
                <Shield className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">접근 제어 설정</h1>
            </div>

            {/* ============================== */}
            {/* 테스터 계정 관리 */}
            {/* ============================== */}
            <section className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <h2 className="text-lg font-semibold">테스터 계정 관리</h2>
                    </div>
                    <button
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="flex items-center gap-1 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                    >
                        <Plus className="h-4 w-4" />
                        테스터 추가
                    </button>
                </div>

                {showCreateForm && (
                    <div className="mb-4 p-4 bg-muted/50 rounded-lg space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                            <input
                                type="text"
                                placeholder="Username"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                className="px-3 py-2 bg-background border border-input rounded-lg text-sm"
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="px-3 py-2 bg-background border border-input rounded-lg text-sm"
                            />
                            <input
                                type="text"
                                placeholder="표시명 (선택)"
                                value={newDisplayName}
                                onChange={(e) => setNewDisplayName(e.target.value)}
                                className="px-3 py-2 bg-background border border-input rounded-lg text-sm"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleCreateAccount}
                                className="text-sm px-4 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                            >
                                생성
                            </button>
                            <button
                                onClick={() => setShowCreateForm(false)}
                                className="text-sm px-4 py-1.5 bg-muted text-muted-foreground rounded-lg hover:bg-accent"
                            >
                                취소
                            </button>
                        </div>
                    </div>
                )}

                <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Username</th>
                                <th className="text-left px-4 py-2 font-medium text-muted-foreground">표시명</th>
                                <th className="text-left px-4 py-2 font-medium text-muted-foreground">역할</th>
                                <th className="text-left px-4 py-2 font-medium text-muted-foreground">상태</th>
                                <th className="text-right px-4 py-2 font-medium text-muted-foreground">액션</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {accounts.map((acc) => (
                                <tr key={acc.id}>
                                    <td className="px-4 py-2.5 font-mono text-foreground">{acc.username}</td>
                                    <td className="px-4 py-2.5 text-foreground">{acc.display_name || '-'}</td>
                                    <td className="px-4 py-2.5">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${acc.role === 'admin'
                                            ? 'bg-primary/10 text-primary'
                                            : 'bg-secondary/10 text-secondary'
                                            }`}>
                                            {acc.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        {changingPasswordId === acc.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="password"
                                                    placeholder="새 비밀번호"
                                                    value={changePassword}
                                                    onChange={(e) => setChangePassword(e.target.value)}
                                                    className="px-2 py-1 bg-background border border-input rounded text-xs w-28"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleChangePassword(acc.id)}
                                                    className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:opacity-90"
                                                >
                                                    저장
                                                </button>
                                                <button
                                                    onClick={() => { setChangingPasswordId(null); setChangePassword(''); }}
                                                    className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded hover:bg-accent"
                                                >
                                                    취소
                                                </button>
                                            </div>
                                        ) : (
                                            <span className={`text-xs ${acc.is_active ? 'text-success' : 'text-destructive'}`}>
                                                {acc.is_active ? '✅ 활성' : '❌ 비활성'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => { setChangingPasswordId(acc.id); setChangePassword(''); }}
                                                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                                title="비밀번호 변경"
                                            >
                                                <KeyRound className="h-4 w-4" />
                                            </button>
                                            {acc.role !== 'admin' && (
                                                <button
                                                    onClick={() => handleDeleteAccount(acc.id)}
                                                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                                                    title="삭제"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* ============================== */}
            {/* 페이지 공개 설정 */}
            {/* ============================== */}
            <section className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Layout className="h-5 w-5 text-muted-foreground" />
                        <h2 className="text-lg font-semibold">페이지 공개 설정 (테스터에게)</h2>
                    </div>
                    <button
                        onClick={handleSavePermissions}
                        disabled={saving}
                        className="text-sm px-4 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                    >
                        {saving ? '저장 중...' : '저장'}
                    </button>
                </div>

                <div className="space-y-4">
                    {Object.entries(permissionGroups).map(([group, perms]) => (
                        <div key={group}>
                            <h3 className="text-sm font-medium text-muted-foreground mb-2">{group}</h3>
                            <div className="space-y-1">
                                {perms.map((p) => (
                                    <label
                                        key={p.id}
                                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={p.is_public_to_tester}
                                            onChange={() => handleTogglePermission(p.id)}
                                            className="w-4 h-4 rounded accent-primary"
                                        />
                                        <span className="text-sm text-foreground">{p.route_name}</span>
                                        <span className="text-xs text-muted-foreground ml-auto font-mono">
                                            {p.route_path}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ============================== */}
            {/* 템플릿 공개 설정 */}
            {/* ============================== */}
            <section className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <h2 className="text-lg font-semibold">템플릿 공개 설정 (My Turn용)</h2>
                    </div>
                    <button
                        onClick={handleSaveTemplates}
                        disabled={saving}
                        className="text-sm px-4 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                    >
                        {saving ? '저장 중...' : '저장'}
                    </button>
                </div>

                <div className="space-y-1">
                    {templates.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                            활성 템플릿이 없습니다.
                        </p>
                    ) : (
                        templates.map((t) => (
                            <label
                                key={t.id}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={t.is_public_to_tester}
                                    onChange={() => handleToggleTemplate(t.id)}
                                    className="w-4 h-4 rounded accent-primary"
                                />
                                <span className="text-sm text-foreground">{t.name}</span>
                            </label>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
};

export default AccessControlPage;
