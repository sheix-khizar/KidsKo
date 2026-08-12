import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { VoiceSession } from '../services/voiceSocket';

type Props = {
  studentId: string;
  studentName: string;
  onBack: () => void;
  onLimitReached: () => void;
};

export default function LiveVoiceScreen({ studentId, studentName, onBack, onLimitReached }: Props) {
  const [status, setStatus] = useState<'connecting' | 'live' | 'ended'>('connecting');
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [snapshotsRemaining, setSnapshotsRemaining] = useState<number | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const sessionRef = useRef<VoiceSession | null>(null);
  const timerRef = useRef<any>(null);
  const cameraRef = useRef<CameraView | null>(null);

  useEffect(() => {
    const session = new VoiceSession();
    sessionRef.current = session;

    session.start(
      {
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
        onSnapshotAck: (remaining) => {
          setSnapshotsRemaining(remaining);
          setCameraOpen(false);
        },
        onSnapshotError: (reason) => {
          setCameraOpen(false);
          if (reason.toLowerCase().includes('upgrade') || reason.toLowerCase().includes('used up')) {
            onLimitReached();
          } else {
            setErrorReason(reason);
          }
        },
      },
      studentId
    );

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      sessionRef.current?.end();
    };
  }, []);

  const handleEnd = async () => {
    await sessionRef.current?.end();
    onBack();
  };

  const handleOpenCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setCameraOpen(true);
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
    if (!photo) return;

    const manipResult = await manipulateAsync(
      photo.uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.75, format: SaveFormat.JPEG, base64: true }
    );
    if (manipResult.base64) {
      sessionRef.current?.sendImageCapture(manipResult.base64, 'Please look at this and help me with my homework.');
    }
  };

  return (
    <View style={styles.container}>
      {cameraOpen ? (
        <View style={StyleSheet.absoluteFill}>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
          <View style={styles.cameraControls}>
            <Pressable style={styles.captureButton} onPress={handleCapture}>
              <Text style={styles.captureButtonText}>📸 Capture</Text>
            </Pressable>
            <Pressable onPress={() => setCameraOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.title}>
            {status === 'connecting'
              ? 'Connecting to Kidsko Live...'
              : status === 'live'
              ? `🎙️ Talking to Kidsko (${studentName})`
              : 'Voice Session Ended'}
          </Text>
          {secondsLeft !== null && status === 'live' && <Text style={styles.timer}>{secondsLeft}s remaining</Text>}
          {status === 'live' && (
            <Pressable style={styles.showButton} onPress={handleOpenCamera}>
              <Text style={styles.showButtonText}>📷 Show Kidsko my homework</Text>
            </Pressable>
          )}
          {snapshotsRemaining !== null && (
            <Text style={styles.snapshotCount}>{snapshotsRemaining} photo helps left this week</Text>
          )}
          {errorReason && <Text style={styles.errorSub}>{errorReason}</Text>}
          <Pressable style={styles.endButton} onPress={handleEnd}>
            <Text style={styles.endButtonText}>{status === 'ended' ? 'Close' : 'End Call'}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 24 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 12, textAlign: 'center' },
  timer: { fontSize: 16, color: '#FFD54F', fontWeight: '700', marginBottom: 20 },
  errorSub: { fontSize: 14, color: '#FF8A80', fontWeight: '600', marginBottom: 30, textAlign: 'center' },
  endButton: { backgroundColor: '#EA4335', borderRadius: 30, paddingVertical: 14, paddingHorizontal: 40 },
  endButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  showButton: { backgroundColor: '#1a73e8', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 24, marginBottom: 12 },
  showButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  snapshotCount: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', marginBottom: 20 },
  cameraControls: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center', gap: 16 },
  captureButton: { backgroundColor: '#fff', borderRadius: 30, paddingVertical: 14, paddingHorizontal: 30 },
  captureButtonText: { fontWeight: '800', fontSize: 16, color: '#1a1a2e' },
  cancelText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
