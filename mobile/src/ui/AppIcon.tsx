import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';

export type AppIconName =
  | 'arrowRight'
  | 'arrowLeft'
  | 'chevronLeft'
  | 'chevronRight'
  | 'chevronDown'
  | 'chevronUp'
  | 'check'
  | 'close'
  | 'backspace'
  | 'send';

type AppIconProps = {
  name: AppIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Pure React Native geometric icon renderer.
 * Avoids Unicode arrow/check/close glyphs missing from the bundled Nunito font
 * that can render as broken characters ("´n") on some Android OEM fallback fonts.
 */
export function AppIcon({
  name,
  size = 16,
  color = '#1F2937',
  strokeWidth,
  style,
}: AppIconProps) {
  const stroke = strokeWidth ?? Math.max(2, Math.round(size * 0.14));

  if (name === 'arrowRight' || name === 'arrowLeft') {
    const isLeft = name === 'arrowLeft';
    const headSize = Math.round(size * 0.44);
    const shaftLen = Math.round(size * 0.72);
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
            transform: isLeft ? [{ rotate: '180deg' }] : undefined,
          },
          style,
        ]}
        pointerEvents="none"
      >
        <View
          style={{
            width: shaftLen,
            height: stroke,
            backgroundColor: color,
            borderRadius: stroke / 2,
          }}
        />
        <View
          style={{
            position: 'absolute',
            right: Math.round(size * 0.14),
            width: headSize,
            height: headSize,
            borderTopWidth: stroke,
            borderRightWidth: stroke,
            borderColor: color,
            borderTopRightRadius: 1.5,
            transform: [{ rotate: '45deg' }],
          }}
        />
      </View>
    );
  }

  if (
    name === 'chevronLeft' ||
    name === 'chevronRight' ||
    name === 'chevronDown' ||
    name === 'chevronUp'
  ) {
    const deg =
      name === 'chevronRight'
        ? '45deg'
        : name === 'chevronDown'
        ? '135deg'
        : name === 'chevronLeft'
        ? '-135deg'
        : '-45deg';
    const box = Math.round(size * 0.5);
    return (
      <View
        style={[
          { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
          style,
        ]}
        pointerEvents="none"
      >
        <View
          style={{
            width: box,
            height: box,
            borderTopWidth: stroke,
            borderRightWidth: stroke,
            borderColor: color,
            borderTopRightRadius: 1.5,
            transform: [{ rotate: deg }],
            marginLeft: name === 'chevronLeft' ? Math.round(size * 0.08) : name === 'chevronRight' ? -Math.round(size * 0.08) : 0,
            marginTop: name === 'chevronUp' ? Math.round(size * 0.08) : name === 'chevronDown' ? -Math.round(size * 0.08) : 0,
          }}
        />
      </View>
    );
  }

  if (name === 'check') {
    const w = Math.round(size * 0.62);
    const h = Math.round(size * 0.34);
    return (
      <View
        style={[
          { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
          style,
        ]}
        pointerEvents="none"
      >
        <View
          style={{
            width: w,
            height: h,
            borderLeftWidth: stroke,
            borderBottomWidth: stroke,
            borderColor: color,
            borderBottomLeftRadius: 1.5,
            transform: [{ rotate: '-45deg' }],
            marginTop: -Math.round(size * 0.08),
          }}
        />
      </View>
    );
  }

  if (name === 'close') {
    const len = Math.round(size * 0.72);
    return (
      <View
        style={[
          { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
          style,
        ]}
        pointerEvents="none"
      >
        <View
          style={{
            position: 'absolute',
            width: len,
            height: stroke,
            backgroundColor: color,
            borderRadius: stroke / 2,
            transform: [{ rotate: '45deg' }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: len,
            height: stroke,
            backgroundColor: color,
            borderRadius: stroke / 2,
            transform: [{ rotate: '-45deg' }],
          }}
        />
      </View>
    );
  }

  if (name === 'backspace') {
    const bodyW = Math.round(size * 0.62);
    const bodyH = Math.round(size * 0.56);
    const xLen = Math.round(size * 0.32);
    const tipSize = Math.round(size * 0.36);
    return (
      <View
        style={[
          { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
          style,
        ]}
        pointerEvents="none"
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: tipSize,
              height: tipSize,
              borderLeftWidth: stroke,
              borderBottomWidth: stroke,
              borderColor: color,
              transform: [{ rotate: '45deg' }],
              marginRight: -Math.round(tipSize * 0.45),
            }}
          />
          <View
            style={{
              width: bodyW,
              height: bodyH,
              borderTopWidth: stroke,
              borderRightWidth: stroke,
              borderBottomWidth: stroke,
              borderTopRightRadius: 4,
              borderBottomRightRadius: 4,
              borderColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                position: 'absolute',
                width: xLen,
                height: stroke,
                backgroundColor: color,
                borderRadius: stroke / 2,
                transform: [{ rotate: '45deg' }],
              }}
            />
            <View
              style={{
                position: 'absolute',
                width: xLen,
                height: stroke,
                backgroundColor: color,
                borderRadius: stroke / 2,
                transform: [{ rotate: '-45deg' }],
              }}
            />
          </View>
        </View>
      </View>
    );
  }

  // 'send' — clean upward paper-plane / arrow icon
  const shaft = Math.round(size * 0.62);
  const head = Math.round(size * 0.44);
  return (
    <View
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
      pointerEvents="none"
    >
      <View
        style={{
          width: stroke,
          height: shaft,
          backgroundColor: color,
          borderRadius: stroke / 2,
          marginTop: Math.round(size * 0.08),
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: Math.round(size * 0.2),
          width: head,
          height: head,
          borderTopWidth: stroke,
          borderLeftWidth: stroke,
          borderColor: color,
          borderTopLeftRadius: 1.5,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}
