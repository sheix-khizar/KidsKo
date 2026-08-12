import { useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Image, ScrollView } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { analyzeHomework } from '../services/homework';
import { pickImageFromGallery, processAndCompressImage } from '../utils/imageHelper';

type Props = {
  studentId: string;
  studentName: string;
  onBack: () => void;
  onScanSuccess: (threadId: string, initialReply: string) => void;
  onLimitReached?: () => void;
};

export default function HomeworkScreen({ studentId, studentName, onBack, onScanSuccess, onLimitReached }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [resultThreadId, setResultThreadId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cameraRef = useRef<any>(null);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Camera & Photo Permission Needed 📷</Text>
        <Text style={styles.subtitle}>
          Kidsko needs camera and photo access so your child can scan or upload homework worksheets.
        </Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </Pressable>
        <Pressable onPress={onBack} style={{ marginTop: 20 }}>
          <Text style={styles.link}>← Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const handleSnap = async () => {
    if (!cameraRef.current || analyzing) return;
    try {
      setErrorMsg(null);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) return;

      setPhotoUri(photo.uri);
      setAnalyzing(true);

      const processed = await processAndCompressImage(photo.uri);
      const res = await analyzeHomework(studentId, processed.base64);
      setExplanation(res.explanation);
      setResultThreadId(res.threadId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not scan photo.');
      setPhotoUri(null);
      if (err.status === 429 && onLimitReached) {
        onLimitReached();
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePickGallery = async () => {
    if (analyzing) return;
    try {
      setErrorMsg(null);
      const picked = await pickImageFromGallery();
      if (!picked) return;

      setPhotoUri(picked.uri);
      setAnalyzing(true);

      const res = await analyzeHomework(studentId, picked.base64);
      setExplanation(res.explanation);
      setResultThreadId(res.threadId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not process gallery image.');
      setPhotoUri(null);
      if (err.status === 429 && onLimitReached) {
        onLimitReached();
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRetake = () => {
    setPhotoUri(null);
    setExplanation(null);
    setResultThreadId(null);
    setErrorMsg(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Scan Homework 📸</Text>
        <Text style={styles.headerSubtitle}>{studentName}</Text>
      </View>

      {errorMsg && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <Pressable onPress={handleRetake} style={styles.retakeSmall}>
            <Text style={styles.retakeSmallText}>Try Again</Text>
          </Pressable>
        </View>
      )}

      {!photoUri ? (
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} facing={facing} ref={cameraRef} />
          <View style={styles.cameraOverlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.cameraHint}>Align worksheet inside the box or pick from gallery</Text>
          </View>
          <View style={styles.controls}>
            <Pressable
              style={styles.flipButton}
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            >
              <Text style={styles.flipText}>🔄 Flip</Text>
            </Pressable>
            <Pressable style={styles.snapButtonOuter} onPress={handleSnap}>
              <View style={styles.snapButtonInner} />
            </Pressable>
            <Pressable style={styles.galleryButton} onPress={handlePickGallery}>
              <Text style={styles.galleryText}>🖼️ Gallery</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView style={styles.previewContainer} contentContainerStyle={{ padding: 20 }}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} />

          {analyzing ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#1a73e8" />
              <Text style={styles.loadingTitle}>Kidsko is reading the worksheet... 🦉</Text>
              <Text style={styles.loadingSub}>Identifying questions and concept steps.</Text>
            </View>
          ) : explanation ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>Kidsko's Explanation 🦉</Text>
              <Text style={styles.resultText}>{explanation}</Text>

              <Pressable
                style={styles.chatButton}
                onPress={() => {
                  if (resultThreadId && explanation) {
                    onScanSuccess(resultThreadId, explanation);
                  }
                }}
              >
                <Text style={styles.chatButtonText}>Ask follow-up in Chat 💬 →</Text>
              </Pressable>

              <Pressable style={styles.retakeButton} onPress={handleRetake}>
                <Text style={styles.retakeText}>← Scan / Select Another Page</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f7f9fc' },
  title: { fontSize: 22, fontWeight: '800', color: '#111', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  button: { backgroundColor: '#1a73e8', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { color: '#1a73e8', fontWeight: '700', fontSize: 15 },
  header: {
    paddingTop: 55,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: { color: '#1a73e8', fontWeight: '700', marginBottom: 6 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111' },
  headerSubtitle: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlay: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    bottom: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  scanFrame: {
    width: '85%',
    height: '60%',
    borderWidth: 2,
    borderColor: '#FFD54F',
    borderRadius: 20,
    borderStyle: 'dashed',
  },
  cameraHint: { color: '#fff', fontWeight: '700', marginTop: 16, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#000',
  },
  flipButton: { padding: 12 },
  flipText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  galleryButton: { padding: 12 },
  galleryText: { color: '#FFD54F', fontWeight: '700', fontSize: 14 },
  snapButtonOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  snapButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFD54F',
  },
  previewContainer: { flex: 1, backgroundColor: '#f7f9fc' },
  previewImage: { width: '100%', height: 350, borderRadius: 16, backgroundColor: '#ccc', marginBottom: 20 },
  loadingCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  loadingTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginTop: 8 },
  loadingSub: { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  resultCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  resultTitle: { fontSize: 18, fontWeight: '800', color: '#1a73e8', marginBottom: 12 },
  resultText: { fontSize: 15, color: '#111', lineHeight: 22, marginBottom: 20 },
  chatButton: { backgroundColor: '#1a73e8', borderRadius: 14, padding: 15, alignItems: 'center', marginBottom: 12 },
  chatButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  retakeButton: { padding: 14, alignItems: 'center' },
  retakeText: { color: '#6b7280', fontWeight: '700', fontSize: 14 },
  errorBox: { backgroundColor: '#FEE2E2', padding: 12, margin: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  errorText: { color: '#B91C1C', flex: 1, fontSize: 13, fontWeight: '600' },
  retakeSmall: { backgroundColor: '#B91C1C', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  retakeSmallText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
