/**
 * Main voice commands orchestrator hook.
 * Uses tap-to-talk: user taps the mic button to activate speech recognition.
 * State machine: idle → active_listening → processing → idle
 */

import { useState, useCallback, useRef } from 'react';
import type { VoiceMode, ParsedVoiceCommand } from '../types/voice';
import { useSpeechRecognition } from './useSpeechRecognition';
import { parseVoiceCommand } from '../services/voiceCommandParser';
import * as VoiceFeedback from '../services/voiceFeedback';
import { api } from '../services/api';

interface UseVoiceCommandsOptions {
  onCapture: () => void;
  onSetOriginCountry: (code: string) => void;
  onSetDestinationCountry: (code: string) => void;
  onSetProductInfo: (name: string, value?: number, currency?: string) => void;
  onNavigate: (destination: 'back' | 'history' | 'home') => void;
}

export function useVoiceCommands({
  onCapture,
  onSetOriginCountry,
  onSetDestinationCountry,
  onSetProductInfo,
  onNavigate,
}: UseVoiceCommandsOptions) {
  const [mode, setMode] = useState<VoiceMode>('idle');
  const [transcript, setTranscript] = useState('');
  const isProcessingRef = useRef(false);

  // Execute a parsed command
  const executeCommand = useCallback(
    (command: ParsedVoiceCommand) => {
      switch (command.type) {
        case 'capture':
          VoiceFeedback.confirmCapture();
          onCapture();
          break;
        case 'ship_from':
          if (command.countryCode) {
            VoiceFeedback.confirmCountry('from', command.countryName || command.countryCode);
            onSetOriginCountry(command.countryCode);
          }
          break;
        case 'ship_to':
          if (command.countryCode) {
            VoiceFeedback.confirmCountry('to', command.countryName || command.countryCode);
            onSetDestinationCountry(command.countryCode);
          }
          break;
        case 'product_info':
          if (command.productName) {
            VoiceFeedback.confirmProductInfo(command.productName);
            onSetProductInfo(command.productName, command.productValue, command.currency);
          }
          break;
        case 'navigation':
          if (command.destination) {
            VoiceFeedback.confirmNavigation(command.destination);
            onNavigate(command.destination);
          }
          break;
      }
    },
    [onCapture, onSetOriginCountry, onSetDestinationCountry, onSetProductInfo, onNavigate],
  );

  // Handle final speech recognition result
  const handleSpeechResult = useCallback(
    async (text: string) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setMode('processing');
      setTranscript(text);

      // Tier 1: local regex parse
      let command = parseVoiceCommand(text);

      // Tier 2: backend LLM fallback
      if (!command) {
        command = await api.parseVoiceCommand(text);
      }

      if (command) {
        executeCommand(command);
      } else {
        VoiceFeedback.sayError("Sorry, I didn't understand that.");
      }

      isProcessingRef.current = false;
      setTranscript('');
      setMode('idle');
    },
    [executeCommand],
  );

  // Handle speech timeout (no input or silence)
  const handleSpeechTimeout = useCallback(() => {
    setTranscript('');
    setMode('idle');
  }, []);

  // Speech recognition
  const { partialText, startListening, stopListening } = useSpeechRecognition({
    onResult: handleSpeechResult,
    onTimeout: handleSpeechTimeout,
  });

  // Public: tap to start listening
  const activate = useCallback(() => {
    if (mode === 'active_listening') {
      // Tap again to cancel
      stopListening();
      setMode('idle');
      setTranscript('');
      return;
    }
    if (mode !== 'idle') return;
    setMode('active_listening');
    VoiceFeedback.sayListening();
    // Small delay so TTS "I'm listening" doesn't get picked up by the mic
    setTimeout(() => startListening(), 500);
  }, [mode, startListening, stopListening]);

  // Public: simulate a voice command (for __DEV__ debug panel)
  const simulateCommand = useCallback(
    (text: string) => {
      handleSpeechResult(text);
    },
    [handleSpeechResult],
  );

  return {
    mode,
    transcript: transcript || partialText,
    activate,
    simulateCommand,
  };
}
