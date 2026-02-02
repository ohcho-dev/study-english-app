import { Screen } from '@/shared/reusables/ui/screen';
import { Text } from '@/shared/reusables/ui/text';

const TabTwoScreen = () => {
  return (
    <Screen className="items-center justify-center">
      <Text variant="h3">Tab Two</Text>
    </Screen>
  );
};

// Expo Router requires default export for route components
export default TabTwoScreen;
