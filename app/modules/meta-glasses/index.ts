import { EventEmitter, Subscription } from 'expo-modules-core';

// Try to load the native module; returns null if not linked
let MetaGlassesNative: ReturnType<typeof require> | null = null;
try {
  MetaGlassesNative = require('expo-modules-core').requireNativeModule('MetaGlasses');
} catch {
  // Module not linked — running in Expo Go or pod wasn't installed
  MetaGlassesNative = null;
}

// Create an event emitter wrapping the native module (only if available)
const emitter = MetaGlassesNative ? new EventEmitter(MetaGlassesNative) : null;

export const isAvailable = MetaGlassesNative != null;

/** True if the native Meta DAT SDK was compiled in (SPM package present). */
export function isSDKAvailable(): boolean {
  if (!MetaGlassesNative) return false;
  try {
    return MetaGlassesNative.isSDKAvailable();
  } catch {
    return false;
  }
}

export type ConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'error';

export interface ConnectionStateEvent {
  state: ConnectionState;
}

export interface PhotoCapturedEvent {
  base64: string;
  width?: number;
  height?: number;
}

export interface ErrorEvent {
  message: string;
}

// ── Native methods ──

/** Register with the Meta AI companion app. */
export function startRegistration(): void {
  MetaGlassesNative?.startRegistration();
}

/** Begin scanning for nearby Meta glasses via Bluetooth. */
export function startScanning(): void {
  MetaGlassesNative?.startScanning();
}

/** Stop scanning for nearby Meta glasses. */
export function stopScanning(): void {
  MetaGlassesNative?.stopScanning();
}

/** Capture a JPEG photo from the connected glasses. Returns base64 string. */
export async function capturePhoto(): Promise<string> {
  if (!MetaGlassesNative) {
    throw new Error('MetaGlasses native module not available');
  }
  return MetaGlassesNative.capturePhoto();
}

/** Disconnect from the currently connected glasses. */
export function disconnect(): void {
  MetaGlassesNative?.disconnect();
}

/** Get the current connection state as a string. */
export function getConnectionState(): ConnectionState {
  if (!MetaGlassesNative) return 'disconnected';
  return MetaGlassesNative.getConnectionState();
}

// ── Event subscriptions ──

const noopSubscription: Subscription = { remove: () => {} };

export function addConnectionStateListener(
  listener: (event: ConnectionStateEvent) => void
): Subscription {
  return emitter?.addListener('onConnectionStateChanged', listener) ?? noopSubscription;
}

export function addPhotoCapturedListener(
  listener: (event: PhotoCapturedEvent) => void
): Subscription {
  return emitter?.addListener('onPhotoCaptured', listener) ?? noopSubscription;
}

export function addErrorListener(
  listener: (event: ErrorEvent) => void
): Subscription {
  return emitter?.addListener('onError', listener) ?? noopSubscription;
}

export function addDebugListener(
  listener: (event: { message: string }) => void
): Subscription {
  return emitter?.addListener('onDebug', listener) ?? noopSubscription;
}

export default MetaGlassesNative;
