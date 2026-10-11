import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  SectionList,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { colors, radii, typography, spacing, shadows } from '../theme';
import { ThreadSummary, getThreads } from '../services/threads';
import { groupThreadsByDate, GroupedThreadsSection } from '../utils/groupThreads';

type ChatHistoryDrawerProps = {
  visible: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  activeThreadId?: string;
  deletedThreadId?: string | null;
  onSelectThread: (thread: ThreadSummary) => void;
  onNewChat: () => void;
  onRequestDeleteThread: (thread: ThreadSummary) => void;
};

export default function ChatHistoryDrawer({
  visible,
  onClose,
  studentId,
  studentName,
  activeThreadId,
  deletedThreadId,
  onSelectThread,
  onNewChat,
  onRequestDeleteThread,
}: ChatHistoryDrawerProps) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);

  const fetchThreadsList = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await getThreads(studentId);
      setThreads(res.threads);
      setNextBefore(res.nextBefore);
    } catch (err: any) {
      console.warn('Failed to fetch threads in drawer:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [studentId]);

  const handleLoadMore = async () => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getThreads(studentId, nextBefore);
      setThreads((prev) => [...prev, ...res.threads]);
      setNextBefore(res.nextBefore);
    } catch (err: any) {
      console.warn('Failed to load more threads:', err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (visible && studentId) {
      fetchThreadsList();
    }
  }, [visible, studentId, fetchThreadsList]);

  useEffect(() => {
    if (deletedThreadId) {
      setThreads((prev) => prev.filter((t) => t.id !== deletedThreadId));
    }
  }, [deletedThreadId]);

  const sections: GroupedThreadsSection[] = groupThreadsByDate(threads);

  const formatThreadTime = (updatedAt: string, sectionTitle?: string) => {
    try {
      const date = new Date(updatedAt);
      if (!sectionTitle || sectionTitle === 'Today') {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (sectionTitle === 'Yesterday') {
        return 'Yesterday';
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop tap to close */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        {/* Drawer Panel */}
        <View style={styles.drawerPanel}>
          {/* Drawer Header */}
          <View style={styles.drawerHeader}>
            <View style={styles.drawerHeaderTitleRow}>
              <Text style={styles.drawerTitle}>Chat History 📜</Text>
              <Pressable
                style={styles.closeBtn}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close drawer"
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.drawerSubtitle}>{studentName}'s Conversations</Text>

            {/* New Chat Button */}
            <Pressable
              style={({ pressed }) => [
                styles.newChatBtn,
                pressed && styles.newChatBtnPressed,
              ]}
              onPress={() => {
                onNewChat();
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel="Start a new chat"
            >
              <Text style={styles.newChatBtnText}>✨ + New chat</Text>
            </Pressable>
          </View>

          {/* Body Content */}
          {loading && !refreshing && threads.length === 0 ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color={colors.coralStrong} />
              <Text style={styles.loadingText}>Loading chats...</Text>
            </View>
          ) : threads.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>No chats yet</Text>
              <Text style={styles.emptySub}>Ask your first question to start learning!</Text>
            </View>
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchThreadsList(true)}
                  tintColor={colors.coralStrong}
                />
              }
              renderSectionHeader={({ section: { title } }) => (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>{title}</Text>
                </View>
              )}
              renderItem={({ item, section }) => {
                const isActive = item.id === activeThreadId;
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.threadRow,
                       isActive && styles.threadRowActive,
                      pressed && styles.threadRowPressed,
                    ]}
                    onPress={() => {
                      onSelectThread(item);
                      onClose();
                    }}
                    onLongPress={() => onRequestDeleteThread(item)}
                    delayLongPress={500}
                    accessibilityRole="button"
                    accessibilityLabel={`Chat: ${item.title}. Long press to delete.`}
                  >
                    <View style={styles.threadRowContent}>
                      <Text
                        style={[
                          styles.threadRowTitle,
                          isActive && styles.threadRowTitleActive,
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text style={styles.threadRowTime}>
                        {formatThreadTime(item.updatedAt, section.title)}
                      </Text>
                    </View>
                    {isActive && <Text style={styles.activeCheck}>●</Text>}
                  </Pressable>
                );
              }}
              ListFooterComponent={
                nextBefore ? (
                  <Pressable
                    style={styles.loadMoreBtn}
                    onPress={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <ActivityIndicator size="small" color={colors.coralStrong} />
                    ) : (
                      <Text style={styles.loadMoreText}>Load more</Text>
                    )}
                  </Pressable>
                ) : null
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill as any,
  },
  drawerPanel: {
    width: '82%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: colors.cardBg,
    paddingTop: Platform.OS === 'android' ? 24 : 44,
    borderRightWidth: 1.5,
    borderRightColor: colors.border,
    ...shadows.card,
  },
  drawerHeader: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  drawerHeaderTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  drawerTitle: {
    ...typography.subheading,
    fontSize: 18,
    fontWeight: '900',
    color: colors.coralStrong,
  },
  drawerSubtitle: {
    ...typography.caption,
    fontSize: 12,
    color: colors.subtext,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 12,
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: colors.cardBgMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    color: colors.subtext,
    fontWeight: '800',
  },
  newChatBtn: {
    backgroundColor: colors.coralStrong,
    borderRadius: radii.md,
    paddingVertical: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatBtnPressed: {
    opacity: 0.85,
  },
  newChatBtnText: {
    ...typography.label,
    color: colors.white,
    fontWeight: '900',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 32,
  },
  sectionHeader: {
    paddingTop: 16,
    paddingBottom: 6,
    paddingHorizontal: 8,
  },
  sectionHeaderText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    color: colors.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
    marginBottom: 4,
  },
  threadRowActive: {
    backgroundColor: '#FFEAEA',
  },
  threadRowPressed: {
    backgroundColor: colors.cardBgMuted,
  },
  threadRowContent: {
    flex: 1,
    marginRight: 8,
  },
  threadRowTitle: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  threadRowTitleActive: {
    fontWeight: '800',
    color: colors.coralStrong,
  },
  threadRowTime: {
    ...typography.caption,
    fontSize: 11,
    color: colors.subtext,
    marginTop: 2,
  },
  activeCheck: {
    fontSize: 10,
    color: colors.coralStrong,
  },
  loadMoreBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  loadMoreText: {
    ...typography.caption,
    fontSize: 13,
    color: colors.coralStrong,
    fontWeight: '800',
  },
  centerContainer: {
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    ...typography.subheading,
    fontSize: 16,
    color: colors.text,
    fontWeight: '800',
  },
  emptySub: {
    ...typography.body,
    fontSize: 13,
    color: colors.subtext,
    textAlign: 'center',
    marginTop: 4,
  },
});
