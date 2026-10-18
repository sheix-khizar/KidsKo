import React, { useContext } from 'react';
import {
  View,
  StatusBar,
  Dimensions,
  UIManager,
  ViewProps,
  ViewStyle,
  StyleProp,
} from 'react-native';
import {
  SafeAreaProvider as RNSafeAreaProvider,
  useSafeAreaInsets as useRNSafeAreaInsets,
  SafeAreaInsetsContext,
  SafeAreaFrameContext,
  EdgeInsets,
  Edge,
  Rect,
} from 'react-native-safe-area-context';

/**
 * Check if the native safe area view manager is registered in the binary.
 * In dev clients built without native linking, fallback safely to JS context
 * so the app never throws IllegalViewOperationException in Fabric.
 */
export const hasNativeSafeArea = Boolean(
  typeof UIManager.getViewManagerConfig === 'function' &&
    (UIManager.getViewManagerConfig('RNCSafeAreaProvider') ||
      UIManager.getViewManagerConfig('RCTRNCSafeAreaProvider'))
);

const defaultInsets: EdgeInsets = {
  top: StatusBar.currentHeight ?? 24,
  bottom: 0,
  left: 0,
  right: 0,
};

const defaultFrame: Rect = {
  x: 0,
  y: 0,
  width: Dimensions.get('window').width,
  height: Dimensions.get('window').height,
};

export function SafeAreaProvider({
  children,
  style,
  ...rest
}: ViewProps & { children?: React.ReactNode }) {
  if (hasNativeSafeArea) {
    return (
      <RNSafeAreaProvider style={style} {...rest}>
        {children}
      </RNSafeAreaProvider>
    );
  }

  return (
    <SafeAreaFrameContext.Provider value={defaultFrame}>
      <SafeAreaInsetsContext.Provider value={defaultInsets}>
        <View style={[{ flex: 1 }, style]} {...rest}>
          {children}
        </View>
      </SafeAreaInsetsContext.Provider>
    </SafeAreaFrameContext.Provider>
  );
}

export function useSafeAreaInsets(): EdgeInsets {
  if (hasNativeSafeArea) {
    try {
      return useRNSafeAreaInsets();
    } catch {
      return defaultInsets;
    }
  }
  const context = useContext(SafeAreaInsetsContext);
  return context ?? defaultInsets;
}

export type SafeAreaViewProps = ViewProps & {
  children?: React.ReactNode;
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
};

export function SafeAreaView({
  children,
  style,
  edges = ['top', 'left', 'right'],
  ...rest
}: SafeAreaViewProps) {
  const insets = useSafeAreaInsets();
  const edgeList = Array.isArray(edges) ? edges : [];

  const paddingStyle: ViewStyle = {
    paddingTop: edgeList.includes('top') ? insets.top : 0,
    paddingBottom: edgeList.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edgeList.includes('left') ? insets.left : 0,
    paddingRight: edgeList.includes('right') ? insets.right : 0,
  };

  return (
    <View style={[style, paddingStyle]} {...rest}>
      {children}
    </View>
  );
}

export { SafeAreaInsetsContext, SafeAreaFrameContext };
export type { EdgeInsets, Edge, Rect };
