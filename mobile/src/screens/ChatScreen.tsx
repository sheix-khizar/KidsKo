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
} from '../ui';
import { sendMessage, Message } from '../services/chat';
import { analyzeHomework } from '../services/homework';
import { useVoiceInput } from '../hooks/useVoiceInput';
import {
  pickImageFromGallery,
  captureImageFromCamera,
  ProcessedImage,
} from '../utils/imageHelper';
import { cleanMessageText } from '../utils/messageText';
import { colors, radii, fontFamilies, gradients } from '../theme';
import ChatHistoryDrawer from '../components/ChatHistoryDrawer';
import ParentalGate from '../components/ParentalGate';
import {
  ThreadSummary,
  getThreads,
  getThreadMessages,
  deleteThread,
} from '../services/threads';

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
    setPreviewImage(null);
    setInput('');
    setErrorMsg(null);
    getThreads(studentId)
      .then((res) => {
        if (res.threads && res.threads.length > 0) {
          setLastThread(res.threads[0]);
        }
      })
      .catch(() => {});
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
        setErrorMsg(err.message);
        setRemaining(0);
        if (userText) setInput(userText);
        if (err.status === 429 && onLimitReached) {
          onLimitReached();
        }
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
          {!embedded && (
            <Pressable onPress={onBack} style={styles.backButtonTouch}>
              <Text style={styles.backButton}>←</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setShowDrawer(true)}
            style={styles.hamburgerButton}
            accessibilityRole="button"
            accessibilityLabel="Open chat history drawer"
          >
            <View style={styles.hamburgerBar1} />
            <View style={styles.hamburgerBar2} />
            <View style={styles.hamburgerBar3} />
          </Pressable>
        </View>

        <Pressable
          style={styles.topbarCenter}
          onPress={onSwitchStudent}
          disabled={!onSwitchStudent}
          accessibilityRole="button"
          accessibilityLabel={`Active student is ${studentName}. Tap to switch student.`}
        >
          <LinearGradient
            colors={gradients.primary.colors}
            start={gradients.primary.start}
            end={gradients.primary.end}
            style={styles.studentAvatar}
          >
            <Text style={styles.studentAvatarEmoji}>👧</Text>
          </LinearGradient>
          <View style={styles.studentInfoCol}>
            <Text style={styles.topbarTitle}>
              {studentName}'s <Text style={styles.chatHighlight}>Chat</Text>
            </Text>
            <View style={styles.statusRow}>
              <LiveDot size={6} color={colors.mint} />
              <Text style={styles.statusText}>Kidsko is online</Text>
            </View>
          </View>
        </Pressable>

        <Pressable
          onPress={handleNewChat}
          style={styles.newChatButton}
          accessibilityRole="button"
          accessibilityLabel="Start new chat"
        >
          <Text style={styles.newChatIcon}>✏️</Text>
        </Pressable>
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
          {lastThread && (
            <PressScale style={styles.continueCardWrapper}>
              <Pressable
                style={styles.continueCard}
                onPress={() => handleSelectThread(lastThread)}
                accessibilityRole="button"
                accessibilityLabel={`Continue chat: ${lastThread.title}`}
              >
                <View style={styles.continueCardContent}>
                  <Text style={styles.continueCardTag}>CONTINUE WHERE YOU LEFT OFF ⏱️</Text>
                  <Text style={styles.continueCardTitle} numberOfLines={1}>
                    {lastThread.title}
                  </Text>
                </View>
                <Text style={styles.continueCardArrow}>→</Text>
              </Pressable>
            </PressScale>
          )}

          {/* Greeting Hero with primary gradient */}
          <FadeSlideIn delay={0}>
            <LinearGradient
              colors={gradients.primary.colors}
              start={gradients.primary.start}
              end={gradients.primary.end}
              style={styles.heroCard}
            >
              <Text style={styles.heroOwlEmoji}>🦉</Text>
              <Text style={styles.heroTitle}>Hi {studentName}! 👋</Text>
              <Text style={styles.heroSubtitle}>
                I'm Kidsko! What do you want to learn today?
              </Text>
            </LinearGradient>
          </FadeSlideIn>

          {/* 2x2 Prompt Suggestion Cards */}
          <FadeSlideIn delay={60}>
            <Text style={styles.promptsSectionHeader}>TRY ASKING ME...</Text>
            <View style={styles.promptsGrid}>
              {PROMPT_CARDS.map((card, idx) => (
                <PressScale key={idx} style={styles.promptCardScale}>
                  <Pressable
                    style={styles.promptCard}
                    onPress={() => {
                      if (card.isHomework) {
                        setShowImagePickerModal(true);
                      } else {
                        handleSend(card.text);
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={card.text}
                  >
                    <Text style={styles.promptCardIcon}>{card.icon}</Text>
                    <Text style={styles.promptCardText}>{card.text}</Text>
                  </Pressable>
                </PressScale>
              ))}
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
                    item.role === 'user' && styles.avatarUser,
                  ]}
                >
                  <Text style={styles.avatarEmoji}>
                    {item.role === 'user' ? '👧' : '🦉'}
                  </Text>
                </View>
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
                    {cleanMessageText(item.content)}
                  </Text>
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
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>🦉</Text>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topbar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  topbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonTouch: {
    padding: 6,
  },
  backButton: {
    fontSize: 20,
    fontFamily: fontFamilies.bold,
    color: colors.coral,
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
    justifyContent: 'center',
  },
  topbarTitle: {
    fontSize: 14,
    fontFamily: fontFamilies.black,
    color: colors.text,
    lineHeight: 16,
  },
  chatHighlight: {
    color: colors.coral,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusText: {
    fontSize: 10,
    fontFamily: fontFamilies.bold,
    color: colors.mint,
  },
  newChatButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newChatIcon: {
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
    padding: 18,
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
  heroOwlEmoji: {
    fontSize: 52,
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
    borderRadius: 14,
    backgroundColor: colors.sun,
    justifyContent: 'center',
    alignItems: 'center',
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
