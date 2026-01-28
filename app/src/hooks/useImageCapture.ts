/**
 * Hook for capturing images from glasses or device camera
 */

import { useCallback } from 'react';
import { useAppStore } from '../services/store';
import { metaSDK } from '../services/metaSDK';
import * as ImagePicker from 'expo-image-picker';

export function useImageCapture() {
  const {
    capturedImage,
    isCapturing,
    setCapturedImage,
    setIsCapturing,
    setScanError,
  } = useAppStore((state) => ({
    capturedImage: state.capturedImage,
    isCapturing: state.isCapturing,
    setCapturedImage: state.setCapturedImage,
    setIsCapturing: state.setIsCapturing,
    setScanError: state.setScanError,
  }));

  // Capture from Meta glasses
  const captureFromGlasses = useCallback(async () => {
    if (!metaSDK.isConnected()) {
      setScanError('Glasses not connected');
      return null;
    }

    setIsCapturing(true);
    setScanError(null);

    try {
      const imageUri = await metaSDK.capturePhoto();
      setCapturedImage(imageUri);
      return imageUri;
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : 'Failed to capture photo'
      );
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [setCapturedImage, setIsCapturing, setScanError]);

  // Capture from device camera
  const captureFromCamera = useCallback(async () => {
    setIsCapturing(true);
    setScanError(null);

    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setScanError('Camera permission not granted');
        return null;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        return null;
      }

      const imageUri = result.assets[0].uri;
      setCapturedImage(imageUri);
      return imageUri;
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : 'Failed to capture photo'
      );
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [setCapturedImage, setIsCapturing, setScanError]);

  // Pick image from gallery
  const pickFromGallery = useCallback(async () => {
    setIsCapturing(true);
    setScanError(null);

    try {
      // Request media library permissions
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setScanError('Gallery permission not granted');
        return null;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        return null;
      }

      const imageUri = result.assets[0].uri;
      setCapturedImage(imageUri);
      return imageUri;
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : 'Failed to pick image'
      );
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [setCapturedImage, setIsCapturing, setScanError]);

  // Clear captured image
  const clearImage = useCallback(() => {
    setCapturedImage(null);
    setScanError(null);
  }, [setCapturedImage, setScanError]);

  return {
    capturedImage,
    isCapturing,
    captureFromGlasses,
    captureFromCamera,
    pickFromGallery,
    clearImage,
  };
}
