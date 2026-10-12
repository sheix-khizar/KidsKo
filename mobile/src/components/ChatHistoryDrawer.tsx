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
import { LinearGradient } from '../ui';
import { colors, radii, typography, gradients } from '../theme';
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

const CATEGORY_ICONS = ['🔬', '🔢', '🌍', '🦕', '📚', '🎨', '🚀', '⭐'];

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
          {/* Prototype Gradient Header */}
          <LinearGradient
            colors={gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.drawerHeader}
          >
            <View style={styles.drawerHeaderTop}>
              <View style={styles.studentBadge}>
                <Text style={styles.studentEmoji}>👧</Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentNameText} numberOfLines={1}>
                  {studentName || 'Student'}
                </Text>
                <Text style={styles.studentGradeText}>Grade 5 · Active 🌟</Text>
              </View>
              <Pressable
                style={styles.closeBtn}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close drawer"
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>
          </LinearGradient>

          {/* New Chat Button (Prototype Dashed Style) */}
          <View style={styles.actionContainer}>
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
              <Text style={styles.newChatBtnText}>✏️ New Chat</Text>
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
              renderItem={({ item, section, index }) => {
                const isActive = item.id === activeThreadId;
                const icon = CATEGORY_ICONS[index % CATEGORY_ICONS.length];
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
                    <View style={styles.threadIconBox}>
                      <Text style={styles.threadIconEmoji}>{icon}</Text>
                    </View>
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
                    {isActive ? (
                      <View style={styles.activeDot} />
                    ) : (
                      <Text style={styles.chevron}>›</Text>
                    )}
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
    width: '84%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRightWidth: 2,
    borderRightColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  drawerHeader: {
    paddingTop: Platform.OS === 'android' ? 44 : 54,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  drawerHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  studentBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentEmoji: {
    fontSize: 24,
  },
  studentInfo: {
    flex: 1,
  },
  studentNameText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  studentGradeText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  actionContainer: {
    padding: 12,
    paddingBottom: 4,
  },
  newChatBtn: {
    width: '100%',
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 107, 0.35)',
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  newChatBtnPressed: {
    backgroundColor: 'rgba(255, 107, 107, 0.16)',
  },
  newChatBtnText: {
    color: colors.coralStrong,
    fontWeight: '800',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 32,
  },
  sectionHeader: {
    paddingTop: 16,
    paddingBottom: 6,
    paddingHorizontal: 6,
  },
  sectionHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.subtext,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  threadRowActive: {
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
  },
  threadRowPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  threadIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF4E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  threadIconEmoji: {
    fontSize: 18,
  },
  threadRowContent: {
    flex: 1,
    marginRight: 8,
  },
  threadRowTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  threadRowTitleActive: {
    color: colors.coralStrong,
  },
  threadRowTime: {
    fontSize: 11,
    color: colors.subtext,
    marginTop: 2,
    fontWeight: '600',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.coralStrong,
  },
  chevron: {
    fontSize: 16,
    color: colors.subtext,
    fontWeight: '700',
  },
  loadMoreBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  loadMoreText: {
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
    fontSize: 16,
    color: colors.text,
    fontWeight: '800',
  },
  emptySub: {
    fontSize: 13,
    color: colors.subtext,
    textAlign: 'center',
    marginTop: 4,
  },
});
