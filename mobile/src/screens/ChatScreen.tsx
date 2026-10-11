import { useState, useRef } from 'react';
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

  const listRef = useRef<FlatList>(null);

  const { listening, startListening, stopListening } = useVoiceInput((transcript) => {
    setInput(transcript);
  });


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
        {!embedded && (
          <Pressable onPress={onBack}>
            <Text style={styles.backButton}>← Back</Text>
          </Pressable>
        )}
        <Text style={styles.headerTitle}>Kidsko.ai 🦉</Text>
        <Text style={styles.headerSubtitle}>{studentName}</Text>
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
          <Pressable style={styles.removeAttachmentBtn} onPress={() => setPreviewImage(null)}>
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

            <Pressable style={styles.cancelModalButton} onPress={() => setShowImagePickerModal(false)}>
              <Text style={styles.cancelModalText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  backButton: { color: colors.coralStrong, fontWeight: '700', marginBottom: 6, fontSize: 14 },
  headerTitle: { ...typography.subheading, fontSize: 18, fontWeight: '900', color: colors.coralStrong },
  headerSubtitle: { ...typography.caption, fontSize: 13, color: colors.subtext, fontWeight: '700', marginTop: 2 },
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
  usagePillText: { ...typography.caption, fontSize: 11, fontWeight: '800', color: colors.text },
  welcomeContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
    fontWeight: '700',
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
  typingText: { ...typography.caption, fontSize: 13, color: colors.subtext, fontWeight: '600' },
  error: { color: colors.error, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 6, fontSize: 12, fontWeight: '700' },
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
  sendButtonText: { color: colors.white, fontSize: 18, fontWeight: '900' },
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
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeAttachmentText: { color: colors.subtext, fontSize: 14, fontWeight: '800' },
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
  optionButtonText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  optionButtonSecondary: {
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionButtonTextSecondary: { color: colors.text, fontWeight: '800', fontSize: 15 },
  cancelModalButton: { marginTop: 8, paddingVertical: 10 },
  cancelModalText: { color: colors.subtext, fontWeight: '700', fontSize: 15 },
});
