import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, BackHandler } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Mascot, LinearGradient, Bounce, FloatStar, LoadBar, SafeAreaProvider, FadeSlideIn } from './src/ui';
import WelcomeScreen from './src/screens/WelcomeScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import LoginScreen from './src/screens/LoginScreen';
import MainShellScreen from './src/screens/MainShellScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import TranscriptScreen from './src/screens/TranscriptScreen';
import LiveVoiceScreen from './src/screens/LiveVoiceScreen';
import ParentalGate from './src/components/ParentalGate';
import { colors, fontFamilies, gradients } from './src/theme';
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

// Keep native splash screen visible while JS bundle boots
SplashScreen.preventAutoHideAsync().catch(() => {});

type Student = { id: string; student_name: string };
type Screen =
  | 'checking'
  | 'welcome'
  | 'register'
  | 'login'
  | 'main'
  | 'paywall'
  | 'transcript'
  | 'liveVoice';

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

  // Hide native splash screen once fonts are loaded to reveal the animated loading view
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  // Auth check with minimum 1.2s display for the animated loading view
  useEffect(() => {
    let isMounted = true;
    const startTime = Date.now();

    (async () => {
      await loadSavedApiUrl();
      const token = await getToken();

      const elapsed = Date.now() - startTime;
      const minDisplay = 1200; // minimum display time per Step 7.2
      const remaining = Math.max(0, minDisplay - elapsed);

      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      if (isMounted) {
        if (token) {
          setScreen('main');
        } else {
          setScreen('welcome');
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Hardware back button on Android
  useEffect(() => {
    const onBackPress = () => {
      if (screen === 'liveVoice' || screen === 'transcript' || screen === 'paywall') {
        setScreen('main');
        return true;
      }
      if (screen === 'login' || screen === 'register') {
        setScreen('welcome');
        return true;
      }
      return false; // On 'welcome' or 'main', let shell handle tab or OS exit app
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
        <View style={styles.splashContainer}>
          <LinearGradient
            colors={gradients.splash.colors}
            start={gradients.splash.start}
            end={gradients.splash.end}
            style={StyleSheet.absoluteFill}
          />

          {/* Decorative soft corner circles (no blur per Section 5 spec) */}
          <View style={styles.topRightCircle} pointerEvents="none" />
          <View style={styles.bottomLeftCircle} pointerEvents="none" />

          {/* Floating stars */}
          <FloatStar delay={0} style={styles.starTopLeft}>
            <Text style={styles.starEmoji}>✨</Text>
          </FloatStar>
          <FloatStar delay={400} style={styles.starTopRight}>
            <Text style={styles.starEmoji}>🌟</Text>
          </FloatStar>
          <FloatStar delay={800} style={styles.starMidRight}>
            <Text style={styles.starEmoji}>⭐</Text>
          </FloatStar>

          <View style={styles.splashContent}>
            <Bounce>
              <Mascot size="l" />
            </Bounce>
            <Text style={styles.splashTitle}>
              Kidsko<Text style={styles.splashTitleAi}>.ai</Text>
            </Text>
            <Text style={styles.splashSubtitle}>
              {'Your friendly AI teacher! 🎓\nAsk me anything, anytime!'}
            </Text>
            <View style={styles.loadBarWrapper}>
              <LoadBar duration={1200} color={colors.coralStrong} />
            </View>
          </View>
        </View>
      );
    }

    if (screen === 'welcome') {
      return (
        <FadeSlideIn key='welcome' duration={220} style={{ flex: 1 }}>
          <WelcomeScreen
          onStartLearning={() => setScreen('register')}
          onGoToLogin={() => setScreen('login')}
        />
        </FadeSlideIn>
      );
    }

    if (screen === 'register') {
      return (
        <FadeSlideIn key='register' duration={220} style={{ flex: 1 }}>
          <RegisterScreen
          onRegistered={() => setScreen('main')}
          onGoToLogin={() => setScreen('login')}
        />
        </FadeSlideIn>
      );
    }

    if (screen === 'login') {
      return (
        <FadeSlideIn key='login' duration={220} style={{ flex: 1 }}>
          <LoginScreen
          onLoggedIn={() => setScreen('main')}
          onGoToRegister={() => setScreen('register')}
        />
        </FadeSlideIn>
      );
    }

    // Authenticated screens: keep MainShellScreen mounted in background so calls/transcripts/paywall don't drop chat state
    return (
      <FadeSlideIn key='auth-stack' duration={220} style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <View style={[{ flex: 1 }, screen !== 'main' && { display: 'none' }]}>
          <MainShellScreen
            onLogout={() => setScreen('welcome')}
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
      </FadeSlideIn>
    );
  };

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.background }}>
      {renderContent()}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  topRightCircle: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
  },
  bottomLeftCircle: {
    position: 'absolute',
    bottom: 120,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(78, 205, 196, 0.12)',
  },
  starTopLeft: {
    position: 'absolute',
    top: 96,
    left: 28,
    zIndex: 2,
    opacity: 0.8,
  },
  starTopRight: {
    position: 'absolute',
    top: 86,
    right: 44,
    zIndex: 2,
    opacity: 0.8,
  },
  starMidRight: {
    position: 'absolute',
    top: 144,
    right: 24,
    zIndex: 2,
    opacity: 0.8,
  },
  starEmoji: {
    fontSize: 26,
  },
  splashContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: 3,
  },
  splashTitle: {
    fontSize: 42,
    fontFamily: fontFamilies.black,
    color: colors.text,
    marginTop: 20,
    letterSpacing: -1,
    lineHeight: 48,
  },
  splashTitleAi: {
    color: colors.coral,
  },
  splashSubtitle: {
    fontSize: 15,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 10,
    marginBottom: 28,
  },
  loadBarWrapper: {
    width: 160,
    marginTop: 8,
  },
});