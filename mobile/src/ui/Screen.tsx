import React from 'react';
import { View, StyleSheet, ViewStyle, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

type ScreenProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  safeBottom?: boolean;
};

export function Screen({ children, style, safeBottom = true }: ScreenProps) {
  return (
    <SafeAreaView
      style={[styles.container, style]}
      edges={safeBottom ? ['top', 'bottom', 'left', 'right'] : ['top', 'left', 'right']}
    >
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
