import { useState, useCallback } from 'react';
import { Alert } from 'react-native';

// Safely import expo-speech-recognition without crashing in standard Expo Go or clean APKs
let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: any = (event: string, callback: any) => {};

try {
  const speechRec = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = speechRec.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = speechRec.useSpeechRecognitionEvent;
} catch (e) {
  console.log('expo-speech-recognition native module not available in standard Expo Go.');
}

export function useVoiceInput(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);

  if (useSpeechRecognitionEvent && ExpoSpeechRecognitionModule) {
    useSpeechRecognitionEvent('result', (event: any) => {
      const transcript = event.results?.[0]?.transcript;
      if (transcript) onResult(transcript);
    });
    useSpeechRecognitionEvent('end', () => setListening(false));
    useSpeechRecognitionEvent('error', () => setListening(false));
  }

  const startListening = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule) {
      Alert.alert(
        'Dev Client Required for Mic 🎙️',
        'Speech recognition requires the custom Dev Client APK. However, Kidsko Text-to-Speech (🔊 Read Aloud) is fully active and ready to test in Expo Go right now!'
      );
      return;
    }

    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) return;

      setListening(true);
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: false,
        continuous: false,
      });
    } catch (err: any) {
      Alert.alert('Speech Error', err.message);
      setListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (ExpoSpeechRecognitionModule) {
      ExpoSpeechRecognitionModule.stop();
    }
    setListening(false);
  }, []);

  return { listening, startListening, stopListening };
}
