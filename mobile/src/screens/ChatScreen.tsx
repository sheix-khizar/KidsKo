import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
  ScrollView,
} from 'react-native';
import {
  LinearGradient,
  LiveDot,
  TypingDots,
  Pulse,
  PressScale,
  FadeSlideIn,
  Mascot,
  AskieEmoji,
  AskieCompanion,
  AskieReactionOverlay,
  triggerAskieReaction,
} from '../ui';
import { sendMessage, Message } from '../services/chat';
import { analyzeHomework } from '../services/homework';
import { useVoiceInput } from '../hooks/useVoiceInput';
import {
  pickImageFromGallery,
  captureImageFromCamera,
  ProcessedImage,
} from '../utils/imageHelper';
import { cleanMessageText, parseFormattedText } from '../utils/messageText';
import { colors, radii, fontFamilies, gradients } from '../theme';
import ChatHistoryDrawer from '../components/ChatHistoryDrawer';
import ParentalGate from '../components/ParentalGate';
import {
  ThreadSummary,
  getThreads,
  getThreadMessages,
  deleteThread,
} from '../services/threads';

const TOPIC_PILLS = [
  { label: '🔬 Science', ask: 'Why do plants need sunlight?', icon: '🔬' },
  { label: '🔢 Maths', ask: 'What is a fraction?', icon: '🔢' },
  { label: '🦁 Animals', ask: 'Which animal sleeps the most?', icon: '🦁' },
  { label: '🚀 Space', ask: 'Why does the Moon change shape?', icon: '🚀' },
  { label: '🦕 Dinosaurs', ask: 'How big was the biggest dinosaur?', icon: '🦕' },
  { label: '🎨 Art', ask: 'How do I make green paint?', icon: '🎨' },
];

const PROMPT_CARDS = [
  { text: 'Why is the sky blue?', icon: '🌍', isHomework: false },
  { text: 'Help me with maths!', icon: '🔢', isHomework: false },
  { text: 'Tell me about dinosaurs', icon: '🦕', isHomework: false },
  { text: 'Help with my homework', icon: '📸', isHomework: true },
];

type Props = {
  studentId: string;
  studentName: string;
  onBack: () => void;
  initialThreadId?: string;
  initialExplanation?: string;
  onLimitReached?: () => void;
  embedded?: boolean;
  onSwitchStudent?: () => void;
};

export default function ChatScreen({
  studentId,
  studentName,
  onBack,
  initialThreadId,
  initialExplanation,
  onLimitReached,
  embedded = false,
  onSwitchStudent,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(
    initialExplanation
      ? [
          { role: 'user', content: '📸 [Homework worksheet photo]' },
          { role: 'assistant', content: initialExplanation },
        ]
      : []
  );
  const [input, setInput] = useState('');
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  // Image upload states
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<ProcessedImage | null>(null);

  // History drawer and continuity states
  const [showDrawer, setShowDrawer] = useState(false);
  const [lastThread, setLastThread] = useState<ThreadSummary | null>(null);
  const [threadToDelete, setThreadToDelete] = useState<ThreadSummary | null>(null);
  const [showParentalGate, setShowParentalGate] = useState(false);
  const [deletedThreadId, setDeletedThreadId] = useState<string | null>(null);

  const listRef = useRef<FlatList>(null);

  const { listening, startListening, stopListening } = useVoiceInput((transcript) => {
    setInput(transcript);
  });

  // Fetch recent thread on mount or when studentId changes
  useEffect(() => {
    let isMounted = true;
    getThreads(studentId)
      .then((res) => {
        if (isMounted && res.threads && res.threads.length > 0) {
          setLastThread(res.threads[0]);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [studentId]);

  const handleSelectThread = async (thread: ThreadSummary) => {
    try {
      setShowDrawer(false);
      setSending(true);
      setErrorMsg(null);
      const fetchedMessages = await getThreadMessages(thread.id);
      const formattedMessages: Message[] = fetchedMessages.map((m) => {
        let content = m.text;
        if (m.imageExpired) {
          content =
            '📷 Photo removed after 2 days for privacy. Send it again to keep working on it.' +
            (m.text && m.text !== '📷 Homework photo' ? `\n\n${m.text}` : '');
        }
        return {
          role: m.role,
          content: content || '',
        };
      });
      setMessages(formattedMessages);
      setThreadId(thread.id);
      setPreviewImage(null);
      setInput('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load thread');
    } finally {
      setSending(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setThreadId(undefined);
    setLastThread(null);
    setPreviewImage(null);
    setInput('');
    setErrorMsg(null);
  };

  const handleRequestDeleteThread = (thread: ThreadSummary) => {
    setShowDrawer(false);
    setThreadToDelete(thread);
    setShowParentalGate(true);
  };

  const handleParentalGateSuccess = async () => {
    setShowParentalGate(false);
    if (!threadToDelete) return;
    const targetId = threadToDelete.id;
    setThreadToDelete(null);
    try {
      await deleteThread(targetId);
      setDeletedThreadId(targetId);
      if (threadId === targetId) {
        handleNewChat();
      } else {
        if (lastThread?.id === targetId) {
          const res = await getThreads(studentId);
          setLastThread(res.threads[0] || null);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete chat');
    }
  };

  const handleSend = async (overridePrompt?: string) => {
    const textToSend = typeof overridePrompt === 'string' ? overridePrompt : input;
    const userText = textToSend.trim();
    const imageToSend = previewImage;

    if ((!userText && !imageToSend) || sending) return;

    if (listening) stopListening();

    setErrorMsg(null);

    if (imageToSend) {
      // IMAGE + TEXT (or IMAGE ONLY) flow
      const promptForBackend = userText || 'Please look at this image and help me understand it.';
      const displayContent = userText ? `📸 ${userText}` : '📸 [Homework photo submitted]';

      setMessages((prev) => [...prev, { role: 'user', content: displayContent }]);
      setSending(true);
      setPreviewImage(null);
      setInput('');

      try {
        const res = await analyzeHomework(studentId, imageToSend.base64, threadId, promptForBackend);
        setThreadId(res.threadId);
        setMessages((prev) => [...prev, { role: 'assistant', content: res.explanation }]);
      } catch (err: any) {
        setErrorMsg(err.message || 'Could not analyze homework photo.');
        if (userText) setInput(userText);
        setPreviewImage(imageToSend); // keep image preview on failure
        if (err.status === 429 && onLimitReached) {
          onLimitReached();
        }
      } finally {
        setSending(false);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } else {
      // TEXT ONLY flow
      setInput('');
      setMessages((prev) => [...prev, { role: 'user', content: userText }]);
      setSending(true);

      try {
        const result = await sendMessage(studentId, userText, threadId);
        setThreadId(result.threadId);
        setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
        setRemaining(result.remaining);
        setIsPremium(result.isPremium);
      } catch (err: any) {
        if (err.status === 401 || err.message?.includes('expired') || err.message?.includes('token')) {
          setErrorMsg('Session expired. Please log in again.');
        } else if (err.status === 429) {
          setErrorMsg(err.message || 'Daily question limit reached. Try again later!');
          setRemaining(0);
          if (onLimitReached) onLimitReached();
        } else {
          setErrorMsg(err.message || 'Something went wrong. Please try again.');
        }
        if (userText) setInput(userText);
      } finally {
        setSending(false);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    }
  };

  const handlePickGallery = async () => {
    setShowImagePickerModal(false);
    try {
      const result = await pickImageFromGallery();
      if (result) {
        setPreviewImage(result);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not pick image from gallery.');
    }
  };

  const handleTakeCamera = async () => {
    setShowImagePickerModal(false);
    try {
      const result = await captureImageFromCamera();
      if (result) {
        setPreviewImage(result);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not capture image from camera.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Topbar Matching Prototype ── */}
      <View style={styles.topbar}>
        <View style={styles.topbarLeft}>
          <Pressable
            onPress={() => {
              if (messages.length > 0 || threadId) {
                handleNewChat();
              } else {
                onBack?.();
              }
            }}
            style={styles.backButtonTouch}
            accessibilityLabel="Back to home"
          >
            <Text style={styles.backButton}>‹</Text>
          </Pressable>
        </View>

        <View style={styles.topbarCenter}>
          <View style={styles.companionAvatarSquircle}>
            <AskieCompanion size="s" shape="squircle" state="idle" standing={false} avatarMode={true} />
          </View>
          <View style={styles.studentInfoCol}>
            <Text style={styles.topbarTitle} numberOfLines={1}>
              {threadId && lastThread?.title ? lastThread.title : 'Chat with Kidsko'}
            </Text>
            <View style={styles.statusRow}>
              <LiveDot size={7} color="#00B894" />
              <Text style={styles.statusText}>Online</Text>
            </View>
          </View>
        </View>

        <View style={styles.topbarRight}>
          <Pressable
            onPress={() => setShowDrawer(true)}
            style={styles.historyButton}
            accessibilityRole="button"
            accessibilityLabel="Open chat history drawer"
          >
            <Text style={styles.historyButtonIcon}>📜</Text>
          </Pressable>
        </View>
      </View>

      {/* Usage pill indicator if active */}
      {remaining !== null && (
        <View
          style={[
            styles.usagePill,
            isPremium && styles.usagePillPremium,
            remaining <= 5 && !isPremium && styles.usagePillLow,
          ]}
        >
          <Text style={styles.usagePillText}>
            {isPremium
              ? remaining <= 20
                ? `⭐ Premium (${remaining} left this week)`
                : '⭐ Premium'
              : `💬 ${remaining} left this week`}
          </Text>
        </View>
      )}

      {/* ── Content Area: Greeting or Messages ── */}
      {messages.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.welcomeContainer}
          showsVerticalScrollIndicator={false}
        >
          <FadeSlideIn delay={0}>
            <View style={styles.emptyContainer}>
              <View style={styles.emptyMascotWrapper}>
                <AskieCompanion size="l" state="idle" standing={true} />
              </View>
              <Text style={styles.emptyTitle}>What do you want to learn?</Text>
              <Text style={styles.emptySubtitle}>Pick one or type your own question 👇</Text>

              <View style={styles.qrow}>
                {TOPIC_PILLS.map((pill, idx) => (
                  <Pressable
                    key={idx}
                    style={({ pressed }) => [
                      styles.qp,
                      pressed && styles.qpPressed,
                    ]}
                    onPress={() => {
                      triggerAskieReaction(pill.icon);
                      handleSend(pill.ask);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={pill.label}
                  >
                    <Text style={styles.qpText}>{pill.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </FadeSlideIn>
        </ScrollView>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => i.toString()}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          renderItem={({ item, index }) => (
            <FadeSlideIn delay={Math.min(index * 30, 150)}>
              <View
                style={[
                  styles.msgRow,
                  item.role === 'user' && styles.msgRowUser,
                ]}
              >
                <View
                  style={[
                    styles.avatar,
                    item.role === 'user' ? styles.avatarUser : styles.avatarAi,
                  ]}
                >
                  {item.role === 'user' ? (
                    <Text style={styles.avatarEmoji}>👧</Text>
                  ) : (
                    <AskieCompanion size="xs" shape="circle" state="idle" standing={false} avatarMode={true} />
                  )}
                </View>
                <View style={{ flex: 1, alignItems: item.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <View
                    style={[
                      styles.bubble,
                      item.role === 'user' && styles.bubbleUser,
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        item.role === 'user' && styles.bubbleTextUser,
                      ]}
                    >
                      {parseFormattedText(cleanMessageText(item.content)).map((span, sIdx) => (
                        <Text
                          key={sIdx}
                          style={[
                            span.bold && styles.bubbleTextBold,
                            item.role === 'user' && styles.bubbleTextUser,
                          ]}
                        >
                          {span.text}
                        </Text>
                      ))}
                    </Text>
                  </View>
                  {item.role === 'assistant' && (
                    <View style={styles.msgReactionsRow}>
                      {['👍', '❤️', '🤯'].map((emoji) => (
                        <Pressable
                          key={emoji}
                          style={styles.msgReactionPill}
                          onPress={() => triggerAskieReaction(emoji)}
                          accessibilityRole="button"
                          accessibilityLabel={`React ${emoji}`}
                        >
                          <Text style={styles.msgReactionEmoji}>{emoji}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </FadeSlideIn>
          )}
        />
      )}

      {/* Homework photo preview bar if image selected */}
      {previewImage && (
        <View style={styles.attachmentBar}>
          <Image
            source={{ uri: previewImage.uri }}
            style={styles.attachmentThumbnail}
          />
          <View style={styles.attachmentInfo}>
            <Text style={styles.attachmentTitle}>Homework Photo Attached 📷</Text>
            <Text style={styles.attachmentSub}>
              Type your question below or tap send
            </Text>
          </View>
          <Pressable
            style={styles.removeAttachmentBtn}
            onPress={() => setPreviewImage(null)}
            accessibilityRole="button"
            accessibilityLabel="Remove attached photo"
          >
            <Text style={styles.removeAttachmentText}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* Typing animation while AI replies */}
      {sending && (
        <View style={styles.typingRow}>
          <View style={[styles.avatar, styles.avatarAi]}>
            <AskieCompanion size="xs" shape="circle" state="idle" standing={false} avatarMode={true} />
          </View>
          <View style={styles.typingBubble}>
            <TypingDots color={colors.coral} />
          </View>
        </View>
      )}

      {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

      {/* ── Pill Input Bar ── */}
      <View style={styles.inputBar}>
        <Pressable
          style={styles.attachButton}
          onPress={() => setShowImagePickerModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Attach homework photo"
        >
          <Text style={styles.attachIcon}>📷</Text>
        </Pressable>

        <TextInput
          style={[styles.inputField, listening && styles.inputListening]}
          placeholder={
            listening
              ? 'Listening... Speak now!'
              : previewImage
              ? 'Ask a question about this photo...'
              : 'Ask Kidsko anything...'
          }
          placeholderTextColor={colors.subtext}
          value={input}
          onChangeText={setInput}
          multiline
        />

        {/* Mic button with pulse animation when listening */}
        {listening ? (
          <Pulse variant="plain" style={styles.micPulse}>
            <Pressable
              style={[styles.micButton, styles.micButtonListening]}
              onPress={stopListening}
              accessibilityRole="button"
              accessibilityLabel="Stop voice input"
            >
              <Text style={styles.micIcon}>🔴</Text>
            </Pressable>
          </Pulse>
        ) : (
          <Pressable
            style={styles.micButton}
            onPress={startListening}
            accessibilityRole="button"
            accessibilityLabel="Voice input"
          >
            <Text style={styles.micIcon}>🎙️</Text>
          </Pressable>
        )}

        <PressScale style={styles.sendButtonScale}>
          <Pressable
            style={[
              styles.sendButton,
              !input.trim() && !previewImage && styles.sendButtonInactive,
            ]}
            onPress={() => handleSend()}
            disabled={(!input.trim() && !previewImage) || sending}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Text style={styles.sendButtonText}>➤</Text>
          </Pressable>
        </PressScale>
      </View>

      {/* Image Selection Modal */}
      <Modal visible={showImagePickerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Homework Photo</Text>
            <Text style={styles.modalSubtitle}>
              How would you like to attach the photo?
            </Text>

            <Pressable style={styles.optionButton} onPress={handleTakeCamera}>
              <Text style={styles.optionButtonText}>📸 Take Photo with Camera</Text>
            </Pressable>

            <Pressable
              style={[styles.optionButton, styles.optionButtonSecondary]}
              onPress={handlePickGallery}
            >
              <Text style={styles.optionButtonTextSecondary}>
                🖼️ Choose from Gallery
              </Text>
            </Pressable>

            <Pressable
              style={styles.cancelModalButton}
              onPress={() => setShowImagePickerModal(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelModalText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Chat History Drawer */}
      <ChatHistoryDrawer
        visible={showDrawer}
        onClose={() => setShowDrawer(false)}
        studentId={studentId}
        studentName={studentName}
        activeThreadId={threadId}
        deletedThreadId={deletedThreadId}
        onSelectThread={handleSelectThread}
        onNewChat={handleNewChat}
        onRequestDeleteThread={handleRequestDeleteThread}
      />

      {/* Parental Gate for deleting chat thread */}
      <ParentalGate
        visible={showParentalGate}
        onSuccess={handleParentalGateSuccess}
        onCancel={() => {
          setShowParentalGate(false);
          setThreadToDelete(null);
          setShowDrawer(true);
        }}
      />

      {/* Floating 3D Emoji Celebration Overlay */}
      <AskieReactionOverlay />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topbar: {
    height: 60,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: '#EDE3D8',
  },
  topbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonTouch: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFDF9',
    borderWidth: 1.5,
    borderColor: '#EDE3D8',
    borderBottomWidth: 3.5,
    borderBottomColor: '#DCD0C2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    fontSize: 24,
    fontFamily: fontFamilies.black,
    color: colors.text,
    textAlign: 'center',
    marginTop: -2,
  },
  hamburgerButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  hamburgerBar1: {
    width: 22,
    height: 2,
    backgroundColor: colors.text,
    borderRadius: 2,
  },
  hamburgerBar2: {
    width: 14,
    height: 2,
    backgroundColor: colors.text,
    borderRadius: 2,
  },
  hamburgerBar3: {
    width: 22,
    height: 2,
    backgroundColor: colors.text,
    borderRadius: 2,
  },
  topbarCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginHorizontal: 10,
  },
  companionAvatarSquircle: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  msgReactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginLeft: 6,
  },
  msgReactionPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FFE8D6',
    borderBottomWidth: 3,
    borderBottomColor: '#FFD7BA',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  msgReactionEmoji: {
    fontSize: 14,
  },
  studentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentAvatarEmoji: {
    fontSize: 18,
  },
  studentInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  topbarTitle: {
    fontSize: 15,
    fontFamily: fontFamilies.black,
    color: colors.text,
    lineHeight: 18,
  },
  chatHighlight: {
    color: colors.coral,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusText: {
    fontSize: 11,
    fontFamily: fontFamilies.bold,
    color: '#00B894',
  },
  topbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newChatButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  newChatIcon: {
    fontSize: 16,
  },
  historyButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FE5150',
    borderWidth: 1.5,
    borderColor: '#FE5150',
    borderBottomWidth: 3.5,
    borderBottomColor: '#D93838',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FE5150',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  historyButtonIcon: {
    fontSize: 18,
  },
  usagePill: {
    alignSelf: 'center',
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.cardBgMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  usagePillLow: {
    backgroundColor: colors.errorBg,
    borderColor: colors.coralStrong,
  },
  usagePillPremium: {
    backgroundColor: colors.sun,
    borderColor: colors.orange,
  },
  usagePillText: {
    fontSize: 11,
    fontFamily: fontFamilies.extraBold,
    color: colors.text,
  },
  welcomeContainer: {
    padding: 16,
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  emptyMascotWrapper: {
    width: 140,
    height: 145,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: fontFamilies.black,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  qrow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    maxWidth: 340,
  },
  qp: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginVertical: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  qpPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
  qpText: {
    fontSize: 14,
    fontFamily: fontFamilies.black,
    color: colors.text,
  },
  continueCardWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  continueCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  continueCardContent: {
    flex: 1,
    paddingRight: 10,
  },
  continueCardTag: {
    fontSize: 11,
    fontFamily: fontFamilies.extraBold,
    color: colors.coral,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  continueCardTitle: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: colors.text,
  },
  continueCardArrow: {
    fontSize: 18,
    color: colors.coral,
    fontFamily: fontFamilies.black,
  },
  heroCard: {
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    marginBottom: 24,
  },
  heroMascotBadge: {
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: fontFamilies.black,
    color: colors.white,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    marginTop: 6,
  },
  promptsSectionHeader: {
    fontSize: 12,
    fontFamily: fontFamilies.extraBold,
    color: colors.subtext,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  promptsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  promptCardScale: {
    width: '48%',
  },
  promptCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 13,
    minHeight: 104,
    justifyContent: 'space-between',
  },
  promptCardIcon: {
    fontSize: 26,
    marginBottom: 6,
  },
  promptCardText: {
    fontSize: 13.5,
    fontFamily: fontFamilies.extraBold,
    color: colors.text,
    lineHeight: 18,
  },
  messagesList: {
    flex: 1,
    backgroundColor: colors.background,
  },
  messagesContent: {
    padding: 16,
    gap: 14,
  },
  msgRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  msgRowUser: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarAi: {
    backgroundColor: 'transparent',
  },
  avatarUser: {
    backgroundColor: colors.cardBgMuted,
  },
  avatarEmoji: {
    fontSize: 18,
  },
  bubble: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    maxWidth: '78%',
  },
  bubbleUser: {
    backgroundColor: colors.coralStrong,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 4,
    borderWidth: 0,
  },
  bubbleText: {
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    color: colors.text,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: colors.white,
  },
  bubbleTextBold: {
    fontFamily: fontFamilies.black,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  typingBubble: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  error: {
    color: colors.error,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
    fontSize: 12,
    fontFamily: fontFamilies.bold,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachIcon: {
    fontSize: 20,
  },
  micPulse: {
    width: 40,
    height: 40,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonListening: {
    backgroundColor: colors.errorBg,
    borderWidth: 1.5,
    borderColor: colors.coralStrong,
  },
  micIcon: {
    fontSize: 20,
  },
  inputField: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    maxHeight: 110,
    color: colors.text,
  },
  inputListening: {
    backgroundColor: colors.errorBg,
    borderColor: colors.coralStrong,
  },
  sendButtonScale: {
    width: 40,
    height: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.coralStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonInactive: {
    backgroundColor: colors.disabledBg,
  },
  sendButtonText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: fontFamilies.black,
  },
  attachmentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBgMuted,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  attachmentThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.disabledBg,
  },
  attachmentInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  attachmentTitle: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.text,
  },
  attachmentSub: {
    fontSize: 11,
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
  },
  removeAttachmentBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeAttachmentText: {
    color: colors.subtext,
    fontSize: 16,
    fontFamily: fontFamilies.extraBold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 19,
    fontFamily: fontFamilies.black,
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
    marginBottom: 8,
    textAlign: 'center',
  },
  optionButton: {
    width: '100%',
    backgroundColor: colors.coralStrong,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  optionButtonText: {
    color: colors.white,
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
  },
  optionButtonSecondary: {
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionButtonTextSecondary: {
    color: colors.text,
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
  },
  cancelModalButton: {
    marginTop: 8,
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelModalText: {
    color: colors.subtext,
    fontFamily: fontFamilies.bold,
    fontSize: 15,
  },
});
