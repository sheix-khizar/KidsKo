import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export type ProcessedImage = {
  uri: string;
  base64: string;
};

export async function requestMediaPermissions(): Promise<boolean> {
  const mediaPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return mediaPerm.granted;
}

export async function requestCameraPermissions(): Promise<boolean> {
  const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
  return cameraPerm.granted;
}

export async function processAndCompressImage(uri: string): Promise<ProcessedImage> {
  const manipResult = await manipulateAsync(
    uri,
    [{ resize: { width: 768 } }],
    { compress: 0.6, format: SaveFormat.JPEG, base64: true }
  );

  if (!manipResult.base64) {
    throw new Error('Could not encode compressed image.');
  }

  return {
    uri: manipResult.uri,
    base64: manipResult.base64,
  };
}

export async function pickImageFromGallery(): Promise<ProcessedImage | null> {
  const hasPerm = await requestMediaPermissions();
  if (!hasPerm) {
    throw new Error('Photo library permission denied.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.7,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return null;
  }

  const asset = result.assets[0];

  if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
    throw new Error('Image file is too large (max 10MB). Please select a smaller photo.');
  }

  return processAndCompressImage(asset.uri);
}

export async function captureImageFromCamera(): Promise<ProcessedImage | null> {
  const hasPerm = await requestCameraPermissions();
  if (!hasPerm) {
    throw new Error('Camera permission denied.');
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.7,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return null;
  }

  return processAndCompressImage(result.assets[0].uri);
}
