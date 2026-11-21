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

let globalTrigger: ((emoji: string, x?: number, y?: number) => void) | null = null;

/**
 * Public trigger to launch floating celebration emoji reactions anywhere in the app!
 */
export function triggerAskieReaction(emoji: string, x?: number, y?: number) {
  if (globalTrigger) {
    globalTrigger(emoji, x, y);
  }
}

/**
 * AskieReactionOverlay: Mounts over Chat or Call screens to render floating celebration reactions.
 */
export function AskieReactionOverlay() {
  const [reactions, setReactions] = useState<ReactionItem[]>([]);

  useEffect(() => {
    globalTrigger = (emoji: string, x?: number, y?: number) => {
      const newItem: ReactionItem = {
        id: `${Date.now()}_${Math.random()}`,
        emoji,
        startX: x ?? Math.random() * 200 + 80,
        startY: y ?? 500,
      };
      setReactions((prev) => [...prev.slice(-12), newItem]);
    };

    return () => {
      globalTrigger = null;
    };
  }, []);

  const handleComplete = (id: string) => {
    setReactions((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
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
      duration: 1800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onComplete());
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -220],
  });

  const translateX = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, drift * 0.6, drift],
  });

  const scale = anim.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0.3, 1.3, 1.1, 0.8],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.1, 0.7, 1],
    outputRange: [0, 1, 0.9, 0],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        top: startY,
        opacity,
        transform: [
          { translateX },
          { translateY },
          { scale },
          { rotate: `${rotateVal}deg` },
        ],
      }}
    >
      <Text style={{ fontSize: 36 }}>{emoji}</Text>
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
