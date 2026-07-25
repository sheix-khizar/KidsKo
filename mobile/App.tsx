import { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import RegisterScreen from './src/screens/RegisterScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import { getToken } from './src/services/api';

type Student = { id: string; student_name: string };
type Screen = 'checking' | 'register' | 'login' | 'home' | 'chat';

export default function App() {
  const [screen, setScreen] = useState<Screen>('checking');
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);

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

  if (screen === 'chat' && activeStudent) {
    return (
      <ChatScreen
        studentId={activeStudent.id}
        studentName={activeStudent.student_name}
        onBack={() => setScreen('home')}
      />
    );
  }

  return (
    <HomeScreen
      onLoggedOut={() => setScreen('login')}
      onSelectStudent={(student) => {
        setActiveStudent(student);
        setScreen('chat');
      }}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7f9fc' },
});