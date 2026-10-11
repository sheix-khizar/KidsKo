import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Screen } from './Screen';
import { ScreenHeader } from './ScreenHeader';
import { Button } from './Button';
import { Card } from './Card';
import { Pill } from './Pill';
import { Mascot } from './Mascot';
import { EmptyState } from './EmptyState';
import { colors, spacing, typography } from '../theme';

type Props = {
  onBack?: () => void;
};

export default function StyleGuideScreen({ onBack }: Props) {
  return (
    <Screen>
      <ScreenHeader title="Kidsko v7 Style Guide" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Mascots</Text>
        <View style={styles.row}>
          <Mascot size="s" />
          <Mascot size="m" />
          <Mascot size="l" />
        </View>

        <Text style={styles.sectionTitle}>Buttons (min height 52, accessible)</Text>
        <View style={styles.col}>
          <Button title="Primary Coral Strong" onPress={() => {}} variant="primary" />
          <Button title="Secondary Mint Button" onPress={() => {}} variant="secondary" />
          <Button title="Ghost Outlined Button" onPress={() => {}} variant="ghost" />
          <Button title="Loading Button" onPress={() => {}} loading variant="primary" />
        </View>

        <Text style={styles.sectionTitle}>Pills & Badges</Text>
        <View style={styles.wrapRow}>
          <Pill label="💬 30 left this week" color={colors.cardBgMuted} />
          <Pill label="⭐ Premium" color={colors.mint} />
          <Pill label="Listening…" icon="🎙️" color={colors.white} />
          <Pill label="Call 10 min limit" color={colors.sun} />
        </View>

        <Text style={styles.sectionTitle}>Cards</Text>
        <Card style={styles.cardExample}>
          <Text style={typography.heading}>Card Header</Text>
          <Text style={[typography.body, { color: colors.subtext, marginTop: 4 }]}>
            Rounded soft card on warm cream background with subtle elevation.
          </Text>
        </Card>

        <Text style={styles.sectionTitle}>Empty State</Text>
        <Card>
          <EmptyState
            title="No chats yet"
            description="Ask Kidsko any question or attach your homework!"
            actionTitle="Ask First Question"
            onAction={() => {}}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  col: {
    gap: spacing.sm,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cardExample: {
    gap: spacing.xs,
  },
});
