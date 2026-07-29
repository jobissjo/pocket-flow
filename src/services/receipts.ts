import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

const RECEIPTS_DIR = `${FileSystem.documentDirectory}receipts/`;

/**
 * Ensure receipts storage directory exists
 */
async function ensureDirectoryExists() {
  if (Platform.OS === 'web') return;
  try {
    const dirInfo = await FileSystem.getInfoAsync(RECEIPTS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(RECEIPTS_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error('Error creating receipts directory:', error);
  }
}

/**
 * Save picked image to local app storage
 */
export async function saveReceiptImage(sourceUri: string): Promise<string> {
  if (Platform.OS === 'web') return sourceUri;

  try {
    await ensureDirectoryExists();
    const filename = `receipt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.jpg`;
    const destinationUri = `${RECEIPTS_DIR}${filename}`;

    await FileSystem.copyAsync({
      from: sourceUri,
      to: destinationUri,
    });

    return destinationUri;
  } catch (error) {
    console.error('Error saving receipt image:', error);
    return sourceUri;
  }
}

/**
 * Pick receipt photo from gallery
 */
export async function pickReceiptFromGallery(): Promise<string | null> {
  try {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access photo gallery is required!');
        return null;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const savedUri = await saveReceiptImage(result.assets[0].uri);
      return savedUri;
    }
    return null;
  } catch (error) {
    console.error('Error picking receipt from gallery:', error);
    return null;
  }
}

/**
 * Take receipt photo using camera
 */
export async function takeReceiptPhotoFromCamera(): Promise<string | null> {
  try {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access camera is required!');
        return null;
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const savedUri = await saveReceiptImage(result.assets[0].uri);
      return savedUri;
    }
    return null;
  } catch (error) {
    console.error('Error taking receipt photo:', error);
    return null;
  }
}
