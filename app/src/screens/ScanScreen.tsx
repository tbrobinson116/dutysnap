/**
 * Scan Screen - Capture and classify products
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGlassesConnection,
  useImageCapture,
  useClassification,
} from '../hooks';
import type { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Scan'>;

export function ScanScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { isConnected } = useGlassesConnection();
  const {
    capturedImage,
    isCapturing,
    captureFromGlasses,
    captureFromCamera,
    pickFromGallery,
    clearImage,
  } = useImageCapture();
  const { isProcessing, classifyImage, error } = useClassification();

  // Optional product details
  const [productName, setProductName] = useState('');
  const [productValue, setProductValue] = useState('');
  const [originCountry, setOriginCountry] = useState('');

  const handleCapture = async (method: 'glasses' | 'camera' | 'gallery') => {
    let imageUri: string | null = null;

    switch (method) {
      case 'glasses':
        imageUri = await captureFromGlasses();
        break;
      case 'camera':
        imageUri = await captureFromCamera();
        break;
      case 'gallery':
        imageUri = await pickFromGallery();
        break;
    }

    return imageUri;
  };

  const handleClassify = async () => {
    if (!capturedImage) return;

    const result = await classifyImage(capturedImage, {
      productName: productName || undefined,
      productValue: productValue ? parseFloat(productValue) : undefined,
      originCountry: originCountry || undefined,
    });

    if (result) {
      navigation.navigate('Results', { comparisonId: result.id });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Image Preview */}
          <View style={styles.imageContainer}>
            {capturedImage ? (
              <>
                <Image
                  source={{ uri: capturedImage }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={clearImage}
                >
                  <Text style={styles.clearButtonText}>✕</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderIcon}>📷</Text>
                <Text style={styles.placeholderText}>
                  Capture or select a product image
                </Text>
              </View>
            )}
          </View>

          {/* Capture Buttons */}
          {!capturedImage && (
            <View style={styles.captureButtons}>
              {isConnected && (
                <TouchableOpacity
                  style={[styles.captureButton, styles.glassesButton]}
                  onPress={() => handleCapture('glasses')}
                  disabled={isCapturing}
                >
                  <Text style={styles.captureButtonIcon}>🕶️</Text>
                  <Text style={styles.captureButtonText}>Use Glasses</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.captureButton}
                onPress={() => handleCapture('camera')}
                disabled={isCapturing}
              >
                <Text style={styles.captureButtonIcon}>📸</Text>
                <Text style={styles.captureButtonText}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.captureButton}
                onPress={() => handleCapture('gallery')}
                disabled={isCapturing}
              >
                <Text style={styles.captureButtonIcon}>🖼️</Text>
                <Text style={styles.captureButtonText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}

          {isCapturing && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1976D2" />
              <Text style={styles.loadingText}>Capturing...</Text>
            </View>
          )}

          {/* Optional Details */}
          {capturedImage && (
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Product Details (Optional)</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Product Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Leather handbag"
                  value={productName}
                  onChangeText={setProductName}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Value (EUR)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 250"
                    value={productValue}
                    onChangeText={setProductValue}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.inputLabel}>Origin Country</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., IT"
                    value={originCountry}
                    onChangeText={setOriginCountry}
                    maxLength={2}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              {/* Classify Button */}
              <TouchableOpacity
                style={[
                  styles.classifyButton,
                  isProcessing && styles.classifyButtonDisabled,
                ]}
                onPress={handleClassify}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.classifyButtonText}>Classifying...</Text>
                  </>
                ) : (
                  <Text style={styles.classifyButtonText}>
                    🔍 Classify Product
                  </Text>
                )}
              </TouchableOpacity>

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
  },
  imageContainer: {
    aspectRatio: 4 / 3,
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  clearButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 16,
    color: '#666',
  },
  captureButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  captureButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  glassesButton: {
    backgroundColor: '#E3F2FD',
  },
  captureButtonIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  captureButtonText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
  },
  detailsSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
  },
  inputLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  classifyButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 8,
  },
  classifyButtonDisabled: {
    backgroundColor: '#90CAF9',
  },
  classifyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
  },
});
