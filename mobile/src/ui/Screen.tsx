import React from 'react';
import { StyleSheet, ViewStyle, StatusBar } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors } from '../theme';

type ScreenProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  safeBottom?: boolean;
};

export function Screen({ children, style, safeBottom = true }: ScreenProps) {
  const edges: Edge[] = safeBottom
    ? ['top', 'bottom', 'left', 'right']
    : ['top', 'left', 'right'];

  return (
    <SafeAreaView edges={edges} style={[styles.container, style]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
