import { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import RegisterScreen from './src/screens/RegisterScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import HomeworkScreen from './src/screens/HomeworkScreen';
import { getToken } from './src/services/api';

type Student = { id: string; student_name: string };
type Screen = 'checking' | 'register' | 'login' | 'home' | 'chat' | 'homework';

export default function App() {
  const [screen, setScreen] = useState<Screen>('checking');
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [scanThreadId, setScanThreadId] = useState<string | undefined>(undefined);
  const [scanExplanation, setScanExplanation] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      setScreen(token ? 'home' : 'login');
    })();
  }, []);

  if (screen === 'checking') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  if (screen === 'register') {
    return <RegisterScreen onRegistered={() => setScreen('home')} onGoToLogin={() => setScreen('login')} />;
  }

  if (screen === 'login') {
    return <LoginScreen onLoggedIn={() => setScreen('home')} onGoToRegister={() => setScreen('register')} />;
  }

  if (screen === 'homework' && activeStudent) {
    return (
      <HomeworkScreen
        studentId={activeStudent.id}
        studentName={activeStudent.student_name}
        onBack={() => setScreen('home')}
        onScanSuccess={(threadId, reply) => {
          setScanThreadId(threadId);
          setScanExplanation(reply);
          setScreen('chat');
        }}
      />
    );
  }

  if (screen === 'chat' && activeStudent) {
    return (
      <ChatScreen
        studentId={activeStudent.id}
        studentName={activeStudent.student_name}
        onBack={() => {
          setScanThreadId(undefined);
          setScanExplanation(undefined);
          setScreen('home');
        }}
        initialThreadId={scanThreadId}
        initialExplanation={scanExplanation}
      />
    );
  }

  return (
    <HomeScreen
      onLoggedOut={() => setScreen('login')}
      onSelectStudent={(student) => {
        setActiveStudent(student);
        setScanThreadId(undefined);
        setScanExplanation(undefined);
        setScreen('chat');
      }}
      onScanStudent={(student) => {
        setActiveStudent(student);
        setScreen('homework');
      }}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7f9fc' },
});