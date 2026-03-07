"use client";

/**
 * Voice Input Hook
 * 
 * Provides speech-to-text functionality using the Web Speech API.
 * Features:
 * - Start/stop voice recording
 * - Real-time transcription
 * - Language selection
 * - Noise cancellation (browser-dependent)
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// Types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface VoiceInputOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onTranscriptChange?: (transcript: string) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

export interface VoiceInputState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  language: string;
}

export function useVoiceInput(options: VoiceInputOptions = {}) {
  const {
    language = 'en-US',
    continuous = false,
    interimResults = true,
    onResult,
    onError,
    onEnd,
  } = options;

  const [state, setState] = useState<VoiceInputState>({
    isListening: false,
    isSupported: false,
    transcript: '',
    interimTranscript: '',
    error: null,
    language,
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setState(prev => ({ ...prev, isSupported: !!SpeechRecognition }));
  }, []);

  // Initialize recognition
  const initRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setState(prev => ({ ...prev, error: 'Speech recognition not supported' }));
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState(prev => ({ 
        ...prev, 
        isListening: true, 
        error: null,
        interimTranscript: '',
      }));
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setState(prev => ({
          ...prev,
          transcript: prev.transcript + finalTranscript,
          interimTranscript: '',
        }));
        onResult?.(finalTranscript, true);
      } else {
        setState(prev => ({ ...prev, interimTranscript }));
        onResult?.(interimTranscript, false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMessage = getErrorMessage(event.error);
      setState(prev => ({ ...prev, error: errorMessage, isListening: false }));
      onError?.(errorMessage);
    };

    recognition.onend = () => {
      setState(prev => ({ ...prev, isListening: false }));
      onEnd?.();
    };

    return recognition;
  }, [continuous, interimResults, language, onResult, onError, onEnd]);

  // Start listening
  const startListening = useCallback(async () => {
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      if (!recognitionRef.current) {
        recognitionRef.current = initRecognition();
      }

      if (recognitionRef.current) {
        setState(prev => ({ ...prev, transcript: '', interimTranscript: '' }));
        recognitionRef.current.start();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Microphone access denied';
      setState(prev => ({ ...prev, error: message }));
      onError?.(message);
    }
  }, [initRecognition, onError]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setState(prev => ({ ...prev, transcript: '', interimTranscript: '' }));
  }, []);

  // Set language
  const setLanguage = useCallback((newLanguage: string) => {
    setState(prev => ({ ...prev, language: newLanguage }));
    if (recognitionRef.current) {
      recognitionRef.current.lang = newLanguage;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    setLanguage,
  };
}

// Error message helper
function getErrorMessage(error: string): string {
  switch (error) {
    case 'no-speech':
      return 'No speech detected. Please try again.';
    case 'aborted':
      return 'Speech recognition was aborted.';
    case 'audio-capture':
      return 'No microphone found. Please check your audio settings.';
    case 'network':
      return 'Network error occurred. Please check your connection.';
    case 'not-allowed':
      return 'Microphone access denied. Please allow access in your browser settings.';
    case 'service-not-allowed':
      return 'Speech recognition service not allowed.';
    case 'bad-grammar':
      return 'Speech grammar error.';
    case 'language-not-supported':
      return 'Language not supported.';
    default:
      return `Speech recognition error: ${error}`;
  }
}

// Supported languages
export const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'es-ES', name: 'Spanish (Spain)' },
  { code: 'es-MX', name: 'Spanish (Mexico)' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)' },
  { code: 'nl-NL', name: 'Dutch' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'ko-KR', name: 'Korean' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)' },
  { code: 'ar-SA', name: 'Arabic' },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'ru-RU', name: 'Russian' },
  { code: 'pl-PL', name: 'Polish' },
  { code: 'sv-SE', name: 'Swedish' },
  { code: 'da-DK', name: 'Danish' },
  { code: 'fi-FI', name: 'Finnish' },
  { code: 'no-NO', name: 'Norwegian' },
];

export default useVoiceInput;
