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
  ActivityIndicator,
  Modal,
  Image,
  ScrollView,
} from 'react-native';
import { LinearGradient } from '../ui';
import { sendMessage, Message } from '../services/chat';
import { analyzeHomework } from '../services/homework';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { pickImageFromGallery, captureImageFromCamera, ProcessedImage } from '../utils/imageHelper';
import { cleanMessageText } from '../utils/messageText';
import { colors, radii, typography, gradients } from '../theme';
import ChatHistoryDrawer from '../components/ChatHistoryDrawer';
import ParentalGate from '../components/ParentalGate';
import { ThreadSummary, getThreads, getThreadMessages, deleteThread } from '../services/threads';

const PROMPT_CARDS = [
  { icon: '🌍', text: 'Why is the sky blue?', isHomework: false },
  { icon: '🔢', text: 'Help me with maths!', isHomework: false },
  { icon: '🦕', text: 'Tell me about dinosaurs', isHomework: false },
  { icon: '🌱', text: 'What is photosynthesis?', isHomework: false },
];

type Props = {
  studentId: string;
  studentName: string;
  onBack: () => void;
  initialThreadId?: string;
  initialExplanation?: string;
  onLimitReached?: () => void;
  embedded?: boolean;
};

export default function ChatScreen({
  studentId,
  studentName,
  onBack,
  initialThreadId,
  initialExplanation,
  onLimitReached,
  embedded = false,
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

  const handleSendPrompt = (promptText: string) => {
    setInput(promptText);
    setTimeout(() => {
      handleSendWithText(promptText);
    }, 50);
  };

  const handleSendWithText = async (textToSend: string) => {
    const userText = textToSend.trim();
    if (!userText || sending) return;
    if (listening) stopListening();
    setErrorMsg(null);
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
      if (err.status === 429 && onLimitReached) {
        onLimitReached();
      }
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleSend = async () => {
    const userText = input.trim();
    const imageToSend = previewImage;

    if ((!userText && !imageToSend) || sending) return;
    if (listening) stopListening();
    setErrorMsg(null);

    if (imageToSend) {
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
        setPreviewImage(imageToSend);
        if (err.status === 429 && onLimitReached) {
          onLimitReached();
        }
      } finally {
        setSending(false);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } else {
      handleSendWithText(userText);
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
      {/* Prototype Chat Topbar */}
      <View style={styles.topbar}>
        <View style={styles.topbarLeft}>
          {!embedded && (
            <Pressable onPress={onBack} style={styles.backButtonTouch}>
              <Text style={styles.backButton}>‹</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setShowDrawer(true)}
            style={styles.hamburgerButton}
            accessibilityRole="button"
            accessibilityLabel="Open chat history drawer"
          >
            <View style={styles.hamburgerBarWide} />
            <View style={styles.hamburgerBarNarrow} />
            <View style={styles.hamburgerBarWide} />
          </Pressable>
        </View>

        {/* Center Child Badge with Online Indicator */}
        <View style={styles.centerStudentBadge}>
          <LinearGradient
            colors={gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.studentAvatarBox}
          >
            <Text style={styles.studentAvatarEmoji}>👧</Text>
          </LinearGradient>
          <View>
            <Text style={styles.studentChatTitle}>
              {studentName || 'Aisha'}'s <Text style={{ color: colors.coralStrong }}>Chat</Text>
            </Text>
            <View style={styles.onlineStatusRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Kidsko is online</Text>
            </View>
          </View>
        </View>

        {/* Right Action: New Chat */}
        <Pressable
          onPress={handleNewChat}
          style={styles.newChatButton}
          accessibilityRole="button"
          accessibilityLabel="Start a new chat"
        >
          <Text style={styles.newChatIcon}>✏️</Text>
        </Pressable>
      </View>

      {/* Quota / Plan Bar if active */}
      {remaining !== null && (
        <View style={styles.quotaBar}>
          <View style={[styles.usagePill, isPremium && styles.usagePillPremium, remaining <= 5 && !isPremium && styles.usagePillLow]}>
            <Text style={styles.usagePillText}>
              {isPremium ? (remaining <= 20 ? `⭐ Premium (${remaining} left this week)` : '⭐ Premium') : `💬 ${remaining} left this week`}
            </Text>
          </View>
        </View>
      )}

      {/* Main Chat Area */}
      {messages.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.welcomeScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Continue Card if existing */}
          {lastThread && (
            <Pressable
              style={({ pressed }) => [
                styles.continueCard,
                pressed && styles.continueCardPressed,
              ]}
              onPress={() => handleSelectThread(lastThread)}
              accessibilityRole="button"
              accessibilityLabel={`Continue chat: ${lastThread.title}`}
            >
              <View style={styles.continueCardContent}>
                <Text style={styles.continueCardTag}>Continue where you left off ⏱️</Text>
                <Text style={styles.continueCardTitle} numberOfLines={1}>
                  {lastThread.title}
                </Text>
              </View>
              <Text style={styles.continueCardArrow}>→</Text>
            </Pressable>
          )}

          {/* Prototype Welcome Banner Card */}
          <LinearGradient
            colors={gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.welcomeBanner}
          >
            <Text style={styles.bannerOwl}>🦉</Text>
            <Text style={styles.bannerTitle}>Hi {studentName || 'there'}! 👋</Text>
            <Text style={styles.bannerSubtitle}>
              I'm Kidsko! What do you want to learn today?
            </Text>
          </LinearGradient>

          {/* Try Asking Me Section */}
          <Text style={styles.promptSectionLabel}>Try asking me...</Text>
          <View style={styles.promptGrid}>
            {PROMPT_CARDS.map((card, idx) => (
              <Pressable
                key={idx}
                style={({ pressed }) => [
                  styles.promptCard,
                  pressed && styles.promptCardPressed,
                ]}
                onPress={() => handleSendPrompt(card.text)}
              >
                <Text style={styles.promptCardEmoji}>{card.icon}</Text>
                <Text style={styles.promptCardText}>{card.text}</Text>
              </Pressable>
            ))}
          </View>

          {/* Homework Photo Help Card */}
          <Pressable
            style={({ pressed }) => [
              styles.homeworkPromptCard,
              pressed && styles.promptCardPressed,
            ]}
            onPress={() => setShowImagePickerModal(true)}
          >
            <Text style={styles.homeworkCardEmoji}>📸</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.homeworkCardTitle}>Help with my homework</Text>
              <Text style={styles.homeworkCardSubtitle}>Take a photo and Kidsko will explain it step-by-step!</Text>
            </View>
            <Text style={styles.homeworkCardArrow}>›</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => i.toString()}
          style={styles.messagesList}
          contentContainerStyle={{ padding: 16, gap: 14 }}
          renderItem={({ item }) => {
            const isUser = item.role === 'user';
            return (
              <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
                {isUser ? (
                  <View style={styles.msgAvatarUser}>
                    <Text style={styles.avatarEmoji}>👧</Text>
                  </View>
                ) : (
                  <LinearGradient
                    colors={gradients.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.msgAvatarAssistant}
                  >
                    <Text style={styles.avatarEmoji}>🦉</Text>
                  </LinearGradient>
                )}

                {isUser ? (
                  <LinearGradient
                    colors={gradients.teal}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.bubbleUserGradient}
                  >
                    <Text style={styles.bubbleTextUser}>
                      {cleanMessageText(item.content)}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.bubbleAssistant}>
                    <Text style={styles.bubbleTextAssistant}>
                      {cleanMessageText(item.content)}
                    </Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Prototype Image Attachment Bar */}
      {previewImage && (
        <View style={styles.imgPreviewBar}>
          <Image source={{ uri: previewImage.uri }} style={styles.previewThumb} />
          <View style={styles.previewInfo}>
            <Text style={styles.previewTitle}>📸 Photo ready!</Text>
            <Text style={styles.previewSubtitle}>Type your question below and send</Text>
          </View>
          <Pressable
            style={styles.previewCloseBtn}
            onPress={() => setPreviewImage(null)}
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
          >
            <Text style={styles.previewCloseText}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* Kidsko Thinking Bar */}
      {sending && (
        <View style={styles.thinkingBar}>
          <ActivityIndicator size="small" color={colors.coralStrong} />
          <Text style={styles.thinkingText}>Kidsko is thinking... 🧠</Text>
        </View>
      )}

      {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

      {/* Prototype Modern Input Dock */}
      <View style={styles.inputDock}>
        <View style={styles.inputPillBox}>
          <TextInput
            style={styles.dockTextInput}
            placeholder={
              listening
                ? 'Listening... Speak now!'
                : previewImage
                ? 'Ask a question about this photo...'
                : 'Ask me anything... 😊'
            }
            placeholderTextColor={colors.subtext}
            value={input}
            onChangeText={setInput}
            multiline
          />

          <View style={styles.dockActionsRow}>
            {/* Camera Button */}
            <Pressable
              style={styles.dockIconButton}
              onPress={() => setShowImagePickerModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Attach homework photo"
            >
              <Text style={styles.dockIconEmoji}>📷</Text>
            </Pressable>

            {/* Mic Button */}
            <Pressable
              style={[styles.dockIconButton, listening && styles.micButtonListening]}
              onPress={listening ? stopListening : startListening}
              accessibilityRole="button"
              accessibilityLabel="Voice input"
            >
              <Text style={styles.dockIconEmoji}>{listening ? '🔴' : '🎙️'}</Text>
            </Pressable>

            {/* Send Button */}
            <Pressable
              onPress={handleSend}
              disabled={(!input.trim() && !previewImage) || sending}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              <LinearGradient
                colors={
                  !input.trim() && !previewImage
                    ? ['#E0E0E0', '#D0D0D0']
                    : gradients.primary
                }
                style={styles.sendBtnGradient}
              >
                <Text style={styles.sendBtnIcon}>➤</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Image Selection Modal */}
      <Modal visible={showImagePickerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Homework Photo 📷</Text>
            <Text style={styles.modalSubtitle}>How would you like to attach the photo?</Text>

            <Pressable style={styles.optionButton} onPress={handleTakeCamera}>
              <Text style={styles.optionButtonText}>📸 Take Photo with Camera</Text>
            </Pressable>

            <Pressable style={[styles.optionButton, styles.optionButtonSecondary]} onPress={handlePickGallery}>
              <Text style={styles.optionButtonTextSecondary}>🖼️ Choose from Gallery</Text>
            </Pressable>

            <Pressable
              style={styles.cancelModalButton}
              onPress={() => setShowImagePickerModal(false)}
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  topbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonTouch: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    fontSize: 22,
    color: colors.text,
    fontWeight: '900',
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
  hamburgerBarWide: {
    width: 22,
    height: 2,
    backgroundColor: colors.text,
    borderRadius: 2,
  },
  hamburgerBarNarrow: {
    width: 14,
    height: 2,
    backgroundColor: colors.text,
    borderRadius: 2,
  },
  centerStudentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  studentAvatarBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentAvatarEmoji: {
    fontSize: 18,
  },
  studentChatTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
    lineHeight: 16,
  },
  onlineStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00B894',
  },
  onlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00B894',
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
  quotaBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  usagePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.cardBgMuted,
  },
  usagePillLow: {
    backgroundColor: '#FFEAEA',
  },
  usagePillPremium: {
    backgroundColor: '#FEF08A',
  },
  usagePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
  },
  welcomeScrollContent: {
    padding: 16,
    alignItems: 'center',
  },
  continueCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  continueCardPressed: {
    backgroundColor: 'rgba(255, 107, 107, 0.05)',
    borderColor: colors.coralStrong,
  },
  continueCardContent: {
    flex: 1,
    paddingRight: 10,
  },
  continueCardTag: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.coralStrong,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  continueCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  continueCardArrow: {
    fontSize: 18,
    color: colors.coralStrong,
    fontWeight: '900',
  },
  welcomeBanner: {
    width: '100%',
    borderRadius: 24,
    paddingVertical: 22,
    paddingHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 5,
  },
  bannerOwl: {
    fontSize: 48,
    marginBottom: 8,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  bannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
  },
  promptSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.subtext,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  promptGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  promptCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  promptCardPressed: {
    borderColor: colors.coralStrong,
    backgroundColor: 'rgba(255, 107, 107, 0.04)',
  },
  promptCardEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  promptCardText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 16,
  },
  homeworkPromptCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 2,
    borderColor: 'rgba(78, 205, 196, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  homeworkCardEmoji: {
    fontSize: 28,
  },
  homeworkCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  homeworkCardSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.subtext,
    marginTop: 2,
  },
  homeworkCardArrow: {
    fontSize: 20,
    fontWeight: '900',
    color: '#4ECDC4',
  },
  messagesList: {
    flex: 1,
    backgroundColor: colors.background,
  },
  msgRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
  },
  msgRowUser: {
    flexDirection: 'row-reverse',
  },
  msgAvatarUser: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#74B9FF',
  },
  msgAvatarAssistant: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 18,
  },
  bubbleUserGradient: {
    maxWidth: '78%',
    borderRadius: 20,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  bubbleTextUser: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 21,
  },
  bubbleAssistant: {
    maxWidth: '78%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  bubbleTextAssistant: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 22,
  },
  imgPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 2,
    borderTopColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  previewThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  previewInfo: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  previewSubtitle: {
    fontSize: 11,
    color: colors.subtext,
    fontWeight: '600',
  },
  previewCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFE0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '900',
  },
  thinkingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  thinkingText: {
    fontSize: 12,
    color: colors.subtext,
    fontWeight: '700',
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  inputDock: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  inputPillBox: {
    backgroundColor: colors.background,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 4,
  },
  dockTextInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    maxHeight: 100,
    paddingVertical: 6,
  },
  dockActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 6,
  },
  dockIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  dockIconEmoji: {
    fontSize: 18,
  },
  micButtonListening: {
    backgroundColor: '#FEE2E2',
  },
  sendBtnGradient: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.subtext,
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  optionButton: {
    width: '100%',
    backgroundColor: colors.coralStrong,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  optionButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  optionButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionButtonTextSecondary: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  cancelModalButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelModalText: {
    color: colors.subtext,
    fontWeight: '700',
    fontSize: 15,
  },
});
