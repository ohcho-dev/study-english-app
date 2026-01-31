import { StatusBar } from 'expo-status-bar';
import { Platform, View, Text } from 'react-native';

const ModalScreen = () => {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-xl font-bold text-foreground">Modal</Text>

      {/* Use a light status bar on iOS to account for the black space above the modal */}
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
};

// Expo Router requires default export for route components
export default ModalScreen;
