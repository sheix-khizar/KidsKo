import { fontFamilies } from '../theme';
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
import { Mascot } from '../ui';
import { sendMessage, Message } from '../services/chat';
import { analyzeHomework } from '../services/homework';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { pickImageFromGallery, captureImageFromCamera, ProcessedImage } from '../utils/imageHelper';
import { cleanMessageText } from '../utils/messageText';
import { colors, radii, typography, spacing } from '../theme';
import ChatHistoryDrawer from '../components/ChatHistoryDrawer';
import ParentalGate from '../components/ParentalGate';
import { ThreadSummary, getThreads, getThreadMessages, deleteThread } from '../services/threads';

const SUGGESTION_CHIPS = [
  { text: 'Why is the sky blue?', isHomework: false },
  { text: 'Help me with fractions', isHomework: false },
  { text: 'Tell me about dinosaurs', isHomework: false },
  { text: '📸 Help with my homework', isHomework: true },
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

  // History drawer and continuity states (L4)
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


  const handleSend = async () => {
    const userText = input.trim();
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
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeftActions}>
            {!embedded && (
              <Pressable onPress={onBack} style={styles.backButtonTouch}>
                <Text style={styles.backButton}>← Back</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => setShowDrawer(true)}
              style={styles.hamburgerButton}
              accessibilityRole="button"
              accessibilityLabel="Open chat history drawer"
            >
              <Text style={styles.hamburgerIcon}>☰</Text>
            </Pressable>
          </View>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Kidsko.ai 🦉</Text>
            <Text style={styles.headerSubtitle}>{studentName}</Text>
          </View>
        </View>
        {remaining !== null && (
          <View style={[styles.usagePill, isPremium && styles.usagePillPremium, remaining <= 5 && !isPremium && styles.usagePillLow]}>
            <Text style={styles.usagePillText}>
              {isPremium ? (remaining <= 20 ? `⭐ Premium (${remaining} left this week)` : '⭐ Premium') : `💬 ${remaining} left this week`}
            </Text>
          </View>
        )}
      </View>

      {messages.length === 0 ? (
        <ScrollView contentContainerStyle={styles.welcomeContainer}>
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
                <View style={styles.continueCardHeader}>
                  <Text style={styles.continueCardTag}>Continue where you left off ⏱️</Text>
                </View>
                <Text style={styles.continueCardTitle} numberOfLines={1}>
                  {lastThread.title}
                </Text>
              </View>
              <Text style={styles.continueCardArrow}>→</Text>
            </Pressable>
          )}

          <Mascot size="m" style={{ marginBottom: 12 }} />
          <Text style={styles.welcomeTitle}>Hi, {studentName}! 🦉</Text>
          <Text style={styles.welcomeSubtitle}>What would you like to explore today?</Text>

          <View style={styles.chipsContainer}>
            {SUGGESTION_CHIPS.map((chip, idx) => (
              <Pressable
                key={idx}
                style={({ pressed }) => [
                  styles.chipButton,
                  pressed && styles.chipButtonPressed,
                ]}
                onPress={() => {
                  if (chip.isHomework) {
                    setShowImagePickerModal(true);
                  } else {
                    setInput(chip.text);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={chip.text}
              >
                <Text style={styles.chipText}>{chip.text}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => i.toString()}
          style={styles.messagesList}
          contentContainerStyle={{ padding: 14, gap: 12 }}
          renderItem={({ item }) => (
            <View style={[styles.msgRow, item.role === 'user' && styles.msgRowUser]}>
              <View style={[styles.avatar, item.role === 'user' && styles.avatarUser]}>
                <Text>{item.role === 'user' ? '🧒' : '🦉'}</Text>
              </View>
              <View style={[styles.bubble, item.role === 'user' && styles.bubbleUser]}>
                <Text style={[styles.bubbleText, item.role === 'user' && styles.bubbleTextUser]}>
                  {cleanMessageText(item.content)}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Image Attachment Bar (directly above inputBar) */}
      {previewImage && (
        <View style={styles.attachmentBar}>
          <Image source={{ uri: previewImage.uri }} style={styles.attachmentThumbnail} />
          <View style={styles.attachmentInfo}>
            <Text style={styles.attachmentTitle}>Homework Photo Attached 📷</Text>
            <Text style={styles.attachmentSub}>Type your question below or tap send</Text>
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

      {sending && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={colors.coralStrong} />
          <Text style={styles.typingText}>Kidsko is thinking...</Text>
        </View>
      )}

      {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

      <View style={styles.inputBar}>
        <Pressable
          style={styles.imagePickerButton}
          onPress={() => setShowImagePickerModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Attach homework photo"
        >
          <Text style={styles.imagePickerButtonText}>📷</Text>
        </Pressable>

        <Pressable
          style={[styles.micButton, listening && styles.micButtonListening]}
          onPress={listening ? stopListening : startListening}
          accessibilityRole="button"
          accessibilityLabel="Voice input"
        >
          <Text style={styles.micButtonText}>{listening ? '🔴' : '🎙️'}</Text>
        </Pressable>

        <TextInput
          style={[styles.input, listening && styles.inputListening]}
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
        <Pressable
          style={[
            styles.sendButton,
            !input.trim() && !previewImage && styles.sendButtonInactive,
          ]}
          onPress={handleSend}
          disabled={(!input.trim() && !previewImage) || sending}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <Text style={styles.sendButtonText}>➤</Text>
        </Pressable>
      </View>

      {/* Image Selection Modal */}
      <Modal visible={showImagePickerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Homework Photo</Text>
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
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelModalText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Chat History Drawer (L4) */}
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

      {/* Parental Gate for deleting chat thread (L4) */}
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
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLeftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButtonTouch: {
    paddingVertical: 4,
    paddingRight: 4,
  },
  backButton: { color: colors.coralStrong, fontFamily: fontFamilies.bold, fontSize: 14 },
  hamburgerButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.cardBgMuted,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hamburgerIcon: {
    fontSize: 20,
    color: colors.text,
    fontFamily: fontFamilies.extraBold,
    marginTop: -2,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: { ...typography.subheading, fontSize: 18, fontFamily: fontFamilies.black, color: colors.coralStrong },
  headerSubtitle: { ...typography.caption, fontSize: 13, color: colors.subtext, fontFamily: fontFamilies.bold, marginTop: 1 },
  usagePill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.cardBgMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  usagePillLow: {
    backgroundColor: '#FFF0F0',
    borderColor: colors.coralStrong,
  },
  usagePillPremium: {
    backgroundColor: '#FEF08A',
    borderColor: '#FDE047',
  },
  usagePillText: { ...typography.caption, fontSize: 11, fontFamily: fontFamilies.extraBold, color: colors.text },
  welcomeContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  continueCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  continueCardPressed: {
    backgroundColor: colors.cardBgMuted,
    borderColor: colors.coralStrong,
  },
  continueCardContent: {
    flex: 1,
    paddingRight: 10,
  },
  continueCardHeader: {
    marginBottom: 4,
  },
  continueCardTag: {
    ...typography.caption,
    fontSize: 11,
    fontFamily: fontFamilies.extraBold,
    color: colors.coralStrong,
    textTransform: 'uppercase',
  },
  continueCardTitle: {
    ...typography.label,
    fontSize: 14,
    color: colors.text,
  },
  continueCardArrow: {
    fontSize: 18,
    color: colors.coralStrong,
    fontFamily: fontFamilies.black,
  },
  welcomeTitle: {
    ...typography.heading,
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.subtext,
    marginTop: 6,
    marginBottom: 20,
    textAlign: 'center',
  },
  chipsContainer: {
    width: '100%',
    maxWidth: 340,
    gap: 10,
  },
  chipButton: {
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipButtonPressed: {
    backgroundColor: colors.cardBgMuted,
    borderColor: colors.coralStrong,
  },
  chipText: {
    ...typography.body,
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: colors.text,
  },
  messagesList: { flex: 1, backgroundColor: colors.background },
  msgRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  msgRowUser: { flexDirection: 'row-reverse' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.sun,
    borderWidth: 1.5,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarUser: {
    backgroundColor: colors.cardBgMuted,
    borderColor: colors.border,
  },
  bubble: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
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
  bubbleText: { ...typography.body, fontSize: 15, color: colors.text, lineHeight: 22 },
  bubbleTextUser: { color: colors.white },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  typingText: { ...typography.caption, fontSize: 13, color: colors.subtext, fontFamily: fontFamilies.semiBold },
  error: { color: colors.error, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 6, fontSize: 12, fontFamily: fontFamilies.bold },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  imagePickerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardBgMuted,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickerButtonText: { fontSize: 20 },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardBgMuted,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonListening: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: colors.coralStrong,
  },
  micButtonText: { fontSize: 20 },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 110,
    color: colors.text,
  },
  inputListening: {
    backgroundColor: '#FFF0F0',
    borderColor: colors.coralStrong,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.coralStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonInactive: {
    backgroundColor: '#E2E8F0',
  },
  sendButtonText: { color: colors.white, fontSize: 18, fontFamily: fontFamilies.black },
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
  attachmentThumbnail: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#CBD5E1' },
  attachmentInfo: { flex: 1, justifyContent: 'center' },
  attachmentTitle: { ...typography.label, fontSize: 13, color: colors.text },
  attachmentSub: { ...typography.caption, fontSize: 11, color: colors.subtext },
  removeAttachmentBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeAttachmentText: { color: colors.subtext, fontSize: 16, fontFamily: fontFamilies.extraBold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: { ...typography.heading, fontSize: 19, color: colors.text },
  modalSubtitle: { ...typography.caption, fontSize: 13, color: colors.subtext, marginBottom: 8, textAlign: 'center' },
  optionButton: {
    width: '100%',
    backgroundColor: colors.coralStrong,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  optionButtonText: { color: colors.white, fontFamily: fontFamilies.extraBold, fontSize: 15 },
  optionButtonSecondary: {
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionButtonTextSecondary: { color: colors.text, fontFamily: fontFamilies.extraBold, fontSize: 15 },
  cancelModalButton: {
    marginTop: 8,
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelModalText: { color: colors.subtext, fontFamily: fontFamilies.bold, fontSize: 15 },
});
