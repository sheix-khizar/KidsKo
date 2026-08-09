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
  const [errorReason, setErrorReason] = useState<string | null>(null);
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
        setErrorReason('Voice limit for this session reached.');
        if (timerRef.current) clearInterval(timerRef.current);
      },
      onError: (reason) => {
        if (reason && reason.toString().toLowerCase().includes('limit')) onLimitReached();
        setErrorReason(reason?.toString() || 'Connection error');
        setStatus('ended');
      },
      onClose: (reason) => {
        if (reason) setErrorReason(reason.toString());
        setStatus('ended');
      },
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
      {secondsLeft !== null && status === 'live' && <Text style={styles.timer}>{secondsLeft}s remaining</Text>}
      {errorReason && <Text style={styles.errorSub}>{errorReason}</Text>}
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
  errorSub: { fontSize: 14, color: '#FF8A80', fontWeight: '600', marginBottom: 30, textAlign: 'center' },
  endButton: { backgroundColor: '#EA4335', borderRadius: 30, paddingVertical: 14, paddingHorizontal: 40 },
  endButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
