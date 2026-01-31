import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';

const NotFoundScreen = () => {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center p-5 bg-background">
        <Text className="text-xl font-bold text-foreground">
          This screen doesn't exist.
        </Text>

        <Link href="/" className="mt-4 py-4">
          <Text className="text-sm text-primary">Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
};

// Expo Router requires default export for route components
export default NotFoundScreen;
