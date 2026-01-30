/**
 * Meta Wearables SDK Service
 *
 * This service provides an abstraction layer for the Meta Wearables Device Access Toolkit.
 * It supports both real glasses (via the native MetaGlasses Expo module) and a mock
 * implementation for development without hardware.
 *
 * Real SDK integration requires:
 * - iOS: meta-wearables-dat-ios SPM package (added via expo config plugin)
 * - A custom dev build (expo-dev-client)
 */

import type { GlassesDevice, GlassesConnectionState } from '../types';
import * as MetaGlasses from '../../modules/meta-glasses';
import type { Subscription } from 'expo-modules-core';

// Event types for glasses events
export type GlassesEventType =
  | 'connectionStateChanged'
  | 'deviceDiscovered'
  | 'photoCaptured'
  | 'batteryChanged'
  | 'error';

export interface GlassesEvent {
  type: GlassesEventType;
  data?: unknown;
}

type EventListener = (event: GlassesEvent) => void;

class MetaSDKService {
  private listeners: Map<GlassesEventType, Set<EventListener>> = new Map();
  private connectionState: GlassesConnectionState = 'disconnected';
  private connectedDevice: GlassesDevice | null = null;
  private useMockDevice: boolean;
  private nativeSubscriptions: Subscription[] = [];

  constructor() {
    // Fall back to mock when the native SDK isn't compiled in.
    // isAvailable = native module linked (dev client).
    // isSDKAvailable() = Meta DAT SDK actually present (SPM package).
    const sdkReady = MetaGlasses.isAvailable && MetaGlasses.isSDKAvailable();
    this.useMockDevice = !sdkReady;
    console.log(`[MetaSDK] Native module linked: ${MetaGlasses.isAvailable}, SDK compiled: ${sdkReady}, mock: ${this.useMockDevice}`);

    // Initialize event listener maps
    const eventTypes: GlassesEventType[] = [
      'connectionStateChanged',
      'deviceDiscovered',
      'photoCaptured',
      'batteryChanged',
      'error',
    ];
    eventTypes.forEach((type) => this.listeners.set(type, new Set()));

    // Subscribe to native events when available
    if (!this.useMockDevice) {
      this.subscribeToNativeEvents();

      // Sync current native state (handles JS hot-reload while native is still connected)
      const nativeState = MetaGlasses.getConnectionState() as GlassesConnectionState;
      if (nativeState && nativeState !== 'disconnected') {
        console.log(`[MetaSDK] Syncing native state on startup: ${nativeState}`);
        this.connectionState = nativeState;
        if (nativeState === 'connected') {
          this.connectedDevice = {
            id: 'native-device',
            name: 'Ray-Ban Meta',
            model: 'ray-ban-meta-gen2',
          };
        }
        // Emit so the store picks it up
        setTimeout(() => {
          this.emit('connectionStateChanged', { state: nativeState });
        }, 100);
      }
    }

    // Always subscribe to debug events if native module is available
    if (MetaGlasses.isAvailable) {
      MetaGlasses.addDebugListener((event) => {
        console.log('[MetaGlasses Native]', event.message);
      });
    }
  }

  // ── Native event bridge ──

  private subscribeToNativeEvents(): void {
    this.nativeSubscriptions.push(
      MetaGlasses.addConnectionStateListener((event) => {
        const state = event.state as GlassesConnectionState;
        this.connectionState = state;
        this.emit('connectionStateChanged', { state });

        if (state === 'connected') {
          // Populate a basic device record when connected through native.
          // Don't emit 'deviceDiscovered' — the hook auto-calls connect()
          // on discovered devices, which would reset state back to 'connecting'.
          this.connectedDevice = {
            id: 'native-device',
            name: 'Ray-Ban Meta',
            model: 'ray-ban-meta-gen2',
          };
        } else if (state === 'disconnected') {
          this.connectedDevice = null;
        }
      })
    );

    this.nativeSubscriptions.push(
      MetaGlasses.addPhotoCapturedListener((event) => {
        this.emit('photoCaptured', {
          base64: event.base64,
          width: event.width,
          height: event.height,
        });
      })
    );

    this.nativeSubscriptions.push(
      MetaGlasses.addErrorListener((event) => {
        this.emit('error', { message: event.message });
      })
    );
  }

  // ── Event handling ──

  addEventListener(type: GlassesEventType, listener: EventListener): void {
    this.listeners.get(type)?.add(listener);
  }

  removeEventListener(type: GlassesEventType, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  private emit(type: GlassesEventType, data?: unknown): void {
    const event: GlassesEvent = { type, data };
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  private setConnectionState(state: GlassesConnectionState): void {
    this.connectionState = state;
    this.emit('connectionStateChanged', { state });
  }

  // ── Connection methods ──

  async startScanning(): Promise<void> {
    if (this.connectionState !== 'disconnected') {
      return;
    }

    this.setConnectionState('scanning');

    if (this.useMockDevice) {
      // Simulate finding a mock device after a delay
      setTimeout(() => {
        const mockDevice: GlassesDevice = {
          id: 'mock-device-001',
          name: 'Ray-Ban Meta (Mock)',
          model: 'mock',
          batteryLevel: 85,
          firmwareVersion: '1.0.0-mock',
        };
        this.emit('deviceDiscovered', { device: mockDevice });
      }, 1500);
    } else {
      // Registration opens the Meta AI app for authorization.
      // After the user approves, Meta AI redirects back via dutysnap:// URL.
      // The native MetaGlassesAppDelegate handles the URL, completes registration,
      // and automatically triggers scanning via NotificationCenter.
      MetaGlasses.startRegistration();
    }
  }

  async stopScanning(): Promise<void> {
    if (this.connectionState === 'scanning') {
      this.setConnectionState('disconnected');
    }

    if (!this.useMockDevice) {
      MetaGlasses.stopScanning();
    }
  }

  async connect(device: GlassesDevice): Promise<void> {
    if (this.useMockDevice) {
      this.setConnectionState('connecting');
      // Simulate connection delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      this.connectedDevice = device;
      this.setConnectionState('connected');
    }
    // In native mode, the AutoDeviceSelector handles connection automatically
    // and we receive state updates via the native event listener.
    // Don't change state here — native events drive it.
  }

  async disconnect(): Promise<void> {
    if (this.useMockDevice) {
      this.connectedDevice = null;
      this.setConnectionState('disconnected');
    } else {
      MetaGlasses.disconnect();
      // State will update via native event
    }
  }

  // ── Photo capture ──

  async capturePhoto(): Promise<string> {
    console.log('[MetaSDK] capturePhoto called, state:', this.connectionState, 'mock:', this.useMockDevice);
    if (this.connectionState !== 'connected') {
      throw new Error('Glasses not connected');
    }

    if (this.useMockDevice) {
      // Return a placeholder image for mock device
      await new Promise((resolve) => setTimeout(resolve, 500));
      const mockImageUri = 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800';
      this.emit('photoCaptured', { uri: mockImageUri });
      return mockImageUri;
    }

    // Native capture — returns base64 JPEG string
    console.log('[MetaSDK] Calling native capturePhoto...');
    try {
      const base64 = await MetaGlasses.capturePhoto();
      console.log('[MetaSDK] Photo captured, base64 length:', base64?.length);
      return `data:image/jpeg;base64,${base64}`;
    } catch (err) {
      console.error('[MetaSDK] capturePhoto error:', err);
      throw err;
    }
  }

  // Use device camera as fallback
  async captureFromDeviceCamera(): Promise<string> {
    // This will use expo-camera or expo-image-picker
    // Implemented in the CameraService
    throw new Error('Use CameraService for device camera');
  }

  // ── Getters ──

  getConnectionState(): GlassesConnectionState {
    return this.connectionState;
  }

  getConnectedDevice(): GlassesDevice | null {
    return this.connectedDevice;
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  // Mock device toggle (for development)
  setUseMockDevice(useMock: boolean): void {
    this.useMockDevice = useMock;

    // Clean up native subscriptions when switching to mock
    if (useMock) {
      this.nativeSubscriptions.forEach((sub) => sub.remove());
      this.nativeSubscriptions = [];
    } else {
      this.subscribeToNativeEvents();
    }
  }

  isMockDevice(): boolean {
    return this.useMockDevice;
  }

  // Clean up when service is no longer needed
  destroy(): void {
    this.nativeSubscriptions.forEach((sub) => sub.remove());
    this.nativeSubscriptions = [];
    this.listeners.forEach((set) => set.clear());
  }
}

// Singleton instance
export const metaSDK = new MetaSDKService();
