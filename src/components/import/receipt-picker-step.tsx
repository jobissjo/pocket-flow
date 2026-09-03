import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/services/theme-context';
import { hapticImpactMedium, hapticLight } from '@/services/haptics';
import { suppressSecurityLock, resumeSecurityLock } from '@/services/security-context';

interface ReceiptPickerStepProps {
  selectedUri: string | null;
  onSelectImage: (uri: string, mimeType: string, fileName: string) => void;
  onClearImage: () => void;
  onProceedScan: () => void;
  errorMessage?: string | null;
}

export function ReceiptPickerStep({
  selectedUri,
  onSelectImage,
  onClearImage,
  onProceedScan,
  errorMessage,
}: ReceiptPickerStepProps) {
  const { isDark } = useTheme();

  const handlePickFromGallery = async () => {
    try {
      suppressSecurityLock(120000);
      hapticLight();
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Access to photos is needed to select a receipt.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = asset.fileName || `receipt_${Date.now()}.jpg`;
        const mimeType = asset.mimeType || 'image/jpeg';
        onSelectImage(asset.uri, mimeType, fileName);
      }
    } catch (err) {
      console.error('Error picking from gallery:', err);
    } finally {
      setTimeout(() => {
        resumeSecurityLock();
      }, 1500);
    }
  };

  const handleTakePhoto = async () => {
    try {
      suppressSecurityLock(120000);
      hapticLight();
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera access is required to take a receipt photo.');
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.9,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = asset.fileName || `camera_${Date.now()}.jpg`;
        const mimeType = asset.mimeType || 'image/jpeg';
        onSelectImage(asset.uri, mimeType, fileName);
      }
    } catch (err) {
      console.error('Error taking photo:', err);
    } finally {
      setTimeout(() => {
        resumeSecurityLock();
      }, 1500);
    }
  };

  return (
    <View style={styles.container}>
      {errorMessage ? (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2' },
          ]}
        >
          <Ionicons name="alert-circle" size={18} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={[styles.errorBannerText, { color: isDark ? '#FCA5A5' : '#DC2626' }]}>
            {errorMessage}
          </Text>
        </View>
      ) : null}

      {!selectedUri ? (
        <View style={styles.pickSection}>
          {/* Action Cards */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={handleTakePhoto}
              activeOpacity={0.8}
              style={[
                styles.actionCard,
                {
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF',
                  borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#BFDBFE',
                },
              ]}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.25)' : '#DBEAFE' },
                ]}
              >
                <Ionicons name="camera" size={28} color="#3B82F6" />
              </View>
              <Text style={[styles.actionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Take Photo
              </Text>
              <Text style={[styles.actionSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                Snap paper bill or receipt
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePickFromGallery}
              activeOpacity={0.8}
              style={[
                styles.actionCard,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
                  borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',
                },
              ]}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#D1FAE5' },
                ]}
              >
                <Ionicons name="images" size={28} color="#10B981" />
              </View>
              <Text style={[styles.actionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Photo Library
              </Text>
              <Text style={[styles.actionSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                UPI screenshot or image
              </Text>
            </TouchableOpacity>
          </View>

          {/* Supported Types & Instructions */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              },
            ]}
          >
            <View style={styles.infoTitleRow}>
              <Ionicons name="sparkles" size={16} color="#3B82F6" />
              <Text style={[styles.infoTitle, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                What AI Can Read Automatically
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                <Text style={{ fontWeight: '600' }}>UPI Screenshots:</Text> GPay, PhonePe, Paytm, BHIM with UTR
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                <Text style={{ fontWeight: '600' }}>Bills & Receipts:</Text> Supermarkets, restaurants, retail stores
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                <Text style={{ fontWeight: '600' }}>Auto-Matching:</Text> Matches bank accounts, credit cards & categories
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.previewSection}>
          <View
            style={[
              styles.imageCard,
              {
                backgroundColor: isDark ? '#000000' : '#F1F5F9',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#CBD5E1',
              },
            ]}
          >
            <Image
              source={{ uri: selectedUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                onClearImage();
              }}
              style={styles.removeImageBtn}
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.imageActionRow}>
            <TouchableOpacity
              onPress={handlePickFromGallery}
              style={[
                styles.retakeBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#E2E8F0',
                },
              ]}
            >
              <Ionicons name="swap-horizontal" size={16} color={isDark ? '#E2E8F0' : '#475569'} />
              <Text style={[styles.retakeBtnText, { color: isDark ? '#E2E8F0' : '#475569' }]}>
                Change Image
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                hapticImpactMedium();
                onProceedScan();
              }}
              style={styles.scanSubmitBtn}
            >
              <Ionicons name="sparkles" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.scanSubmitBtnText}>Analyze with AI</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 13,
    flex: 1,
    fontWeight: '500',
  },
  pickSection: {
    gap: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 11,
    textAlign: 'center',
  },
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletIcon: {
    marginTop: 2,
  },
  bulletText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  previewSection: {
    gap: 16,
  },
  imageCard: {
    width: '100%',
    height: 260,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  retakeBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scanSubmitBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  scanSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
