import { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import RegisterScreen from './src/screens/RegisterScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import { getToken } from './src/services/api';

type Screen = 'checking' | 'register' | 'login' | 'home';

export default function App() {
  const [screen, setScreen] = useState<Screen>('checking');

  // On app launch, check if a token already exists (auto-login)
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
    return (
      <RegisterScreen
        onRegistered={() => setScreen('home')}
        onGoToLogin={() => setScreen('login')}
      />
    );
  }

  if (screen === 'login') {
    return (
      <LoginScreen
        onLoggedIn={() => setScreen('home')}
        onGoToRegister={() => setScreen('register')}
      />
    );
  }

  return <HomeScreen onLoggedOut={() => setScreen('login')} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7f9fc' },
});