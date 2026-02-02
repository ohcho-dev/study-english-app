import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Variable, MessageSquare, FileText, BarChart3 } from 'lucide-react';

const stats = [
    { title: '변수', value: '12', icon: Variable, change: '+2' },
    { title: '프롬프트', value: '8', icon: MessageSquare, change: '+1' },
    { title: '시나리오', value: '24', icon: FileText, change: '+5' },
    { title: '이벤트', value: '1.2K', icon: BarChart3, change: '+12%' },
];

export const DashboardPage = () => {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">대시보드</h1>
                <p className="text-muted-foreground">Research CMS 관리자 현황</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Card key={stat.title}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {stat.title}
                            </CardTitle>
                            <stat.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <div className="text-2xl font-bold">{stat.value}</div>
                                <Badge variant="secondary" className="text-xs">
                                    {stat.change}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>최근 활동</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            아직 활동 내역이 없습니다.
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>빠른 실행</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p className="text-muted-foreground">
                            • 변수 관리에서 Feature Flags 설정
                        </p>
                        <p className="text-muted-foreground">
                            • AI 프롬프트에서 새 프롬프트 테스트
                        </p>
                        <p className="text-muted-foreground">
                            • 시나리오 에디터에서 콘텐츠 생성
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
