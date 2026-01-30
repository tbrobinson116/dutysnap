/**
 * Zustand Store for DutySnap App State
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type {
  GlassesConnectionState,
  GlassesDevice,
  ComparisonResult,
} from '../types';

// Glasses state slice
interface GlassesSlice {
  connectionState: GlassesConnectionState;
  device: GlassesDevice | null;
  error: string | null;
  isCapturing: boolean;
  setConnectionState: (state: GlassesConnectionState) => void;
  setDevice: (device: GlassesDevice | null) => void;
  setError: (error: string | null) => void;
  setIsCapturing: (isCapturing: boolean) => void;
  reset: () => void;
}

// Scan state slice
interface ScanSlice {
  capturedImage: string | null;
  isProcessing: boolean;
  currentResult: ComparisonResult | null;
  error: string | null;
  shipToCountry: string;
  setCapturedImage: (image: string | null) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setCurrentResult: (result: ComparisonResult | null) => void;
  setScanError: (error: string | null) => void;
  setShipToCountry: (country: string) => void;
  resetScan: () => void;
}

// History state slice
interface HistorySlice {
  results: ComparisonResult[];
  addResult: (result: ComparisonResult) => void;
  clearHistory: () => void;
}

// Combined store type
type AppStore = GlassesSlice & ScanSlice & HistorySlice;

export const useAppStore = create<AppStore>((set) => ({
  // Glasses state
  connectionState: 'disconnected',
  device: null,
  error: null,
  isCapturing: false,

  setConnectionState: (connectionState) => set({ connectionState }),
  setDevice: (device) => set({ device }),
  setError: (error) => set({ error }),
  setIsCapturing: (isCapturing) => set({ isCapturing }),
  reset: () =>
    set({
      connectionState: 'disconnected',
      device: null,
      error: null,
      isCapturing: false,
    }),

  // Scan state
  capturedImage: null,
  isProcessing: false,
  currentResult: null,
  shipToCountry: 'US',

  setCapturedImage: (capturedImage) => set({ capturedImage }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setCurrentResult: (currentResult) => set({ currentResult }),
  setScanError: (error) => set({ error }),
  setShipToCountry: (shipToCountry) => set({ shipToCountry }),
  resetScan: () =>
    set({
      capturedImage: null,
      isProcessing: false,
      currentResult: null,
      error: null,
    }),

  // History state
  results: [],
  addResult: (result) =>
    set((state) => ({ results: [result, ...state.results] })),
  clearHistory: () => set({ results: [] }),
}));

// Selectors for convenience (useShallow prevents infinite re-renders with React 19)
export const useGlassesState = () =>
  useAppStore(
    useShallow((state) => ({
      connectionState: state.connectionState,
      device: state.device,
      error: state.error,
      isCapturing: state.isCapturing,
    }))
  );

export const useScanState = () =>
  useAppStore(
    useShallow((state) => ({
      capturedImage: state.capturedImage,
      isProcessing: state.isProcessing,
      currentResult: state.currentResult,
      error: state.error,
    }))
  );

export const useHistoryState = () =>
  useAppStore(
    useShallow((state) => ({
      results: state.results,
    }))
  );
