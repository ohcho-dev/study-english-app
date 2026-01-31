import { StyleSheet } from 'react-native';

import EditScreenInfo from '@/components/EditScreenInfo';
import { Text, View } from '@/components/Themed';

export default function TabOneScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>How old r u?!</Text>
      <Text style={styles.title}>Moo!!!!?!?!</Text>
      <Text style={styles.title}>왜 웃냐?!</Text>
      <Text style={styles.title}>자쉭새뀌 쉼쉼한뒈</Text>
      <Text style={styles.title}>노롸주쥐도 안궈!</Text>
      <Text style={styles.title}>무우우우111!</Text>
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
      <EditScreenInfo path="app/(tabs)/index.tsx" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
});
