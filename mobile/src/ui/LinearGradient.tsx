import React from 'react';
import { View, UIManager } from 'react-native';
import { LinearGradient as ExpoLinearGradient, LinearGradientProps } from 'expo-linear-gradient';

const hasNativeGradient = Boolean(
  typeof UIManager.getViewManagerConfig === 'function' &&
  (UIManager.getViewManagerConfig('ExpoLinearGradient') || UIManager.getViewManagerConfig('ExponentLinearGradient'))
);

export function LinearGradient(props: LinearGradientProps) {
  if (!hasNativeGradient) {
    const firstColor = Array.isArray(props.colors) && props.colors.length > 0 ? (props.colors[0] as string) : '#FF6B6B';
    return <View style={[{ backgroundColor: firstColor }, props.style]}>{props.children}</View>;
  }
  return <ExpoLinearGradient {...props} />;
}

export type { LinearGradientProps };
export default LinearGradient;
