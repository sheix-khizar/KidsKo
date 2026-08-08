import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { VoiceSession } from '../services/voiceSocket';

type Props = {
  studentName: string;
  onBack: () => void;
  onLimitReached: () => void;
};

export default function LiveVoiceScreen({ studentName, onBack, onLimitReached }: Props) {
  const [status, setStatus] = useState<'connecting' | 'live' | 'ended'>('connecting');
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const sessionRef = useRef<VoiceSession | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const session = new VoiceSession();
    sessionRef.current = session;

    session.start({
      onReady: (capSeconds) => {
        setStatus('live');
        setSecondsLeft(capSeconds);
        timerRef.current = setInterval(() => {
          setSecondsLeft((s) => (s !== null && s > 0 ? s - 1 : 0));
        }, 1000);
      },
      onCapReached: () => {
        setStatus('ended');
        if (timerRef.current) clearInterval(timerRef.current);
      },
      onError: (reason) => {
        if (reason && reason.toLowerCase().includes('limit')) onLimitReached();
        setStatus('ended');
      },
      onClose: () => setStatus('ended'),
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      sessionRef.current?.end();
    };
  }, []);

  const handleEnd = async () => {
    await sessionRef.current?.end();
    onBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {status === 'connecting'
          ? 'Connecting to Kidsko Live...'
          : status === 'live'
          ? `🎙️ Talking to Kidsko (${studentName})`
          : 'Voice Session Ended'}
      </Text>
      {secondsLeft !== null && <Text style={styles.timer}>{secondsLeft}s remaining</Text>}
      <Pressable style={styles.endButton} onPress={handleEnd}>
        <Text style={styles.endButtonText}>{status === 'ended' ? 'Close' : 'End Call'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 24 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 12, textAlign: 'center' },
  timer: { fontSize: 16, color: '#FFD54F', fontWeight: '700', marginBottom: 40 },
  endButton: { backgroundColor: '#EA4335', borderRadius: 30, paddingVertical: 14, paddingHorizontal: 40 },
  endButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
