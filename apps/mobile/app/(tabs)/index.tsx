import { Text } from '@/shared/reusables/ui/text';
import { Button } from '@/shared/reusables/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/reusables/ui/card';
import { Screen } from '@/shared/reusables/ui/screen';
import { View } from 'react-native';
import { useThemeColors } from '@/shared';

/**
 * 테마 시스템 테스트 화면
 * Screen 컴포넌트로 배경색 자동 적용
 */
const TabOneScreen = () => {
  const colors = useThemeColors();

  return (
    <Screen scrollable padded safeTop>
      <Text variant="h3" className="mb-4">
        테마 시스템 테스트
      </Text>

      {/* 컬러 팔레트 */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>컬러 팔레트</CardTitle>
        </CardHeader>
        <CardContent>
          <View className="flex-row gap-2">
            <View className="w-12 h-12 rounded-md" style={{ backgroundColor: colors.primary }} />
            <View className="w-12 h-12 rounded-md" style={{ backgroundColor: colors.secondary }} />
            <View className="w-12 h-12 rounded-md" style={{ backgroundColor: colors.success }} />
            <View className="w-12 h-12 rounded-md" style={{ backgroundColor: colors.warning }} />
            <View className="w-12 h-12 rounded-md" style={{ backgroundColor: colors.destructive }} />
          </View>
        </CardContent>
      </Card>

      {/* 타이포그래피 */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>타이포그래피</CardTitle>
        </CardHeader>
        <CardContent className="gap-1">
          <Text variant="h1">H1 제목</Text>
          <Text variant="h2">H2 제목</Text>
          <Text variant="h3">H3 제목</Text>
          <Text variant="p">Body 본문 텍스트</Text>
          <Text variant="muted">Caption 캡션</Text>
        </CardContent>
      </Card>

      {/* 버튼 스타일 */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>버튼 스타일</CardTitle>
        </CardHeader>
        <CardContent className="gap-2">
          <Button>
            <Text>Primary 버튼</Text>
          </Button>
          <Button variant="secondary">
            <Text>Secondary 버튼</Text>
          </Button>
          <Button variant="outline">
            <Text>Outline 버튼</Text>
          </Button>
        </CardContent>
      </Card>

      {/* 카드 스타일 */}
      <Card className="mt-4 mb-8">
        <CardHeader>
          <CardTitle>카드 스타일</CardTitle>
        </CardHeader>
        <CardContent>
          <View
            className="p-4 rounded-lg"
            style={{ backgroundColor: colors.muted }}
          >
            <Text variant="muted">
              이것은 카드 컴포넌트 예시입니다.
            </Text>
          </View>
        </CardContent>
      </Card>
    </Screen>
  );
};

// Expo Router requires default export for route components
export default TabOneScreen;
