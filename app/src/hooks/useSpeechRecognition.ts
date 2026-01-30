/**
 * Speech recognition hook using @react-native-voice/voice.
 * Provides post-activation listening with timeouts and partial results.
 * Gracefully degrades if the native module isn't available.
 */

import { useRef, useCallback, useState } from 'react';
import { NativeModules } from 'react-native';

// Check if the native module actually exists before importing Voice.
// Voice's constructor creates a NativeEventEmitter which crashes if the
// native module isn't linked.
const hasNativeVoice = !!NativeModules.Voice;

let Voice: any = null;
if (hasNativeVoice) {
  try {
    Voice = require('@react-native-voice/voice').default;
  } catch {
    // Module not available
  }
}

interface UseSpeechRecognitionOptions {
  onResult: (transcript: string) => void;
  onTimeout: () => void;
  absoluteTimeout?: number;
  silenceTimeout?: number;
}

export function useSpeechRecognition({
  onResult,
  onTimeout,
  absoluteTimeout = 10000,
  silenceTimeout = 5000,
}: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [partialText, setPartialText] = useState('');
  const absoluteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(false);
  const setupDoneRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (absoluteTimerRef.current) {
      clearTimeout(absoluteTimerRef.current);
      absoluteTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = setTimeout(() => {
      if (isActiveRef.current && Voice) {
        Voice.stop().catch(() => {});
      }
    }, silenceTimeout);
  }, [silenceTimeout]);

  // Set up Voice event handlers once
  const setupVoiceHandlers = useCallback(() => {
    if (!Voice || setupDoneRef.current) return;
    setupDoneRef.current = true;

    Voice.onSpeechResults = (e: any) => {
      if (!isActiveRef.current) return;
      const transcript = e.value?.[0];
      if (transcript) {
        isActiveRef.current = false;
        clearTimers();
        setIsListening(false);
        setPartialText('');
        onResult(transcript);
      }
    };

    Voice.onSpeechPartialResults = (e: any) => {
      if (!isActiveRef.current) return;
      const partial = e.value?.[0];
      if (partial) {
        setPartialText(partial);
        resetSilenceTimer();
      }
    };

    Voice.onSpeechError = (e: any) => {
      if (!isActiveRef.current) return;
      console.warn('Speech recognition error:', e.error);
      isActiveRef.current = false;
      clearTimers();
      setIsListening(false);
      setPartialText('');
      onTimeout();
    };

    Voice.onSpeechEnd = () => {
      if (!isActiveRef.current) return;
      isActiveRef.current = false;
      clearTimers();
      setIsListening(false);
      setPartialText('');
      onTimeout();
    };
  }, [onResult, onTimeout, clearTimers, resetSilenceTimer]);

  const startListening = useCallback(async () => {
    if (!Voice) {
      console.warn('[useSpeechRecognition] Native module not available — use debug panel instead');
      onTimeout();
      return;
    }

    setupVoiceHandlers();

    try {
      isActiveRef.current = true;
      setPartialText('');
      setIsListening(true);

      await Voice.start('en-US');

      absoluteTimerRef.current = setTimeout(() => {
        if (isActiveRef.current) {
          Voice.stop().catch(() => {});
        }
      }, absoluteTimeout);

      resetSilenceTimer();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      isActiveRef.current = false;
      setIsListening(false);
      clearTimers();
      onTimeout();
    }
  }, [absoluteTimeout, clearTimers, resetSilenceTimer, onTimeout, setupVoiceHandlers]);

  const stopListening = useCallback(async () => {
    isActiveRef.current = false;
    clearTimers();
    if (Voice) {
      try {
        await Voice.stop();
      } catch {
        // Already stopped
      }
    }
    setIsListening(false);
    setPartialText('');
  }, [clearTimers]);

  return {
    isListening,
    partialText,
    startListening,
    stopListening,
  };
}
