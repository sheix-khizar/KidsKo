import React from 'react';
import { StyleSheet, ViewStyle, StatusBar } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors } from '../theme';

type ScreenProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
  safeBottom?: boolean;
};

export function Screen({ children, style, edges = ['top', 'left', 'right'], safeBottom }: ScreenProps) {
  return (
    <SafeAreaView style={[styles.container, style]} edges={edges}>
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
