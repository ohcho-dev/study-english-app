import { View, Text } from 'react-native';

const TabTwoScreen = () => {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-xl font-bold text-foreground">Tab Two</Text>
    </View>
  );
};

// Expo Router requires default export for route components
export default TabTwoScreen;
