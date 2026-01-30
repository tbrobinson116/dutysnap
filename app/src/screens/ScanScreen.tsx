/**
 * Scan Screen - Capture and classify products
 */

import React, { useState, useCallback } from 'react';
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
import { useShallow } from 'zustand/react/shallow';
import {
  useGlassesConnection,
  useImageCapture,
  useClassification,
} from '../hooks';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import { useAppStore } from '../services/store';
import type { RootStackParamList } from '../types';
import type { VoiceMode } from '../types/voice';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Scan'>;

function VoiceIndicator({
  mode,
  transcript,
  onTap,
}: {
  mode: VoiceMode;
  transcript: string;
  onTap: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.voiceIndicator,
        mode === 'active_listening' && styles.voiceIndicatorActive,
      ]}
      onPress={onTap}
      activeOpacity={0.7}
    >
      <View style={styles.voiceIndicatorRow}>
        {mode === 'idle' && (
          <>
            <View style={[styles.micDot, styles.micDotIdle]} />
            <Text style={styles.voiceHint}>Tap to speak a command</Text>
          </>
        )}
        {mode === 'active_listening' && (
          <>
            <View style={[styles.micDot, styles.micDotActive]} />
            <Text style={styles.voiceActiveText} numberOfLines={1}>
              {transcript || 'Listening...'}
            </Text>
          </>
        )}
        {mode === 'processing' && (
          <>
            <ActivityIndicator size="small" color="#1976D2" />
            <Text style={styles.voiceHint}>Processing...</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

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

  const { shipToCountry, setShipToCountry } = useAppStore(
    useShallow((state) => ({
      shipToCountry: state.shipToCountry,
      setShipToCountry: state.setShipToCountry,
    }))
  );

  // Optional product details
  const [productName, setProductName] = useState('');
  const [productValue, setProductValue] = useState('');
  const [originCountry, setOriginCountry] = useState('');

  // Debug input for simulating voice commands in dev mode
  const [debugVoiceInput, setDebugVoiceInput] = useState('');

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
      shipToCountry: shipToCountry || undefined,
    });

    if (result) {
      navigation.navigate('Results', { comparisonId: result.id });
    }
  };

  // Voice command callbacks
  const onVoiceCapture = useCallback(() => {
    handleCapture('glasses');
  }, []);

  const onVoiceSetOrigin = useCallback((code: string) => {
    setOriginCountry(code);
  }, []);

  const onVoiceSetDestination = useCallback((code: string) => {
    setShipToCountry(code);
  }, [setShipToCountry]);

  const onVoiceSetProductInfo = useCallback(
    (name: string, value?: number, _currency?: string) => {
      setProductName(name);
      if (value !== undefined) {
        setProductValue(String(value));
      }
    },
    [],
  );

  const onVoiceNavigate = useCallback(
    (destination: 'back' | 'history' | 'home') => {
      switch (destination) {
        case 'back':
          navigation.goBack();
          break;
        case 'history':
          navigation.navigate('History');
          break;
        case 'home':
          navigation.navigate('Home');
          break;
      }
    },
    [navigation],
  );

  const {
    mode: voiceMode,
    transcript: voiceTranscript,
    activate: activateVoice,
    simulateCommand,
  } = useVoiceCommands({
    onCapture: onVoiceCapture,
    onSetOriginCountry: onVoiceSetOrigin,
    onSetDestinationCountry: onVoiceSetDestination,
    onSetProductInfo: onVoiceSetProductInfo,
    onNavigate: onVoiceNavigate,
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Voice Indicator */}
          <VoiceIndicator
            mode={voiceMode}
            transcript={voiceTranscript}
            onTap={activateVoice}
          />

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

          {/* Details Section */}
          {capturedImage && (
            <View style={styles.detailsSection}>
              {/* Ship To - the key input */}
              <View style={styles.shipToRow}>
                <Text style={styles.shipToLabel}>Ship to</Text>
                <TextInput
                  style={styles.shipToInput}
                  placeholder="US"
                  value={shipToCountry}
                  onChangeText={(text) => setShipToCountry(text.toUpperCase())}
                  maxLength={2}
                  autoCapitalize="characters"
                  selectTextOnFocus
                />
              </View>

              {/* Optional fields in a compact layout */}
              <View style={styles.optionalFields}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Product name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Leather handbag"
                    value={productName}
                    onChangeText={setProductName}
                  />
                </View>

                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Origin</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., CN"
                      value={originCountry}
                      onChangeText={(text) =>
                        setOriginCountry(text.toUpperCase())
                      }
                      maxLength={2}
                      autoCapitalize="characters"
                    />
                  </View>

                  <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                    <Text style={styles.inputLabel}>Value (EUR)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Auto-estimated"
                      value={productValue}
                      onChangeText={setProductValue}
                      keyboardType="decimal-pad"
                    />
                  </View>
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
                    Classify & Calculate Duty
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

          {/* DEV: Voice command simulator */}
          {__DEV__ && (
            <View style={styles.debugPanel}>
              <Text style={styles.debugLabel}>Voice Debug</Text>
              <View style={styles.debugRow}>
                <TextInput
                  style={styles.debugInput}
                  placeholder='e.g., "snap" or "ship to France"'
                  value={debugVoiceInput}
                  onChangeText={setDebugVoiceInput}
                  onSubmitEditing={() => {
                    if (debugVoiceInput.trim()) {
                      simulateCommand(debugVoiceInput.trim());
                      setDebugVoiceInput('');
                    }
                  }}
                  returnKeyType="send"
                />
                <TouchableOpacity
                  style={styles.debugSendButton}
                  onPress={() => {
                    if (debugVoiceInput.trim()) {
                      simulateCommand(debugVoiceInput.trim());
                      setDebugVoiceInput('');
                    }
                  }}
                >
                  <Text style={styles.debugSendText}>Send</Text>
                </TouchableOpacity>
              </View>
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
  // Voice indicator styles
  voiceIndicator: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
  },
  voiceIndicatorActive: {
    backgroundColor: '#FFEBEE',
  },
  voiceIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  micDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  micDotIdle: {
    backgroundColor: '#90CAF9',
  },
  micDotActive: {
    backgroundColor: '#F44336',
  },
  voiceHint: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  voiceActiveText: {
    flex: 1,
    fontSize: 14,
    color: '#F44336',
    fontWeight: '600',
  },
  // Existing styles
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
    marginTop: 20,
  },
  shipToRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  shipToLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 12,
  },
  shipToInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1976D2',
    textAlign: 'right',
    padding: 0,
  },
  optionalFields: {
    marginBottom: 4,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
  },
  inputLabel: {
    fontSize: 13,
    color: '#888',
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
    marginTop: 4,
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
  // Debug panel styles
  debugPanel: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  debugLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 8,
  },
  debugRow: {
    flexDirection: 'row',
    gap: 8,
  },
  debugInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  debugSendButton: {
    backgroundColor: '#FF9800',
    borderRadius: 6,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  debugSendText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
