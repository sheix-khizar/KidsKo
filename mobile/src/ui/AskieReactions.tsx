import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { useReduceMotion } from './motion';

type ReactionItem = {
  id: string;
  emoji: string;
  startX: number;
  startY: number;
};

const listeners = new Set<(emoji: string, x?: number, y?: number) => void>();

/**
 * Public trigger to launch floating celebration emoji reactions anywhere in the app!
 */
export function triggerAskieReaction(emoji: string, x?: number, y?: number) {
  console.log('[AskieReaction] triggerAskieReaction called:', emoji, 'x=', x, 'y=', y, 'listeners count=', listeners.size);
  listeners.forEach((fn) => fn(emoji, x, y));
  // Google Meet style: spawn 2 sister bubbles with slight offsets and delays
  setTimeout(() => {
    listeners.forEach((fn) => fn(emoji, (x ?? 160) + (Math.random() - 0.5) * 50, (y ?? 550) + 15));
  }, 110);
  setTimeout(() => {
    listeners.forEach((fn) => fn(emoji, (x ?? 160) + (Math.random() - 0.5) * 60, (y ?? 550) + 30));
  }, 220);
}

/**
 * AskieReactionOverlay: Mounts over Chat or Call screens to render floating celebration reactions.
 */
export function AskieReactionOverlay() {
  const [reactions, setReactions] = useState<ReactionItem[]>([]);

  useEffect(() => {
    const handler = (emoji: string, x?: number, y?: number) => {
      const newItem: ReactionItem = {
        id: `${Date.now()}_${Math.random()}`,
        emoji,
        startX: Math.max(20, Math.min(x ?? Math.random() * 200 + 80, 600)),
        startY: y ?? 500,
      };
      setReactions((prev) => [...prev.slice(-12), newItem]);
    };

    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const handleComplete = (id: string) => {
    setReactions((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 999 }]} pointerEvents="none">
      {reactions.map((r) => (
        <FloatingReaction
          key={r.id}
          emoji={r.emoji}
          startX={r.startX}
          startY={r.startY}
          onComplete={() => handleComplete(r.id)}
        />
      ))}
    </View>
  );
}

function FloatingReaction({
  emoji,
  startX,
  startY,
  onComplete,
}: {
  emoji: string;
  startX: number;
  startY: number;
  onComplete: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const anim = useRef(new Animated.Value(0)).current;
  const drift = useRef((Math.random() - 0.5) * 80).current;
  const rotateVal = useRef((Math.random() - 0.5) * 45).current;

  useEffect(() => {
    if (reduceMotion) {
      onComplete();
      return;
    }

    Animated.timing(anim, {
      toValue: 1,
      duration: 2000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onComplete());
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -380],
  });

  const translateX = anim.interpolate({
    inputRange: [0, 0.25, 0.6, 1],
    outputRange: [0, drift * 0.4, -drift * 0.3, drift],
  });

  const scale = anim.interpolate({
    inputRange: [0, 0.15, 0.7, 1],
    outputRange: [0.3, 1.35, 1.15, 0.85],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.08, 0.65, 1],
    outputRange: [0, 1, 0.95, 0],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        top: startY,
        opacity,
        zIndex: 9999,
        elevation: 999,
        transform: [
          { translateX },
          { translateY },
          { scale },
          { rotate: `${rotateVal}deg` },
        ],
      }}
    >
      <Text style={{ fontSize: 40, textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}>{emoji}</Text>
    </Animated.View>
  );
}

/**
 * AskieReactionBar: Interactive quick-reaction pill for kids in Chat/Call
 */
export function AskieReactionBar({ style }: { style?: ViewStyle }) {
  const reactions = ['⭐', '🚀', '🔥', '❤️', '🎉'];

  return (
    <View style={[styles.barContainer, style]}>
      {reactions.map((emoji) => (
        <TouchableOpacity
          key={emoji}
          onPress={() => triggerAskieReaction(emoji)}
          style={styles.reactionBtn}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 20 }}>{emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  barContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    alignSelf: 'center',
    gap: 6,
  },
  reactionBtn: {
    padding: 6,
    borderRadius: 16,
  },
});
