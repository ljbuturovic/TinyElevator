import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" options={{ orientation: 'portrait' }} />
        <Stack.Screen name="artifact/[id]" options={{ orientation: 'default' }} />
      </Stack>
    </>
  );
}
