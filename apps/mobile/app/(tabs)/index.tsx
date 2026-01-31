import { ScrollView, TouchableOpacity, View, Text } from 'react-native';

/**
 * 테마 시스템 테스트 화면
 * NativeWind + CSS Variables 사용 예시
 */
const TabOneScreen = () => {
  return (
    <ScrollView className="flex-1 bg-background p-4 pt-16">
      <Text className="text-2xl font-bold text-foreground mb-4">
        테마 시스템 테스트
      </Text>

      {/* 컬러 팔레트 */}
      <View className="bg-card p-4 rounded-lg mt-4">
        <Text className="text-lg font-semibold text-card-foreground mb-3">
          컬러 팔레트
        </Text>
        <View className="flex-row gap-2">
          <View className="w-12 h-12 rounded-md bg-primary" />
          <View className="w-12 h-12 rounded-md bg-secondary" />
          <View className="w-12 h-12 rounded-md bg-success" />
          <View className="w-12 h-12 rounded-md bg-warning" />
          <View className="w-12 h-12 rounded-md bg-destructive" />
        </View>
      </View>

      {/* 타이포그래피 */}
      <View className="bg-card p-4 rounded-lg mt-4">
        <Text className="text-lg font-semibold text-card-foreground mb-3">
          타이포그래피
        </Text>
        <Text className="text-2xl font-bold text-foreground">H1 제목</Text>
        <Text className="text-xl font-semibold text-foreground">H2 제목</Text>
        <Text className="text-lg font-medium text-foreground">H3 제목</Text>
        <Text className="text-base text-foreground">Body 본문 텍스트</Text>
        <Text className="text-sm text-muted-foreground">Caption 캡션</Text>
      </View>

      {/* 버튼 스타일 */}
      <View className="bg-card p-4 rounded-lg mt-4">
        <Text className="text-lg font-semibold text-card-foreground mb-3">
          버튼 스타일
        </Text>
        <TouchableOpacity className="bg-primary py-3 px-4 rounded-lg">
          <Text className="text-primary-foreground text-center font-semibold">
            Primary 버튼
          </Text>
        </TouchableOpacity>
        <View className="h-2" />
        <TouchableOpacity className="bg-secondary py-3 px-4 rounded-lg">
          <Text className="text-secondary-foreground text-center font-semibold">
            Secondary 버튼
          </Text>
        </TouchableOpacity>
        <View className="h-2" />
        <TouchableOpacity className="border border-border py-3 px-4 rounded-lg">
          <Text className="text-foreground text-center font-semibold">
            Outline 버튼
          </Text>
        </TouchableOpacity>
      </View>

      {/* 카드 스타일 */}
      <View className="bg-card p-4 rounded-lg mt-4 mb-8">
        <Text className="text-lg font-semibold text-card-foreground mb-3">
          카드 스타일
        </Text>
        <View className="bg-muted p-4 rounded-lg">
          <Text className="text-muted-foreground">
            이것은 카드 컴포넌트 예시입니다.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

// Expo Router requires default export for route components
export default TabOneScreen;
