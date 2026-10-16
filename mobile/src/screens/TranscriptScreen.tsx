import { fontFamilies } from '../theme';
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { getTranscript } from '../services/api';
import { cleanMessageText } from '../utils/messageText';
import { colors, radii, spacing, typography } from '../theme';

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
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to Parents Hub"
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
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
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
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

            return (
              <View
                style={[
                  styles.bubbleCard,
                  isUser ? styles.userBubbleCard : styles.assistantBubbleCard,
                ]}
              >
                <View style={styles.bubbleHeader}>
                  <Text style={[styles.roleLabel, isUser ? styles.userRoleLabel : styles.assistantRoleLabel]}>
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
                  {cleanMessageText(message.content)}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBadge}>
                <Text style={styles.emptyIcon}>📜</Text>
              </View>
              <Text style={styles.emptyTitle}>No chats yet</Text>
              <Text style={styles.emptySub}>
                When {studentName} asks Kidsko questions, conversations will appear here.
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
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  backBtn: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backText: {
    color: colors.coralStrong,
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontFamily: fontFamilies.black,
    color: colors.text,
  },
  subTitle: {
    fontSize: 11,
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
    marginTop: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
  },
  errorBox: {
    margin: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: '#FDE8E8',
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    fontFamily: fontFamilies.bold,
    fontSize: 13,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 32,
  },
  dateHeaderWrap: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dateHeaderPill: {
    backgroundColor: colors.cardBgMuted,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateHeaderText: {
    fontSize: 11,
    fontFamily: fontFamilies.extraBold,
    color: colors.subtext,
    letterSpacing: 0.3,
  },
  bubbleCard: {
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    maxWidth: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  userBubbleCard: {
    alignSelf: 'flex-end',
    backgroundColor: '#FFF2EB',
    borderWidth: 1.5,
    borderColor: '#FBD3C1',
  },
  assistantBubbleCard: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  bubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 10,
  },
  roleLabel: {
    fontSize: 11,
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
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fontFamilies.semiBold,
  },
  userMessageText: {
    color: colors.text,
  },
  assistantMessageText: {
    color: colors.text,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: spacing.xl,
  },
  emptyIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fontFamilies.extraBold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySub: {
    textAlign: 'center',
    color: colors.subtext,
    fontSize: 13,
    lineHeight: 18,
  },
});
