import React from 'react';
import { View, StyleSheet, ViewStyle, StatusBar, SafeAreaView, Platform } from 'react-native';
import { colors } from '../theme';

type ScreenProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  safeBottom?: boolean;
};

export function Screen({ children, style, safeBottom = true }: ScreenProps) {
  return (
    <SafeAreaView
      style={[
        styles.container,
        Platform.OS === 'android' && { paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight / 2 : 0 },
        style,
      ]}
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
