import { useCallback, useEffect, useRef, useState } from 'react';

type JalMitraVoiceLang = 'en' | 'hi' | 'garhwali' | 'kumaoni' | string;

const VOICE_LANG_MAP: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  garhwali: 'hi-IN',
  kumaoni: 'hi-IN',
};

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function resolveVoiceLang(language: JalMitraVoiceLang): string {
  return VOICE_LANG_MAP[language] ?? 'hi-IN';
}

function pickSpeechVoice(language: JalMitraVoiceLang): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const targetLang = resolveVoiceLang(language);

  if (language === 'en') {
    const indianVoices = voices.filter((voice) => (
      voice.lang === 'en-IN'
      || voice.lang.toLowerCase().startsWith('en-in')
    ));
    if (indianVoices.length) {
      const preferred = indianVoices.find((voice) => /google|microsoft|natural|neural/i.test(voice.name));
      return preferred ?? indianVoices[0];
    }

    const byName = voices.find((voice) => (
      /india|indian|heera|ravi|neerja|lekha|prabhat/i.test(voice.name)
      && voice.lang.toLowerCase().startsWith('en')
    ));
    if (byName) return byName;

    return voices.find((voice) => voice.lang.toLowerCase().startsWith('en-in'))
      ?? voices.find((voice) => voice.lang.toLowerCase().startsWith('en'))
      ?? null;
  }

  const exact = voices.find((voice) => voice.lang === targetLang);
  if (exact) return exact;

  const prefix = voices.find((voice) => voice.lang.toLowerCase().startsWith(targetLang.slice(0, 2)));
  return prefix ?? null;
}

export function useVoiceAssistant(language: JalMitraVoiceLang) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const [voicesReady, setVoicesReady] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognitionCtor()) && 'speechSynthesis' in window);
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined;

    const refreshVoices = () => setVoicesReady(window.speechSynthesis.getVoices().length > 0);
    refreshVoices();
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    utteranceRef.current = null;
  }, []);

  const speak = useCallback((text: string) => {
    if (!text.trim() || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = resolveVoiceLang(language);
    const voice = pickSpeechVoice(language);
    if (voice) utterance.voice = voice;
    utterance.rate = language === 'en' ? 0.92 : 0.95;
    utterance.pitch = language === 'en' ? 1.02 : 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => {
      setSpeaking(false);
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setSpeaking(false);
      utteranceRef.current = null;
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [language, stopSpeaking, voicesReady]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const startListening = useCallback((
    onTranscript: (text: string, isFinal: boolean) => void,
    onError?: (message: string) => void,
  ) => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onError?.('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    stopSpeaking();
    stopListening();

    const recognition = new Ctor();
    recognition.lang = resolveVoiceLang(language);
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const part = event.results[i][0]?.transcript ?? '';
        if (event.results[i].isFinal) finalText += part;
        else interim += part;
      }
      if (finalText.trim()) onTranscript(finalText.trim(), true);
      else if (interim.trim()) onTranscript(interim.trim(), false);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'aborted') {
        const message = event.error === 'not-allowed'
          ? 'Microphone permission denied. Allow mic access to use voice.'
          : 'Could not capture voice. Please try again.';
        onError?.(message);
      }
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [language, stopListening, stopSpeaking]);

  useEffect(() => () => {
    stopListening();
    stopSpeaking();
  }, [stopListening, stopSpeaking]);

  return {
    supported,
    listening,
    speaking,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
