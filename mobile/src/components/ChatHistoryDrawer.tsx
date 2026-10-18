import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  SectionList,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import {
  colors,
  radii,
  typography,
  spacing,
  shadows,
  fontFamilies,
  gradients,
} from '../theme';
import { LinearGradient } from '../ui/LinearGradient';
import { useReduceMotion, PressScale, FadeSlideIn } from '../ui/motion';
import { useSafeAreaInsets } from '../ui/safeArea';
import { ThreadSummary, getThreads } from '../services/threads';
import { groupThreadsByDate, GroupedThreadsSection } from '../utils/groupThreads';

const DRAWER_WIDTH = 295;
const ANIM_DURATION = 260;
const EASING_CURVE = Easing.bezier(0.4, 0, 0.2, 1);

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
  const [modalVisible, setModalVisible] = useState(visible);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const isClosingRef = useRef(false);

  const fetchThreadsList = useCallback(
    async (isRefresh = false) => {
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
    },
    [studentId]
  );

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

  const animateIn = useCallback(() => {
    isClosingRef.current = false;
    setModalVisible(true);
    if (reduceMotion) {
      slideAnim.setValue(1);
      backdropAnim.setValue(1);
      return;
    }
    slideAnim.setValue(0);
    backdropAnim.setValue(0);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: ANIM_DURATION,
        easing: EASING_CURVE,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: ANIM_DURATION,
        easing: EASING_CURVE,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reduceMotion, slideAnim, backdropAnim]);

  const animateOut = useCallback(
    (callback?: () => void) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      if (reduceMotion) {
        slideAnim.setValue(0);
        backdropAnim.setValue(0);
        setModalVisible(false);
        onClose();
        callback?.();
        return;
      }
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 220,
          easing: EASING_CURVE,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 220,
          easing: EASING_CURVE,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false);
        onClose();
        callback?.();
      });
    },
    [reduceMotion, slideAnim, backdropAnim, onClose]
  );

  useEffect(() => {
    if (visible) {
      animateIn();
      if (studentId) {
        fetchThreadsList();
      }
    } else if (modalVisible && !isClosingRef.current) {
      animateOut();
    }
  }, [visible, studentId, fetchThreadsList, animateIn, animateOut, modalVisible]);

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

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-DRAWER_WIDTH, 0],
  });

  const overlayOpacity = backdropAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  if (!modalVisible) {
    return null;
  }

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={() => animateOut()}
    >
      <View style={styles.overlay}>
        {/* Animated backdrop with fading overlay */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: overlayOpacity,
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => animateOut()}
            accessibilityRole="button"
            accessibilityLabel="Close drawer backdrop"
          />
        </Animated.View>

        {/* Drawer Panel sliding from left */}
        <Animated.View
          style={[
            styles.drawerPanel,
            {
              paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 24 : 44) + 8,
              transform: [{ translateX }],
            },
          ]}
        >
          {/* Drawer Header */}
          <View style={styles.drawerHeader}>
            <View style={styles.drawerHeaderTitleRow}>
              <Text style={styles.drawerTitle}>Chat History 📜</Text>
              <PressScale>
                <Pressable
                  style={styles.closeBtn}
                  onPress={() => animateOut()}
                  accessibilityRole="button"
                  accessibilityLabel="Close drawer"
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </Pressable>
              </PressScale>
            </View>
            <Text style={styles.drawerSubtitle}>{studentName}'s Conversations</Text>

            {/* New Chat Button with gradient styling */}
            <PressScale>
              <Pressable
                onPress={() => animateOut(() => onNewChat())}
                accessibilityRole="button"
                accessibilityLabel="Start a new chat"
              >
                <LinearGradient
                  colors={gradients.primary.colors}
                  start={gradients.primary.start}
                  end={gradients.primary.end}
                  style={styles.newChatBtnGradient}
                >
                  <Text style={styles.newChatBtnText}>✨ + New chat</Text>
                </LinearGradient>
              </Pressable>
            </PressScale>
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
              <Text style={styles.emptySub}>
                Ask your first question to start learning!
              </Text>
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
              renderItem={({ item, index, section }) => {
                const isActive = item.id === activeThreadId;
                const rowContent = (
                  <PressScale style={styles.rowScale}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.threadRow,
                        isActive && styles.threadRowActive,
                        pressed && styles.threadRowPressed,
                      ]}
                      onPress={() => animateOut(() => onSelectThread(item))}
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
                  </PressScale>
                );

                if (index < 8) {
                  return (
                    <FadeSlideIn delay={index * 25}>{rowContent}</FadeSlideIn>
                  );
                }
                return rowContent;
              }}
              ListFooterComponent={
                nextBefore ? (
                  <Pressable
                    style={styles.loadMoreBtn}
                    onPress={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.coralStrong}
                      />
                    ) : (
                      <Text style={styles.loadMoreText}>Load more</Text>
                    )}
                  </Pressable>
                ) : null
              }
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  drawerPanel: {
    width: DRAWER_WIDTH,
    maxWidth: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: colors.cardBg,
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
    fontFamily: fontFamilies.black,
    color: colors.coralStrong,
  },
  drawerSubtitle: {
    ...typography.caption,
    fontSize: 12,
    color: colors.subtext,
    fontFamily: fontFamilies.bold,
    marginTop: 2,
    marginBottom: 12,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardBgMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    color: colors.subtext,
    fontFamily: fontFamilies.extraBold,
  },
  newChatBtnGradient: {
    borderRadius: radii.md,
    paddingVertical: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glow(colors.coral, 12, 4),
  },
  newChatBtnText: {
    ...typography.label,
    color: colors.white,
    fontFamily: fontFamilies.black,
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
    fontFamily: fontFamilies.extraBold,
    color: colors.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowScale: {
    width: '100%',
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
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: colors.coral,
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
    fontFamily: fontFamilies.semiBold,
    color: colors.text,
  },
  threadRowTitleActive: {
    fontFamily: fontFamilies.extraBold,
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
    fontFamily: fontFamilies.extraBold,
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
    fontFamily: fontFamilies.extraBold,
  },
  emptySub: {
    ...typography.body,
    fontSize: 13,
    color: colors.subtext,
    textAlign: 'center',
    marginTop: 4,
  },
});
