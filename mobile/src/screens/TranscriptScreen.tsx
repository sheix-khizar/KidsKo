import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { getTranscript } from '../services/api';
import { cleanMessageText, parseFormattedText } from '../utils/messageText';
import { colors, radii, spacing, typography, fontFamilies, shadows } from '../theme';
import { PressScale, FadeSlideIn } from '../ui/motion';
import { useSafeAreaInsets } from '../ui/safeArea';

type Message = { role: string; content: string; message_type?: string; created_at: string };

type Props = {
  studentId: string;
  studentName: string;
  onBack: () => void;
};

type GroupedItem =
  | { type: 'header'; date: string }
  | { type: 'message'; message: Message; id: string };

export default function TranscriptScreen({ studentId, studentName, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      try {
        const data = await getTranscript(studentId);
        setMessages(data.messages || []);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load transcript');
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId]);

  // Group messages chronologically with friendly date headers
  const listItems: GroupedItem[] = useMemo(() => {
    if (!messages.length) return [];

    const items: GroupedItem[] = [];
    let lastDateStr = '';

    messages.forEach((msg, idx) => {
      const msgDate = new Date(msg.created_at);
      const today = new Date();
      const yesterday = new Date(Date.now() - 86400000);

      let dateHeader = '';
      if (msgDate.toDateString() === today.toDateString()) {
        dateHeader = 'Today';
      } else if (msgDate.toDateString() === yesterday.toDateString()) {
        dateHeader = 'Yesterday';
      } else {
        dateHeader = msgDate.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: msgDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
        });
      }

      if (dateHeader !== lastDateStr) {
        items.push({ type: 'header', date: dateHeader });
        lastDateStr = dateHeader;
      }

      items.push({
        type: 'message',
        message: msg,
        id: `${msg.created_at}_${idx}`,
      });
    });

    return items;
  }, [messages]);

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 24) + 8 },
        ]}
      >
        <PressScale onPress={onBack}>
          <View
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back to Parents Hub"
          >
            <Text style={styles.backText}>← Back</Text>
          </View>
        </PressScale>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {studentName}'s Transcript
          </Text>
          <Text style={styles.subTitle}>Read-only parental oversight</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {errorMsg && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.coralStrong} />
          <Text style={styles.loadingText}>Loading transcript…</Text>
        </View>
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={(item) => (item.type === 'header' ? `h_${item.date}` : item.id)}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            if (item.type === 'header') {
              return (
                <View style={styles.dateHeaderWrap}>
                  <View style={styles.dateHeaderPill}>
                    <Text style={styles.dateHeaderText}>{item.date}</Text>
                  </View>
                </View>
              );
            }

            const { message } = item;
            const isUser = message.role === 'user';
            const timeStr = new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            const cardContent = (
              <View
                style={[
                  styles.bubbleCard,
                  isUser ? styles.userBubbleCard : styles.assistantBubbleCard,
                ]}
              >
                <View style={styles.bubbleHeader}>
                  <Text
                    style={[
                      styles.roleLabel,
                      isUser ? styles.userRoleLabel : styles.assistantRoleLabel,
                    ]}
                  >
                    {isUser ? `🧒 ${studentName}` : '🦉 Kidsko'}
                  </Text>
                  <Text style={styles.timeText}>{timeStr}</Text>
                </View>

                <Text
                  style={[
                    styles.messageText,
                    isUser ? styles.userMessageText : styles.assistantMessageText,
                  ]}
                >
                  {parseFormattedText(cleanMessageText(message.content)).map((span, sIdx) => (
                    <Text
                      key={sIdx}
                      style={[
                        span.bold && styles.messageTextBold,
                        isUser ? styles.userMessageText : styles.assistantMessageText,
                      ]}
                    >
                      {span.text}
                    </Text>
                  ))}
                </Text>
              </View>
            );

            // Phase 8.9: Staggered FadeSlideIn for the first 8 rows only
            if (index < 8) {
              return (
                <FadeSlideIn delay={index * 25}>
                  {cardContent}
                </FadeSlideIn>
              );
            }
            return cardContent;
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBadge}>
                <Text style={styles.emptyEmoji}>📜</Text>
              </View>
              <Text style={styles.emptyTitle}>No messages recorded yet</Text>
              <Text style={styles.emptySub}>
                When {studentName} asks Kidsko questions, the conversation transcripts will appear here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: 14,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
    ...shadows.card,
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.cardBgMuted,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.text,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  title: {
    ...typography.subheading,
    fontSize: 16,
    fontFamily: fontFamilies.black,
    color: colors.text,
  },
  subTitle: {
    ...typography.caption,
    fontSize: 11,
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
    marginTop: 1,
  },
  errorBox: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.errorBg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontFamily: fontFamilies.semiBold,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    ...typography.caption,
    fontSize: 13,
    color: colors.subtext,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  dateHeaderWrap: {
    alignItems: 'center',
    marginVertical: 14,
  },
  dateHeaderPill: {
    backgroundColor: 'rgba(45, 52, 54, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  dateHeaderText: {
    ...typography.caption,
    fontSize: 11,
    fontFamily: fontFamilies.extraBold,
    color: colors.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bubbleCard: {
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    ...shadows.card,
  },
  userBubbleCard: {
    backgroundColor: colors.cardBgMuted,
    borderColor: colors.borderLight,
    marginLeft: 24,
  },
  assistantBubbleCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    marginRight: 24,
  },
  bubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  roleLabel: {
    fontSize: 12,
    fontFamily: fontFamilies.extraBold,
  },
  userRoleLabel: {
    color: colors.coralStrong,
  },
  assistantRoleLabel: {
    color: colors.parentNavy,
  },
  timeText: {
    fontSize: 10,
    color: colors.subtext,
    fontFamily: fontFamilies.bold,
  },
  messageText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: colors.text,
    fontFamily: fontFamilies.semiBold,
  },
  assistantMessageText: {
    color: colors.text,
    fontFamily: fontFamilies.semiBold,
  },
  messageTextBold: {
    fontFamily: fontFamilies.black,
  },
  emptyContainer: {
    padding: 36,
    alignItems: 'center',
    marginTop: 40,
  },
  emptyIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.card,
  },
  emptyEmoji: {
    fontSize: 32,
  },
  emptyTitle: {
    ...typography.subheading,
    fontSize: 16,
    fontFamily: fontFamilies.black,
    color: colors.text,
    marginBottom: 6,
  },
  emptySub: {
    ...typography.body,
    fontSize: 13,
    color: colors.subtext,
    textAlign: 'center',
    lineHeight: 18,
  },
});
