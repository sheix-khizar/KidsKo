import { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, BackHandler } from 'react-native';
import { Mascot } from './src/ui';
import RegisterScreen from './src/screens/RegisterScreen';
import LoginScreen from './src/screens/LoginScreen';
import MainShellScreen from './src/screens/MainShellScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import TranscriptScreen from './src/screens/TranscriptScreen';
import LiveVoiceScreen from './src/screens/LiveVoiceScreen';
import ParentalGate from './src/components/ParentalGate';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { getToken } from './src/services/api';
import { loadSavedApiUrl } from './src/services/config';

type Student = { id: string; student_name: string };
type Screen = 'checking' | 'register' | 'login' | 'main' | 'paywall' | 'transcript' | 'liveVoice';

export default function App() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });
  const [screen, setScreen] = useState<Screen>('checking');
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [gateVisible, setGateVisible] = useState(false);
  // Bumped after a successful purchase so mounted screens re-check the plan.
  const [billingVersion, setBillingVersion] = useState(0);

  useEffect(() => {
    (async () => {
      await loadSavedApiUrl();
      const token = await getToken();
      if (token) {
        setScreen('main');
      } else {
        setScreen('login');
      }
    })();
  }, []);

  // Hardware back button on Android
  useEffect(() => {
    const onBackPress = () => {
      if (screen === 'liveVoice' || screen === 'transcript' || screen === 'paywall') {
        setScreen('main');
        return true;
      }
      return false; // On 'main', let shell handle tab or OS exit app
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [screen]);

  const handleLimitReached = () => {
    setGateVisible(true);
  };

  const renderContent = () => {
    if (screen === 'checking' || !fontsLoaded) {
      return (
        <View style={styles.brandedSplash}>
          <View style={styles.splashContent}>
            <Mascot size="l" />
            <Text style={styles.splashTitle}>Kidsko.ai</Text>
            <Text style={styles.splashSubtitle}>Your Friendly AI Study Buddy 🦉</Text>
            <ActivityIndicator size="small" color="#D94A4A" style={styles.splashSpinner} />
          </View>
        </View>
      );
    }

    if (screen === 'register') {
      return <RegisterScreen onRegistered={() => setScreen('main')} onGoToLogin={() => setScreen('login')} />;
    }

    if (screen === 'login') {
      return <LoginScreen onLoggedIn={() => setScreen('main')} onGoToRegister={() => setScreen('register')} />;
    }

    // Authenticated screens: keep MainShellScreen mounted in background so calls/transcripts/paywall don't drop chat state
    return (
      <View style={{ flex: 1 }}>
        <View style={[{ flex: 1 }, screen !== 'main' && { display: 'none' }]}>
          <MainShellScreen
            onLogout={() => setScreen('login')}
            onOpenPaywall={() => setScreen('paywall')}
            onOpenTranscript={(student) => {
              setActiveStudent(student);
              setScreen('transcript');
            }}
            onStartCall={(student) => {
              setActiveStudent(student);
              setScreen('liveVoice');
            }}
            onLimitReached={handleLimitReached}
            billingVersion={billingVersion}
          />
        </View>

        {screen === 'paywall' && (
          <PaywallScreen
            onBack={() => setScreen('main')}
            onPurchased={() => {
              setBillingVersion((v) => v + 1);
              setScreen('main');
            }}
          />
        )}

        {screen === 'transcript' && activeStudent && (
          <TranscriptScreen
            studentId={activeStudent.id}
            studentName={activeStudent.student_name}
            onBack={() => setScreen('main')}
          />
        )}

        {screen === 'liveVoice' && activeStudent && (
          <LiveVoiceScreen
            studentId={activeStudent.id}
            studentName={activeStudent.student_name}
            onBack={() => setScreen('main')}
            onLimitReached={handleLimitReached}
          />
        )}

        <ParentalGate
          visible={gateVisible}
          onSuccess={() => {
            setGateVisible(false);
            setScreen('paywall');
          }}
          onCancel={() => setGateVisible(false)}
        />
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF8F0' }}>
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  brandedSplash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
  },
  splashContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  splashTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#D94A4A',
    marginTop: 8,
    letterSpacing: -0.5,
  },
  splashSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#636E72',
  },
  splashSpinner: {
    marginTop: 16,
  },
});