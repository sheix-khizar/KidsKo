import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';

export type LinearGradientProps = ViewProps & {
  colors: readonly string[] | string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  locations?: number[];
  children?: React.ReactNode;
};

/**
 * Universal safe LinearGradient component.
 * Fallbacks to a sleek solid-fill View with the primary gradient color
 * ensuring 100% compatibility across dev client APKs where native
 * ExpoLinearGradient view manager has not been pre-compiled into the binary.
 */
export function LinearGradient({
  colors,
  style,
  children,
  ...props
}: LinearGradientProps) {
  const primaryColor = colors && colors.length > 0 ? colors[0] : 'transparent';

  return (
    <View
      style={[
        { backgroundColor: primaryColor },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

export default LinearGradient;
