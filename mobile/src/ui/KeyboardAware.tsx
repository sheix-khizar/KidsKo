import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleProp,
  ViewStyle,
  LayoutChangeEvent,
} from 'react-native';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Extra padding above keyboard if needed */
  extraOffset?: number;
  /** Disable dynamic adjustment temporarily */
  enabled?: boolean;
};

/**
 * Cross-platform keyboard avoidance that works reliably on iOS AND Android
 * (including Android 15+ edgeToEdgeEnabled windows and <Modal> overlays where
 * windowSoftInputMode="adjustResize" does not resize the viewport).
 */
export function KeyboardAwareView({
  children,
  style,
  extraOffset = 0,
  enabled = true,
}: Props) {
  const containerRef = useRef<View | null>(null);
  const keyboardTopRef = useRef<number | null>(null);
  const keyboardHeightRef = useRef<number>(0);
  const restHeightRef = useRef<number>(0);
  const [androidBottomPad, setAndroidBottomPad] = useState(0);

  const recalculateAndroidOverlap = () => {
    if (Platform.OS !== 'android' || !enabled) return;
    const kbTop = keyboardTopRef.current;
    const kbHeight = keyboardHeightRef.current;
    if (kbTop === null) {
      setAndroidBottomPad(0);
      return;
    }

    containerRef.current?.measureInWindow((_x, y, _width, height) => {
      if (!height) return;

      // If Android adjustResize already shrunk this container by >=45% of keyboard height,
      // don't add duplicate padding.
      const osShrunk = restHeightRef.current > 0 ? Math.max(0, restHeightRef.current - height) : 0;
      if (kbHeight > 0 && osShrunk >= kbHeight * 0.45) {
        setAndroidBottomPad(0);
        return;
      }

      const viewBottom = y + height;
      const overlap = Math.max(0, Math.round(viewBottom - kbTop + extraOffset));
      setAndroidBottomPad((prev) => (Math.abs(prev - overlap) > 2 ? overlap : prev));
    });
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTopRef.current = event.endCoordinates?.screenY ?? null;
      keyboardHeightRef.current = event.endCoordinates?.height ?? 0;
      requestAnimationFrame(() => {
        recalculateAndroidOverlap();
      });
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTopRef.current = null;
      keyboardHeightRef.current = 0;
      setAndroidBottomPad(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [enabled, extraOffset]);

  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView
        style={[{ flex: 1 }, style]}
        behavior="padding"
        keyboardVerticalOffset={extraOffset}
        enabled={enabled}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }

  const handleLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (keyboardTopRef.current === null && h > 0) {
      restHeightRef.current = h;
    } else if (keyboardTopRef.current !== null) {
      recalculateAndroidOverlap();
    }
  };

  return (
    <View
      ref={containerRef}
      onLayout={handleLayout}
      style={[
        { flex: 1 },
        style,
        enabled && androidBottomPad > 0 ? { paddingBottom: androidBottomPad } : null,
      ]}
    >
      {children}
    </View>
  );
}
