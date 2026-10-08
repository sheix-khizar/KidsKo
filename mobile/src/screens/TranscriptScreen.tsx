import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { getTranscript } from '../services/api';

type Message = { role: string; content: string; message_type?: string; created_at: string };

type Props = {
  studentId: string;
  studentName: string;
  onBack: () => void;
};

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>{studentName}'s Chat Transcript 📜</Text>
      </View>

      {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

      {loading ? (
        <ActivityIndicator style={styles.center} size="large" color="#1a73e8" />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const isUser = item.role === 'user';
            return (
              <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                <Text style={styles.roleLabel}>{isUser ? studentName : 'Kidsko AI 🦉'}</Text>
                <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
                  {item.content}
                </Text>
                <Text style={styles.timeText}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>No transcript history available for this student.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fc', paddingTop: 50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  backBtn: { paddingRight: 12 },
  backText: { color: '#1a73e8', fontWeight: '700', fontSize: 16 },
  title: { fontSize: 18, fontWeight: '800', color: '#111', flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: '#EA4335', textAlign: 'center', margin: 16 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#1a73e8',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  roleLabel: { fontSize: 11, fontWeight: '700', marginBottom: 2, color: '#6b7280' },
  messageText: { fontSize: 15, lineHeight: 20 },
  userText: { color: '#fff' },
  assistantText: { color: '#111' },
  timeText: { fontSize: 10, color: '#9ca3af', marginTop: 4, alignSelf: 'flex-end' },
});
