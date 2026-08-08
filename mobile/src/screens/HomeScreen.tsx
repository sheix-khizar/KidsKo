import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { createStudent, getStudents, clearToken } from '../services/api';
import ParentalGate from '../components/ParentalGate';

type Student = { id: string; student_name: string };

type Props = {
  onLoggedOut: () => void;
  onSelectStudent: (student: Student) => void;
  onScanStudent: (student: Student) => void;
  onOpenTranscript: (student: Student) => void;
};

export default function HomeScreen({ onLoggedOut, onSelectStudent, onScanStudent, onOpenTranscript }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [gateVisible, setGateVisible] = useState(false);
  const [gateAction, setGateAction] = useState<'logout' | 'transcript' | null>(null);
  const [targetStudent, setTargetStudent] = useState<Student | null>(null);

  const loadStudents = async () => {
    try {
      const data = await getStudents();
      setStudents(data);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const handleAddStudent = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    setErrorMsg(null);
    try {
      await createStudent(newName.trim());
      setNewName('');
      await loadStudents();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleLogout = async () => {
    await clearToken();
    onLoggedOut();
  };

  const triggerTranscriptGate = (student: Student) => {
    setTargetStudent(student);
    setGateAction('transcript');
    setGateVisible(true);
  };

  const triggerLogoutGate = () => {
    setGateAction('logout');
    setGateVisible(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kidsko.ai 🦉</Text>
      <Text style={styles.subtitle}>Select a student to chat, scan homework, or view transcript</Text>

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="Student name (e.g. Aisha)"
          value={newName}
          onChangeText={setNewName}
        />
        <Pressable style={styles.addButton} onPress={handleAddStudent} disabled={adding}>
          {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.addButtonText}>Add</Text>}
        </Pressable>
      </View>

      {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          style={{ marginTop: 16 }}
          renderItem={({ item }) => (
            <View style={styles.studentCard}>
              <Pressable style={styles.studentRow} onPress={() => onSelectStudent(item)}>
                <Text style={styles.studentEmoji}>🧒</Text>
                <Text style={styles.studentName}>{item.student_name}</Text>
              </Pressable>
              <Pressable style={styles.scanBtn} onPress={() => onScanStudent(item)}>
                <Text style={styles.scanBtnText}>📸 Scan</Text>
              </Pressable>
              <Pressable style={styles.chatBtn} onPress={() => onSelectStudent(item)}>
                <Text style={styles.chatBtnText}>💬 Chat</Text>
              </Pressable>
              <Pressable style={styles.transcriptBtn} onPress={() => triggerTranscriptGate(item)}>
                <Text style={styles.transcriptBtnText}>📜 History</Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No students yet — add one above.</Text>}
        />
      )}

      <Pressable style={styles.logoutButton} onPress={triggerLogoutGate}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>

      <ParentalGate
        visible={gateVisible}
        onSuccess={() => {
          setGateVisible(false);
          if (gateAction === 'logout') {
            handleLogout();
          } else if (gateAction === 'transcript' && targetStudent) {
            onOpenTranscript(targetStudent);
          }
        }}
        onCancel={() => setGateVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fc', padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a73e8' },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  addRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
  },
  addButton: { backgroundColor: '#1a73e8', borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  addButtonText: { color: '#fff', fontWeight: '700' },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  studentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  studentEmoji: { fontSize: 20 },
  studentName: { fontSize: 15, fontWeight: '700', color: '#111' },
  scanBtn: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  scanBtnText: { fontSize: 12, fontWeight: '700', color: '#B78103' },
  chatBtn: {
    backgroundColor: '#E6F4FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  chatBtnText: { fontSize: 12, fontWeight: '700', color: '#0369A1' },
  transcriptBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  transcriptBtnText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 20 },
  logoutButton: { marginTop: 'auto', padding: 14, alignItems: 'center' },
  logoutText: { color: '#EA4335', fontWeight: '700' },
  error: { color: '#EA4335', marginTop: 8, textAlign: 'center' },
});
