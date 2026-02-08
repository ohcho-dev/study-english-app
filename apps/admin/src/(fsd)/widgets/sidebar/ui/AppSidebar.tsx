'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/shared/ui/sidebar';
import {
    FlaskConical,
    Variable,
    MessageSquare,
    BarChart3,
    FileText,
    Palette,
    Users,
    Link as LinkIcon,
    TestTube,
    ScrollText,
    Mic,
    Layout,
    Clock,
} from 'lucide-react';

import { APP_NAME, ROUTES } from '@/shared/config';

interface MenuItem {
    title: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
}

interface MenuGroup {
    title: string;
    items: MenuItem[];
}

const menuItems: MenuGroup[] = [
    {
        title: '🧪 실험실',
        items: [
            { title: '변수 관리', href: ROUTES.lab.variables, icon: Variable },
            { title: 'AI 프롬프트', href: ROUTES.lab.prompts, icon: MessageSquare },
            { title: '분석 대시보드', href: ROUTES.lab.analytics, icon: BarChart3 },
        ],
    },
    {
        title: '🤖 AI Agent Lab',
        items: [
            { title: '파이프라인', href: ROUTES.aiLab.pipelines, icon: LinkIcon },
            { title: '실험 테스트', href: ROUTES.aiLab.experiment, icon: TestTube },
            { title: '실험 로그', href: ROUTES.aiLab.logs, icon: ScrollText },
        ],
    },
    {
        title: '🎙️ 대화 시나리오',
        items: [
            { title: '템플릿 관리', href: ROUTES.conversations.templates, icon: Layout },
            { title: '대화 실험', href: ROUTES.conversations.run0, icon: Mic },
            { title: '세션 기록', href: ROUTES.conversations.sessions, icon: Clock },
        ],
    },
    {
        title: '📦 콘텐츠',
        items: [
            { title: '시나리오 관리', href: ROUTES.contents.scenarios, icon: FileText },
        ],
    },
    {
        title: '⚙️ 앱관리',
        items: [
            { title: '테마 관리', href: ROUTES.settings.themes, icon: Palette },
            { title: '사용자 관리', href: ROUTES.settings.users, icon: Users },
        ],
    },
];

export const AppSidebar = () => {
    const pathname = usePathname();

    return (
        <Sidebar className="border-r border-sidebar-border">
            <SidebarHeader className="p-4">
                <Link href={ROUTES.home} className="flex items-center gap-2">
                    <FlaskConical className="h-6 w-6 text-primary" />
                    <span className="font-bold text-lg">{APP_NAME}</span>
                </Link>
            </SidebarHeader>
            <SidebarContent>
                {menuItems.map((group) => (
                    <SidebarGroup key={group.title}>
                        <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground">
                            {group.title}
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {group.items.map((item) => (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={pathname === item.href}
                                        >
                                            <Link href={item.href}>
                                                <item.icon className="h-4 w-4" />
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ))}
            </SidebarContent>
        </Sidebar>
    );
};
