import React from 'react';
import { ViewStyle, ImageStyle } from 'react-native';
import { AskieCompanion, CompanionSize, CompanionState } from './AskieCompanion';

export type MascotSize = CompanionSize;
export type MascotShape = 'squircle' | 'circle';

type MascotProps = {
  size?: MascotSize;
  shape?: MascotShape;
  state?: CompanionState;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
  standing?: boolean;
  avatarMode?: boolean;
};

/**
 * Mascot: The official Kidsko 3D AI companion.
 * Renders the production-ready animated character with micro-physics and facial expressions.
 */
export function Mascot({ size = 'm', shape = 'squircle', state = 'idle', style, standing, avatarMode }: MascotProps) {
  return (
    <AskieCompanion
      size={size}
      shape={shape}
      state={state}
      style={style}
      standing={standing}
      avatarMode={avatarMode}
    />
  );
}

