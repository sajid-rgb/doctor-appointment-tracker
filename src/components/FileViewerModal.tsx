import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { UploadedPrescriptionFile } from '../store/appointmentStore';

interface FileViewerModalProps {
  visible: boolean;
  file: UploadedPrescriptionFile | null;
  onClose: () => void;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileViewerModal({ visible, file, onClose }: FileViewerModalProps) {
  const [opening, setOpening] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!file) return null;

  const isImage =
    file.mimeType?.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);

  const handleOpenFileExternally = async () => {
    if (!file?.uri) return;

    try {
      setOpening(true);

      // Web platform handling
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.open(file.uri, '_blank');
        }
        return;
      }

      // Native platform sharing / opening
      const isAvailable = await Sharing.isAvailableAsync().catch(() => false);
      if (isAvailable) {
        await Sharing.shareAsync(file.uri, {
          mimeType: file.mimeType || (isImage ? 'image/jpeg' : 'application/pdf'),
          dialogTitle: `Open ${file.name}`,
          UTI: isImage ? 'public.image' : 'com.adobe.pdf',
        });
        return;
      }

      // Fallback: WebBrowser or Linking
      if (file.uri.startsWith('http://') || file.uri.startsWith('https://')) {
        await WebBrowser.openBrowserAsync(file.uri);
      } else {
        const canOpen = await Linking.canOpenURL(file.uri).catch(() => false);
        if (canOpen) {
          await Linking.openURL(file.uri);
        } else {
          Alert.alert(
            'Cannot Open File',
            `Your device does not have an app registered to open this file:\n${file.name}`
          );
        }
      }
    } catch (err: any) {
      console.warn('Error opening file:', err);
      Alert.alert(
        'Open File Error',
        `Could not open ${file.name}. Please ensure a compatible viewer (e.g. PDF viewer or Gallery) is installed.`
      );
    } finally {
      setOpening(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Ionicons
                  name={isImage ? 'image-outline' : 'document-text-outline'}
                  size={20}
                  color="#0F766E"
                />
              </View>
              <View style={styles.headerTexts}>
                <Text style={styles.title} numberOfLines={1}>
                  {file.name}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaBadge}>
                    {isImage ? 'IMAGE' : 'DOCUMENT'}
                  </Text>
                  {file.size ? (
                    <Text style={styles.metaSize}>{formatFileSize(file.size)}</Text>
                  ) : null}
                </View>
              </View>
            </View>

            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color="#64748B" />
            </Pressable>
          </View>

          {/* Content Preview Area */}
          <View style={styles.previewArea}>
            {isImage && !imageError ? (
              <View style={styles.imageWrapper}>
                <Image
                  source={{ uri: file.uri }}
                  style={styles.imagePreview}
                  contentFit="contain"
                  transition={200}
                  onError={() => setImageError(true)}
                />
              </View>
            ) : (
              <View style={styles.docPlaceholder}>
                <View style={styles.docIconLarge}>
                  <Ionicons
                    name={isImage ? 'image-outline' : 'document-attach'}
                    size={52}
                    color="#0F766E"
                  />
                </View>
                <Text style={styles.docName} numberOfLines={2}>
                  {file.name}
                </Text>
                <Text style={styles.docHint}>
                  {isImage
                    ? 'Image attached by patient. Tap "Open File" to view full resolution.'
                    : 'Medical report / Prescription PDF document attached by patient.'}
                </Text>
              </View>
            )}
          </View>

          {/* Action Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.openButton}
              onPress={handleOpenFileExternally}
              disabled={opening}
            >
              {opening ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="open-outline" size={18} color="#FFFFFF" />
              )}
              <Text style={styles.openButtonText}>
                {opening ? 'Opening...' : 'Open File in App / Viewer'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.doneButton}
              onPress={onClose}
            >
              <Text style={styles.doneButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTexts: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  metaBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0F766E',
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  metaSize: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewArea: {
    height: 320,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  docPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  docIconLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  docName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  docHint: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 17,
  },
  footer: {
    padding: 16,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F766E',
    paddingVertical: 12,
    borderRadius: 12,
  },
  openButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  doneButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  doneButtonText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
});
