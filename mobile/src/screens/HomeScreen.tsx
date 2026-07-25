import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { createStudent, getStudents, clearToken } from '../services/api';

type Student = { id: string; student_name: string };

type Props = {
  onLoggedOut: () => void;
  onSelectStudent: (student: Student) => void;
};

export default function HomeScreen({ onLoggedOut, onSelectStudent }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kidsko.ai 🦉</Text>
      <Text style={styles.subtitle}>Tap a student to start chatting</Text>

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
            <Pressable style={styles.studentRow} onPress={() => onSelectStudent(item)}>
              <Text style={styles.studentEmoji}>🧒</Text>
              <Text style={styles.studentName}>{item.student_name}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No students yet — add one above.</Text>}
        />
      )}

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
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
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  studentEmoji: { fontSize: 20 },
  studentName: { fontSize: 15, fontWeight: '700', color: '#111', flex: 1 },
  chevron: { fontSize: 18, color: '#ccc' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 20 },
  logoutButton: { marginTop: 'auto', padding: 14, alignItems: 'center' },
  logoutText: { color: '#EA4335', fontWeight: '700' },
  error: { color: '#EA4335', marginTop: 8, textAlign: 'center' },
});
