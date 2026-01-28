/**
 * Hook for managing Meta glasses connection
 */

import { useEffect, useCallback } from 'react';
import { useAppStore } from '../services/store';
import { metaSDK, type GlassesEvent } from '../services/metaSDK';
import type { GlassesDevice } from '../types';

export function useGlassesConnection() {
  const {
    connectionState,
    device,
    error,
    setConnectionState,
    setDevice,
    setError,
  } = useAppStore();

  // Set up event listeners
  useEffect(() => {
    const handleConnectionChange = (event: GlassesEvent) => {
      const { state } = event.data as { state: string };
      setConnectionState(state as typeof connectionState);
    };

    const handleDeviceDiscovered = (event: GlassesEvent) => {
      const { device: discoveredDevice } = event.data as {
        device: GlassesDevice;
      };
      // Auto-connect to first discovered device
      metaSDK.connect(discoveredDevice).catch((err) => {
        setError(err.message);
        setConnectionState('error');
      });
    };

    const handleError = (event: GlassesEvent) => {
      const { message } = event.data as { message: string };
      setError(message);
      setConnectionState('error');
    };

    metaSDK.addEventListener('connectionStateChanged', handleConnectionChange);
    metaSDK.addEventListener('deviceDiscovered', handleDeviceDiscovered);
    metaSDK.addEventListener('error', handleError);

    return () => {
      metaSDK.removeEventListener(
        'connectionStateChanged',
        handleConnectionChange
      );
      metaSDK.removeEventListener('deviceDiscovered', handleDeviceDiscovered);
      metaSDK.removeEventListener('error', handleError);
    };
  }, [setConnectionState, setDevice, setError]);

  // Update device when connected
  useEffect(() => {
    if (connectionState === 'connected') {
      setDevice(metaSDK.getConnectedDevice());
    } else if (connectionState === 'disconnected') {
      setDevice(null);
    }
  }, [connectionState, setDevice]);

  const startScanning = useCallback(async () => {
    setError(null);
    try {
      await metaSDK.startScanning();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scanning');
      setConnectionState('error');
    }
  }, [setError, setConnectionState]);

  const stopScanning = useCallback(async () => {
    try {
      await metaSDK.stopScanning();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop scanning');
    }
  }, [setError]);

  const connect = useCallback(
    async (targetDevice: GlassesDevice) => {
      setError(null);
      try {
        await metaSDK.connect(targetDevice);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect');
        setConnectionState('error');
      }
    },
    [setError, setConnectionState]
  );

  const disconnect = useCallback(async () => {
    try {
      await metaSDK.disconnect();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }, [setError]);

  return {
    connectionState,
    device,
    error,
    isConnected: connectionState === 'connected',
    isScanning: connectionState === 'scanning',
    isConnecting: connectionState === 'connecting',
    isMockDevice: metaSDK.isMockDevice(),
    startScanning,
    stopScanning,
    connect,
    disconnect,
  };
}
