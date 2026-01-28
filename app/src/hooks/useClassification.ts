/**
 * Hook for running product classification
 */

import { useCallback } from 'react';
import { useAppStore } from '../services/store';
import { api } from '../services/api';

interface ClassifyOptions {
  productName?: string;
  productDescription?: string;
  productValue?: number;
  originCountry?: string;
}

export function useClassification() {
  const {
    isProcessing,
    currentResult,
    error,
    setIsProcessing,
    setCurrentResult,
    setScanError,
    addResult,
  } = useAppStore((state) => ({
    isProcessing: state.isProcessing,
    currentResult: state.currentResult,
    error: state.error,
    setIsProcessing: state.setIsProcessing,
    setCurrentResult: state.setCurrentResult,
    setScanError: state.setScanError,
    addResult: state.addResult,
  }));

  // Run classification on an image
  const classifyImage = useCallback(
    async (imageUri: string, options: ClassifyOptions = {}) => {
      setIsProcessing(true);
      setScanError(null);

      try {
        const result = await api.classifyImage(imageUri, {
          productName: options.productName,
          productDescription: options.productDescription,
          productValue: options.productValue,
          originCountry: options.originCountry,
          calculateDuty: options.productValue !== undefined,
        });

        // Add image URI to result for display
        const resultWithImage = {
          ...result,
          imageUri,
        };

        setCurrentResult(resultWithImage);
        addResult(resultWithImage);

        return resultWithImage;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Classification failed';
        setScanError(message);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [setIsProcessing, setCurrentResult, setScanError, addResult]
  );

  // Run classification with text only (no image)
  const classifyByDescription = useCallback(
    async (
      productName: string,
      productDescription: string,
      options: Omit<ClassifyOptions, 'productName' | 'productDescription'> = {}
    ) => {
      setIsProcessing(true);
      setScanError(null);

      try {
        const result = await api.classify({
          productName,
          productDescription,
          productValue: options.productValue,
          originCountry: options.originCountry,
          calculateDuty: options.productValue !== undefined,
        });

        setCurrentResult(result);
        addResult(result);

        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Classification failed';
        setScanError(message);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [setIsProcessing, setCurrentResult, setScanError, addResult]
  );

  // Clear current result
  const clearResult = useCallback(() => {
    setCurrentResult(null);
    setScanError(null);
  }, [setCurrentResult, setScanError]);

  return {
    isProcessing,
    currentResult,
    error,
    classifyImage,
    classifyByDescription,
    clearResult,
  };
}
