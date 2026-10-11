import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Mascot } from './Mascot';
import { Button } from './Button';
import { colors, typography } from '../theme';

type EmptyStateProps = {
  title: string;
  description: string;
  mascotSize?: 's' | 'm' | 'l';
  actionTitle?: string;
  onAction?: () => void;
  style?: ViewStyle;
};

export function EmptyState({
  title,
  description,
  mascotSize = 'm',
  actionTitle,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Mascot size={mascotSize} style={styles.mascot} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionTitle && onAction ? (
        <Button
          title={actionTitle}
          onPress={onAction}
          variant="primary"
          style={styles.actionButton}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascot: {
    marginBottom: 16,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    ...typography.body,
    color: colors.subtext,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 20,
  },
  actionButton: {
    minWidth: 180,
  },
});
