import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { Flame, BookOpen, Trophy, Star, AlertCircle, Info, Mic, Play, ChevronRight, type LucideIcon } from 'lucide-react-native';

// UI Components
import { Text } from '@/shared/reusables/ui/text';
import { Button } from '@/shared/reusables/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/shared/reusables/ui/card';
import { Progress } from '@/shared/reusables/ui/progress';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/reusables/ui/avatar';
import { Badge } from '@/shared/reusables/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/shared/reusables/ui/alert';
import { Input } from '@/shared/reusables/ui/input';
import { Label } from '@/shared/reusables/ui/label';
import { Separator } from '@/shared/reusables/ui/separator';
import { Skeleton } from '@/shared/reusables/ui/skeleton';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/shared/reusables/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from '@/shared/reusables/ui/dialog';
import { Icon } from '@/shared/reusables/ui/icon';

/**
 * Design System Showcase Page
 * 영어 학습 앱에 맞게 스타일링된 컴포넌트 예시
 */
export const DesignSystemPage = () => {
    const [progressValue] = React.useState(65);
    const [inputValue, setInputValue] = React.useState('');

    return (
        <ScrollView className="flex-1 bg-background">
            <View className="p-4 pt-16 pb-20">
                {/* Header */}
                <View className="mb-6">
                    <Text variant="h3" className="text-foreground mb-1">
                        🎨 Design System
                    </Text>
                    <Text className="text-muted-foreground">
                        영어 학습 앱 컴포넌트 라이브러리
                    </Text>
                </View>

                {/* ========== Color Palette ========== */}
                <SectionTitle title="🎨 Color Palette" />
                <Card>
                    <CardContent className="pt-6">
                        <View className="flex-row flex-wrap gap-3">
                            <ColorSwatch color="bg-primary" label="Primary" />
                            <ColorSwatch color="bg-secondary" label="Secondary" />
                            <ColorSwatch color="bg-success" label="Success" />
                            <ColorSwatch color="bg-warning" label="Warning" />
                            <ColorSwatch color="bg-destructive" label="Destructive" />
                            <ColorSwatch color="bg-muted" label="Muted" />
                            <ColorSwatch color="bg-accent" label="Accent" />
                        </View>
                    </CardContent>
                </Card>

                {/* ========== Typography ========== */}
                <SectionTitle title="📝 Typography" />
                <Card>
                    <CardContent className="pt-6 gap-2">
                        <Text variant="h1">H1 레벨 테스트</Text>
                        <Text variant="h2">H2 오늘의 학습</Text>
                        <Text variant="h3">H3 스피킹 연습</Text>
                        <Text variant="h4">H4 단어 퀴즈</Text>
                        <Text variant="p">Body 텍스트 - 매일 10분씩 영어 회화를 연습해보세요.</Text>
                        <Text variant="lead">Lead 텍스트 - AI 튜터와 대화해보세요</Text>
                        <Text variant="muted">Muted - 2,345명이 학습 중</Text>
                        <Text variant="small">Small - 마지막 학습: 5분 전</Text>
                    </CardContent>
                </Card>

                {/* ========== Buttons ========== */}
                <SectionTitle title="🔘 Buttons" />
                <Card>
                    <CardContent className="pt-6 gap-3">
                        <Button>
                            <Icon as={Play} className="size-4 text-primary-foreground" />
                            <Text>학습 시작하기</Text>
                        </Button>
                        <Button variant="secondary">
                            <Icon as={Mic} className="size-4 text-secondary-foreground" />
                            <Text>스피킹 연습</Text>
                        </Button>
                        <Button variant="outline">
                            <Icon as={BookOpen} className="size-4 text-foreground" />
                            <Text>복습하기</Text>
                        </Button>
                        <Button variant="ghost">
                            <Text>건너뛰기</Text>
                        </Button>
                        <Button variant="destructive">
                            <Text>학습 취소</Text>
                        </Button>
                        <View className="flex-row gap-2">
                            <Button size="sm">
                                <Text>Small</Text>
                            </Button>
                            <Button size="default">
                                <Text>Default</Text>
                            </Button>
                            <Button size="lg">
                                <Text>Large</Text>
                            </Button>
                        </View>
                    </CardContent>
                </Card>

                {/* ========== Cards ========== */}
                <SectionTitle title="🃏 Cards" />

                {/* Lesson Card */}
                <Card className="mb-4">
                    <CardHeader>
                        <View className="flex-row items-center justify-between">
                            <Badge>
                                <Text>Day 23</Text>
                            </Badge>
                            <View className="flex-row items-center gap-1">
                                <Icon as={Flame} className="size-4 text-primary" />
                                <Text className="text-primary font-semibold">7일 연속</Text>
                            </View>
                        </View>
                        <CardTitle>카페에서 주문하기</CardTitle>
                        <CardDescription>원어민처럼 자연스럽게 커피 주문해보세요</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <View className="gap-2">
                            <View className="flex-row justify-between">
                                <Text className="text-muted-foreground text-sm">진행률</Text>
                                <Text className="text-foreground text-sm font-medium">{progressValue}%</Text>
                            </View>
                            <Progress value={progressValue} />
                        </View>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full">
                            <Text>이어서 학습하기</Text>
                            <Icon as={ChevronRight} className="size-4 text-primary-foreground" />
                        </Button>
                    </CardFooter>
                </Card>

                {/* Stats Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>이번 주 학습 현황</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <View className="flex-row justify-between">
                            <StatItem icon={BookOpen} value="23" label="완료 레슨" />
                            <StatItem icon={Star} value="450" label="획득 XP" />
                            <StatItem icon={Trophy} value="Level 3" label="현재 레벨" />
                        </View>
                    </CardContent>
                </Card>

                {/* ========== Progress ========== */}
                <SectionTitle title="📊 Progress" />
                <Card>
                    <CardContent className="pt-6 gap-4">
                        <View>
                            <Text className="text-sm text-muted-foreground mb-2">CEFR Level Progress</Text>
                            <Progress value={35} />
                            <Text className="text-xs text-muted-foreground mt-1">A2 → B1 (35%)</Text>
                        </View>
                        <View>
                            <Text className="text-sm text-muted-foreground mb-2">오늘의 목표 달성률</Text>
                            <Progress value={80} indicatorClassName="bg-success" />
                            <Text className="text-xs text-muted-foreground mt-1">8/10 레슨 완료</Text>
                        </View>
                    </CardContent>
                </Card>

                {/* ========== Avatar & Badge ========== */}
                <SectionTitle title="👤 Avatar & Badge" />
                <Card>
                    <CardContent className="pt-6">
                        <View className="flex-row items-center gap-4 mb-4">
                            <Avatar className="size-16" alt="John Doe">
                                <AvatarImage source={{ uri: 'https://github.com/shadcn.png' }} />
                                <AvatarFallback>
                                    <Text>JD</Text>
                                </AvatarFallback>
                            </Avatar>
                            <View className="flex-1">
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-lg font-semibold">John Doe</Text>
                                    <Badge variant="secondary">
                                        <Text>PRO</Text>
                                    </Badge>
                                </View>
                                <Text className="text-muted-foreground">Level 5 • 연속 42일</Text>
                            </View>
                        </View>
                        <Separator className="my-4" />
                        <Text className="text-sm text-muted-foreground mb-3">Badges</Text>
                        <View className="flex-row flex-wrap gap-2">
                            <Badge>
                                <Text>Primary</Text>
                            </Badge>
                            <Badge variant="secondary">
                                <Text>Secondary</Text>
                            </Badge>
                            <Badge variant="destructive">
                                <Text>Destructive</Text>
                            </Badge>
                            <Badge variant="outline">
                                <Text>Outline</Text>
                            </Badge>
                        </View>
                    </CardContent>
                </Card>

                {/* ========== Input & Label ========== */}
                <SectionTitle title="📝 Input & Label" />
                <Card>
                    <CardContent className="pt-6 gap-4">
                        <View className="gap-2">
                            <Label>닉네임</Label>
                            <Input
                                placeholder="영어 닉네임을 입력하세요"
                                value={inputValue}
                                onChangeText={setInputValue}
                            />
                        </View>
                        <View className="gap-2">
                            <Label>이메일</Label>
                            <Input
                                placeholder="email@example.com"
                                keyboardType="email-address"
                            />
                        </View>
                        <View className="gap-2">
                            <Label>비활성화 입력</Label>
                            <Input
                                placeholder="수정할 수 없습니다"
                                editable={false}
                            />
                        </View>
                    </CardContent>
                </Card>

                {/* ========== Alert ========== */}
                <SectionTitle title="🔔 Alert" />
                <Card>
                    <CardContent className="pt-6 gap-4">
                        <Alert icon={Info}>
                            <AlertTitle>학습 팁</AlertTitle>
                            <AlertDescription>
                                매일 같은 시간에 학습하면 습관이 됩니다.
                            </AlertDescription>
                        </Alert>
                        <Alert icon={AlertCircle} variant="destructive">
                            <AlertTitle>스트릭 위험!</AlertTitle>
                            <AlertDescription>
                                오늘 학습을 완료하지 않으면 연속 기록이 끊깁니다.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

                {/* ========== Dialog ========== */}
                <SectionTitle title="💬 Dialog" />
                <Card>
                    <CardContent className="pt-6 gap-4">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline">
                                    <Text>레슨 완료 Dialog</Text>
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>🎉 레슨 완료!</DialogTitle>
                                    <DialogDescription>
                                        "카페에서 주문하기" 레슨을 완료했습니다. 85점을 획득했어요!
                                    </DialogDescription>
                                </DialogHeader>
                                <View className="flex-row items-center justify-center gap-4 py-4">
                                    <View className="items-center">
                                        <Text className="text-2xl font-bold text-primary">+50</Text>
                                        <Text className="text-muted-foreground text-sm">XP</Text>
                                    </View>
                                    <Separator orientation="vertical" className="h-12" />
                                    <View className="items-center">
                                        <Text className="text-2xl font-bold text-success">85%</Text>
                                        <Text className="text-muted-foreground text-sm">정확도</Text>
                                    </View>
                                </View>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button>
                                            <Text>다음 레슨으로</Text>
                                        </Button>
                                    </DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive">
                                    <Text>학습 종료 확인</Text>
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>학습을 종료하시겠어요?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        지금 종료하면 진행 중인 레슨이 저장되지 않습니다.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>
                                        <Text>계속 학습하기</Text>
                                    </AlertDialogCancel>
                                    <AlertDialogAction>
                                        <Text>종료하기</Text>
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>

                {/* ========== Skeleton ========== */}
                <SectionTitle title="💀 Skeleton (Loading)" />
                <Card>
                    <CardContent className="pt-6">
                        <View className="flex-row items-center gap-4">
                            <Skeleton className="size-12 rounded-full" />
                            <View className="flex-1 gap-2">
                                <Skeleton className="h-4 w-3/4 rounded" />
                                <Skeleton className="h-3 w-1/2 rounded" />
                            </View>
                        </View>
                        <View className="mt-4 gap-3">
                            <Skeleton className="h-20 w-full rounded-lg" />
                            <Skeleton className="h-4 w-full rounded" />
                            <Skeleton className="h-4 w-2/3 rounded" />
                        </View>
                    </CardContent>
                </Card>

                {/* ========== Separator ========== */}
                <SectionTitle title="➖ Separator" />
                <Card>
                    <CardContent className="pt-6">
                        <Text className="text-foreground">첫 번째 섹션</Text>
                        <Separator className="my-4" />
                        <Text className="text-foreground">두 번째 섹션</Text>
                        <View className="flex-row items-center gap-4 my-4">
                            <Text className="text-muted-foreground">왼쪽</Text>
                            <Separator orientation="vertical" className="h-4" />
                            <Text className="text-muted-foreground">오른쪽</Text>
                        </View>
                    </CardContent>
                </Card>

            </View>
        </ScrollView>
    );
};

// ========== Helper Components ==========

const SectionTitle = ({ title }: { title: string }) => (
    <Text className="text-lg font-semibold text-foreground mt-6 mb-3">{title}</Text>
);

const ColorSwatch = ({ color, label }: { color: string; label: string }) => (
    <View className="items-center">
        <View className={`w-12 h-12 rounded-lg ${color}`} />
        <Text className="text-xs text-muted-foreground mt-1">{label}</Text>
    </View>
);


interface StatItemProps {
    icon: LucideIcon;
    value: string;
    label: string;
}

const StatItem = ({ icon: IconComponent, value, label }: StatItemProps) => (
    <View className="items-center">
        <Icon as={IconComponent} className="size-5 text-primary mb-1" />
        <Text className="text-lg font-bold text-foreground">{value}</Text>
        <Text className="text-xs text-muted-foreground">{label}</Text>
    </View>
);
