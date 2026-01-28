/**
 * Meta Wearables SDK Service
 *
 * This service provides an abstraction layer for the Meta Wearables Device Access Toolkit.
 * It supports both real glasses and a mock implementation for development.
 *
 * Real SDK integration requires:
 * - iOS: meta-wearables-dat-ios pod
 * - Android: meta-wearables-dat-android dependency
 */

import type { GlassesDevice, GlassesConnectionState } from '../types';

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
  private useMockDevice: boolean = true; // Set to false when real SDK is integrated

  constructor() {
    // Initialize event listener maps
    const eventTypes: GlassesEventType[] = [
      'connectionStateChanged',
      'deviceDiscovered',
      'photoCaptured',
      'batteryChanged',
      'error',
    ];
    eventTypes.forEach((type) => this.listeners.set(type, new Set()));
  }

  // Event handling
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

  // Connection methods
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
      // Real SDK implementation would go here
      // await NativeMetaSDK.startScanning();
    }
  }

  async stopScanning(): Promise<void> {
    if (this.connectionState === 'scanning') {
      this.setConnectionState('disconnected');
    }

    if (!this.useMockDevice) {
      // Real SDK implementation
      // await NativeMetaSDK.stopScanning();
    }
  }

  async connect(device: GlassesDevice): Promise<void> {
    this.setConnectionState('connecting');

    if (this.useMockDevice) {
      // Simulate connection delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      this.connectedDevice = device;
      this.setConnectionState('connected');
    } else {
      // Real SDK implementation
      // await NativeMetaSDK.connect(device.id);
    }
  }

  async disconnect(): Promise<void> {
    if (this.useMockDevice) {
      this.connectedDevice = null;
      this.setConnectionState('disconnected');
    } else {
      // Real SDK implementation
      // await NativeMetaSDK.disconnect();
    }
  }

  // Photo capture
  async capturePhoto(): Promise<string> {
    if (this.connectionState !== 'connected') {
      throw new Error('Glasses not connected');
    }

    if (this.useMockDevice) {
      // Return a placeholder image for mock device
      // In real implementation, this would capture from glasses camera
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Return a sample product image URL for testing
      const mockImageUri = 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800';

      this.emit('photoCaptured', { uri: mockImageUri });
      return mockImageUri;
    } else {
      // Real SDK implementation
      // const result = await NativeMetaSDK.capturePhoto({ format: 'jpeg' });
      // return result.uri;
      throw new Error('Real SDK not implemented');
    }
  }

  // Use device camera as fallback
  async captureFromDeviceCamera(): Promise<string> {
    // This will use expo-camera or expo-image-picker
    // Implemented in the CameraService
    throw new Error('Use CameraService for device camera');
  }

  // Getters
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
  }

  isMockDevice(): boolean {
    return this.useMockDevice;
  }
}

// Singleton instance
export const metaSDK = new MetaSDKService();
