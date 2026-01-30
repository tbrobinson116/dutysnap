/**
 * Voice feedback service using ElevenLabs TTS.
 * Audio routes to glasses speakers automatically via Bluetooth.
 * Falls back to expo-speech if ElevenLabs is unavailable.
 */

import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

const ELEVENLABS_API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY || '';

// ElevenLabs voice ID — "Rachel" is a clear, natural-sounding default.
// Browse voices at https://elevenlabs.io/voice-library
const VOICE_ID = process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';

const ELEVENLABS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

let currentSound: Audio.Sound | null = null;

async function speak(message: string): Promise<void> {
  if (!ELEVENLABS_API_KEY) {
    // Fallback to on-device TTS
    Speech.speak(message, { rate: 1.0, pitch: 1.0, language: 'en-US' });
    return;
  }

  try {
    const response = await fetch(ELEVENLABS_URL, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: message,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      console.warn('ElevenLabs error, falling back to expo-speech');
      Speech.speak(message, { rate: 1.0, pitch: 1.0, language: 'en-US' });
      return;
    }

    const blob = await response.blob();
    const reader = new FileReader();

    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        // Strip the data URL prefix to get raw base64
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Stop any currently playing audio
    if (currentSound) {
      await currentSound.unloadAsync().catch(() => {});
      currentSound = null;
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: `data:audio/mpeg;base64,${base64}` },
      { shouldPlay: true },
    );
    currentSound = sound;

    // Clean up after playback finishes
    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        if (currentSound === sound) currentSound = null;
      }
    });
  } catch (error) {
    console.warn('ElevenLabs playback failed, falling back to expo-speech:', error);
    Speech.speak(message, { rate: 1.0, pitch: 1.0, language: 'en-US' });
  }
}

export function confirmCapture(): void {
  speak('Capturing image.');
}

export function confirmCountry(direction: 'from' | 'to', name: string): void {
  speak(`Shipping ${direction} ${name}.`);
}

export function confirmProductInfo(name: string): void {
  speak(`Got it. ${name}.`);
}

export function confirmNavigation(destination: 'back' | 'history' | 'home'): void {
  const labels: Record<string, string> = {
    back: 'Going back.',
    history: 'Opening history.',
    home: 'Going home.',
  };
  speak(labels[destination] || 'Navigating.');
}

export function sayListening(): void {
  speak("I'm listening.");
}

export function sayError(message: string): void {
  speak(message);
}

export function stopSpeaking(): void {
  if (currentSound) {
    currentSound.stopAsync().catch(() => {});
    currentSound.unloadAsync().catch(() => {});
    currentSound = null;
  }
  Speech.stop();
}
