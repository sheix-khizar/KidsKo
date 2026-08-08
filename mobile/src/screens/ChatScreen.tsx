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
} from 'react-native';
import * as Speech from 'expo-speech';
import { sendMessage, Message } from '../services/chat';
import { useVoiceInput } from '../hooks/useVoiceInput';

type Props = {
  studentId: string;
  studentName: string;
  onBack: () => void;
  initialThreadId?: string;
  initialExplanation?: string;
  onLimitReached?: () => void;
};

export default function ChatScreen({ studentId, studentName, onBack, initialThreadId, initialExplanation, onLimitReached }: Props) {
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
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const listRef = useRef<FlatList>(null);

  const { listening, startListening, stopListening } = useVoiceInput((transcript) => {
    setInput(transcript);
  });

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const handleSpeak = async (text: string, index: number) => {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking && speakingIdx === index) {
      Speech.stop();
      setSpeakingIdx(null);
      return;
    }

    Speech.stop();
    setSpeakingIdx(index);
    Speech.speak(text, {
      language: 'en-US',
      rate: 0.9,
      onDone: () => setSpeakingIdx(null),
      onStopped: () => setSpeakingIdx(null),
      onError: () => setSpeakingIdx(null),
    });
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    if (listening) stopListening();
    Speech.stop();
    setSpeakingIdx(null);

    setErrorMsg(null);
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setSending(true);

    try {
      const result = await sendMessage(studentId, text, threadId);
      setThreadId(result.threadId);
      setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
      setRemaining(result.remaining);
      setIsPremium(result.isPremium);

      // Auto-read Kidsko's reply aloud for kids!
      Speech.speak(result.reply, {
        language: 'en-US',
        rate: 0.9,
      });
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => { Speech.stop(); onBack(); }}>
          <Text style={styles.backButton}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Kidsko.ai 🦉</Text>
        <Text style={styles.headerSubtitle}>{studentName}</Text>
        {remaining !== null && (
          <View style={[styles.usagePill, isPremium && styles.usagePillPremium, remaining <= 2 && !isPremium && styles.usagePillLow]}>
            <Text style={styles.usagePillText}>
              {isPremium ? '⭐ Premium' : `💬 ${remaining} left today`}
            </Text>
          </View>
        )}
      </View>

      {messages.length === 0 ? (
        <View style={styles.welcome}>
          <Text style={styles.welcomeEmoji}>🦉</Text>
          <Text style={styles.welcomeTitle}>Ask me anything!</Text>
          <Text style={styles.welcomeSubtitle}>Type or tap the mic 🎙️ to talk to me!</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => i.toString()}
          style={styles.messagesList}
          contentContainerStyle={{ padding: 14, gap: 12 }}
          renderItem={({ item, index }) => (
            <View style={[styles.msgRow, item.role === 'user' && styles.msgRowUser]}>
              <View style={styles.avatar}>
                <Text>{item.role === 'user' ? '🧒' : '🦉'}</Text>
              </View>
              <View style={[styles.bubble, item.role === 'user' && styles.bubbleUser]}>
                <Text style={[styles.bubbleText, item.role === 'user' && styles.bubbleTextUser]}>
                  {item.content}
                </Text>
                {item.role === 'assistant' && (
                  <Pressable
                    style={styles.speakButton}
                    onPress={() => handleSpeak(item.content, index)}
                  >
                    <Text style={styles.speakButtonText}>
                      {speakingIdx === index ? '⏹️ Stop Reading' : '🔊 Read Aloud'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        />
      )}

      {sending && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color="#1a73e8" />
          <Text style={styles.typingText}>Kidsko is thinking...</Text>
        </View>
      )}

      {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

      <View style={styles.inputBar}>
        <Pressable
          style={[styles.micButton, listening && styles.micButtonListening]}
          onPress={listening ? stopListening : startListening}
        >
          <Text style={styles.micButtonText}>{listening ? '🔴' : '🎙️'}</Text>
        </Pressable>

        <TextInput
          style={[styles.input, listening && styles.inputListening]}
          placeholder={listening ? 'Listening... Speak now!' : 'Ask Kidsko anything...'}
          value={input}
          onChangeText={setInput}
          multiline
        />
        <Pressable
          style={[styles.sendButton, !input.trim() && styles.sendButtonInactive]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          <Text style={styles.sendButtonText}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingTop: 55,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: { color: '#1a73e8', fontWeight: '700', marginBottom: 6 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111' },
  headerSubtitle: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  usagePill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#e8f0fe',
  },
  usagePillLow: { backgroundColor: '#fff3e0' },
  usagePillPremium: { backgroundColor: '#FFD54F' },
  usagePillText: { fontSize: 11, fontWeight: '800', color: '#1a73e8' },
  welcome: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  welcomeEmoji: { fontSize: 56, marginBottom: 10 },
  welcomeTitle: { fontSize: 20, fontWeight: '800', color: '#111' },
  welcomeSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  messagesList: { flex: 1 },
  msgRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  msgRowUser: { flexDirection: 'row-reverse' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFD54F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubble: {
    backgroundColor: '#f4f4f4',
    borderRadius: 18,
    padding: 12,
    maxWidth: '75%',
  },
  bubbleUser: { backgroundColor: '#1a73e8' },
  bubbleText: { fontSize: 14, color: '#111', lineHeight: 20 },
  bubbleTextUser: { color: '#fff' },
  speakButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#E6F4FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  speakButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
  typingText: { fontSize: 12, color: '#6b7280' },
  error: { color: '#EA4335', textAlign: 'center', paddingHorizontal: 16, paddingBottom: 6, fontSize: 12 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f4f4f4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonListening: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  micButtonText: { fontSize: 18 },
  input: {
    flex: 1,
    backgroundColor: '#f4f4f4',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  inputListening: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
    borderWidth: 1,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonInactive: { backgroundColor: '#ccc' },
  sendButtonText: { color: '#fff', fontSize: 16 },
});
