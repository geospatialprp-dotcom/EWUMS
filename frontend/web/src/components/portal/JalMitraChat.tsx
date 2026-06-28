import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Button, Chip, Fab, IconButton, Paper, TextField, Tooltip, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import axios from 'axios';
import { jalMitraApi } from '../../services/portalApi';
import { LOCALE_STORAGE_KEY } from '../../i18n';
import { useVoiceAssistant } from '../../hooks/useVoiceAssistant';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type JalMitraLang = 'garhwali' | 'kumaoni' | 'hi' | 'en';

const LANG_STORAGE_KEY = 'jal_mitra_lang';
const INVITE_DISMISSED_KEY = 'jal_mitra_invite_dismissed';

function inviteDismissedKey(lang: JalMitraLang): string {
  return `${INVITE_DISMISSED_KEY}_${lang}`;
}

function isInviteDismissed(lang: JalMitraLang): boolean {
  return sessionStorage.getItem(inviteDismissedKey(lang)) === '1';
}

const LANGUAGE_OPTIONS: Array<{ id: JalMitraLang; label: string }> = [
  { id: 'garhwali', label: 'गढ़वाली' },
  { id: 'kumaoni', label: 'कुमाऊनी' },
  { id: 'hi', label: 'हिंदी' },
  { id: 'en', label: 'English' },
];

const VOICE_HINTS: Record<JalMitraLang, string> = {
  garhwali: 'गढ़वाली मां बोलो — जैसे "मेरो बिल" या "पाणी कब मिलू?"',
  kumaoni: 'कुमाऊनी मां बोलो — जैसे "मेरो बिल" या "पाणी कब मिलू?"',
  hi: 'हिंदी में बोलें — जैसे "मेरा बिल" या "पानी कब मिलेगा?"',
  en: 'Speak in Indian English — e.g. "My bill details" or "What is water supply timing?"',
};

const INVITE_SLOGANS: Record<JalMitraLang, { title: string; question: string; cta: string }> = {
  garhwali: {
    title: 'नमस्कार! मैं जल मित्र।',
    question: 'कै मदद चाहिय? बिल, शिकायत या पाणी समय — मुझसे पूछो!',
    cta: 'हाँ, बात करो',
  },
  kumaoni: {
    title: 'नमस्कार! मैं जल मित्र।',
    question: 'की मदद चाह? बिल, शिकायत या पाणी समय — मुझसे पूछ!',
    cta: 'हाँ, बात करौ',
  },
  hi: {
    title: 'नमस्ते! मैं जल मित्र हूँ।',
    question: 'आज मैं आपकी क्या सहायता कर सकता/सकती हूँ?',
    cta: 'बात करें',
  },
  en: {
    title: 'Namaste! I am Jal Mitra.',
    question: 'How may I help you today? Ask about bill, complaint, or water supply timing.',
    cta: 'Yes, let us talk',
  },
};

function getPreferredLanguage(): JalMitraLang {
  const appLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (appLocale === 'hi') return 'hi';
  if (appLocale === 'en') return 'en';
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  if (stored === 'garhwali' || stored === 'kumaoni' || stored === 'hi' || stored === 'en') {
    return stored;
  }
  return 'garhwali';
}

function getError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return 'Could not reach Jal Mitra. Please try again.';
}

export default function JalMitraChat() {
  const preferredLang = getPreferredLanguage();
  const [open, setOpen] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [language, setLanguage] = useState<JalMitraLang>(preferredLang);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [quickActions, setQuickActions] = useState<Array<{ id: string; label: string }>>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSpokenIdRef = useRef('');
  const inviteSpeechKeyRef = useRef('');
  const {
    supported: voiceSupported,
    listening,
    speaking,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  } = useVoiceAssistant(language);

  const scrollDown = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const boot = useCallback(async (lang: JalMitraLang) => {
    setBusy(true);
    setError('');
    try {
      const { data } = await jalMitraApi.startSession({ language: lang, channel: 'web_portal' });
      setSessionId(data.sessionId);
      setLanguage((data.language as JalMitraLang) ?? lang);
      localStorage.setItem(LANG_STORAGE_KEY, (data.language as JalMitraLang) ?? lang);
      setQuickActions(data.quickActions ?? []);
      lastSpokenIdRef.current = '';
      setMessages((data.messages ?? []).map((m: { id: string; role: string; content: string }) => ({
        id: m.id,
        role: m.role as ChatMessage['role'],
        content: m.content,
      })));
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const onAppLocaleChange = (event: Event) => {
      const next = (event as CustomEvent<'en' | 'hi'>).detail;
      if (next !== 'en' && next !== 'hi') return;
      localStorage.setItem(LANG_STORAGE_KEY, next);
      setLanguage(next);
      if (sessionId) {
        jalMitraApi.setLanguage(sessionId, next).catch(() => undefined);
      }
    };
    window.addEventListener('egip-locale-change', onAppLocaleChange);
    return () => window.removeEventListener('egip-locale-change', onAppLocaleChange);
  }, [sessionId]);

  useEffect(() => {
    if (open || isInviteDismissed(language)) {
      setInviteVisible(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setInviteVisible(true), 1200);
    return () => window.clearTimeout(timer);
  }, [open, language]);

  useEffect(() => {
    if (open) setInviteVisible(false);
  }, [open]);

  const dismissInvite = () => {
    setInviteVisible(false);
    sessionStorage.setItem(inviteDismissedKey(language), '1');
    stopSpeaking();
  };

  const selectInviteLanguage = (lang: JalMitraLang) => {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    setLanguage(lang);
    stopSpeaking();
    inviteSpeechKeyRef.current = '';
    if (open || isInviteDismissed(lang)) {
      setInviteVisible(false);
      return;
    }
    setInviteVisible(true);
  };

  const openChat = () => {
    setInviteVisible(false);
    setOpen(true);
  };

  const invite = INVITE_SLOGANS[language];

  useEffect(() => {
    if (open && !sessionId) {
      void boot(language);
    }
  }, [open, sessionId, boot, language]);

  useEffect(() => {
    if (!inviteVisible || open) return undefined;
    const speechKey = `${language}:${invite.title}:${invite.question}`;
    if (inviteSpeechKeyRef.current === speechKey) return undefined;
    inviteSpeechKeyRef.current = speechKey;
    const timer = window.setTimeout(() => {
      if (voiceReplyEnabled) speak(`${invite.title} ${invite.question}`);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [inviteVisible, open, voiceReplyEnabled, language, invite.title, invite.question, speak]);

  useEffect(() => {
    scrollDown();
  }, [messages, open]);

  useEffect(() => {
    if (!open || !voiceReplyEnabled) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant' || last.id === lastSpokenIdRef.current) return;
    lastSpokenIdRef.current = last.id;
    speak(last.content);
  }, [messages, open, voiceReplyEnabled, speak]);

  useEffect(() => {
    if (!open) {
      stopListening();
      stopSpeaking();
    }
  }, [open, stopListening, stopSpeaking]);

  const send = async (text: string, quickActionId?: string) => {
    if (!sessionId || !text.trim() || busy) return;
    setBusy(true);
    setError('');
    setInput('');
    try {
      const { data } = await jalMitraApi.sendMessage(sessionId, {
        text: text.trim(),
        quickActionId,
        language,
      });
      const nextLang = (data.session?.language as JalMitraLang) ?? language;
      setLanguage(nextLang);
      localStorage.setItem(LANG_STORAGE_KEY, nextLang);
      setQuickActions(data.quickActions ?? []);
      setMessages((prev) => {
        const next = [...prev];
        if (data.userMessage) {
          next.push({
            id: data.userMessage.id,
            role: 'user',
            content: data.userMessage.content,
          });
        }
        if (data.assistantMessage) {
          next.push({
            id: data.assistantMessage.id,
            role: 'assistant',
            content: data.assistantMessage.content,
          });
        }
        return next;
      });
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  };

  const changeLanguage = async (lang: JalMitraLang) => {
    if (lang === language && sessionId) return;
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    setLanguage(lang);
    stopSpeaking();
    inviteSpeechKeyRef.current = '';
    setSessionId(null);
    setMessages([]);
    setQuickActions([]);
    lastSpokenIdRef.current = '';
    if (!open && !isInviteDismissed(lang)) {
      setInviteVisible(true);
    }
    await boot(lang);
  };

  const toggleVoiceInput = () => {
    if (listening) {
      stopListening();
      return;
    }
    startListening(
      (text, isFinal) => {
        setInput(text);
        if (isFinal && text.trim()) {
          void send(text);
        }
      },
      (message) => setError(message),
    );
  };

  return (
    <>
      {inviteVisible && !open && (
        <Paper
          elevation={8}
          onClick={openChat}
          sx={{
            position: 'fixed',
            bottom: 28,
            right: 88,
            zIndex: 1400,
            maxWidth: { xs: 'calc(100vw - 120px)', sm: 280 },
            p: 1.5,
            borderRadius: 3,
            border: '1px solid #bae6fd',
            bgcolor: '#fff',
            cursor: 'pointer',
            animation: 'jalMitraPopIn 0.35s ease-out',
            '@keyframes jalMitraPopIn': {
              from: { opacity: 0, transform: 'translateY(12px) scale(0.95)' },
              to: { opacity: 1, transform: 'translateY(0) scale(1)' },
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              right: -8,
              bottom: 22,
              width: 0,
              height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderLeft: '8px solid #fff',
            },
          }}
        >
          <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={0.5}>
            <Box flex={1} minWidth={0}>
              <Typography variant="subtitle2" fontWeight={800} color="#0284c7" gutterBottom>
                {invite.title}
              </Typography>
              <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.45 }}>
                {invite.question}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.id}
                    size="small"
                    label={opt.label}
                    color={language === opt.id ? 'primary' : 'default'}
                    variant={language === opt.id ? 'filled' : 'outlined'}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectInviteLanguage(opt.id);
                    }}
                    sx={{ fontSize: '0.68rem', height: 24 }}
                  />
                ))}
              </Box>
              <Button
                size="small"
                variant="contained"
                sx={{ mt: 1.25, bgcolor: '#0284c7', textTransform: 'none', fontWeight: 700 }}
                onClick={(e) => {
                  e.stopPropagation();
                  openChat();
                }}
              >
                {invite.cta}
              </Button>
            </Box>
            <IconButton
              size="small"
              aria-label="Dismiss"
              onClick={(e) => {
                e.stopPropagation();
                dismissInvite();
              }}
              sx={{ mt: -0.5, mr: -0.5 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Paper>
      )}

      <Tooltip title="Jal Mitra — 24×7 water help">
        <Fab
          color="primary"
          onClick={openChat}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1400,
            bgcolor: '#0284c7',
            '&:hover': { bgcolor: '#0369a1' },
            animation: inviteVisible && !open ? 'jalMitraPulse 2s ease-in-out infinite' : 'none',
            '@keyframes jalMitraPulse': {
              '0%, 100%': { boxShadow: '0 0 0 0 rgba(2, 132, 199, 0.45)' },
              '50%': { boxShadow: '0 0 0 12px rgba(2, 132, 199, 0)' },
            },
          }}
        >
          <WaterDropIcon />
        </Fab>
      </Tooltip>

      {open && (
        <Paper
          elevation={12}
          sx={{
            position: 'fixed',
            bottom: 96,
            right: 24,
            width: { xs: 'calc(100vw - 32px)', sm: 380 },
            height: 520,
            zIndex: 1400,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 3,
            overflow: 'hidden',
            border: '1px solid #bae6fd',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.25,
              bgcolor: '#0284c7',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography variant="subtitle2" fontWeight={800}>Jal Mitra</Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                {LANGUAGE_OPTIONS.find((opt) => opt.id === language)?.label ?? 'गढ़वाली'}
                {listening ? ' · सुनदा…' : speaking ? ' · बोलदा…' : ''}
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={0.25}>
              <Tooltip title={voiceReplyEnabled ? 'Mute voice replies' : 'Enable voice replies'}>
                <IconButton
                  size="small"
                  onClick={() => {
                    if (voiceReplyEnabled) stopSpeaking();
                    setVoiceReplyEnabled((value) => !value);
                  }}
                  sx={{ color: '#fff' }}
                >
                  {voiceReplyEnabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: '#fff' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          <Box sx={{ px: 1, py: 0.75, display: 'flex', flexWrap: 'wrap', gap: 0.5, bgcolor: '#fff', borderBottom: '1px solid #e2e8f0' }}>
            {LANGUAGE_OPTIONS.map((opt) => (
              <Chip
                key={opt.id}
                size="small"
                label={opt.label}
                color={language === opt.id ? 'primary' : 'default'}
                variant={language === opt.id ? 'filled' : 'outlined'}
                onClick={() => { void changeLanguage(opt.id); }}
                disabled={busy}
                sx={{ fontSize: '0.72rem' }}
              />
            ))}
            {(language === 'garhwali' || language === 'kumaoni') && (
              <Typography variant="caption" color="text.secondary" sx={{ width: '100%', px: 0.5, pt: 0.25 }}>
                {language === 'garhwali'
                  ? 'जल मित्र गढ़वाली मां जवाब देगा — तुम अपणी भाषा मां बोलो या लिखो।'
                  : 'जल मित्र कुमाऊनी मां जवाब देगा — तुम अपणी भाषा मां बोलो या लिखो।'}
              </Typography>
            )}
          </Box>

          {listening && (
            <Box sx={{ px: 2, py: 0.75, bgcolor: '#e0f2fe', borderBottom: '1px solid #bae6fd' }}>
              <Typography variant="caption" color="primary" fontWeight={600} display="block">
                {VOICE_HINTS[language]}
              </Typography>
            </Box>
          )}

          <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, bgcolor: '#f0f9ff' }}>
            {error && (
              <Typography variant="caption" color="error" display="block" sx={{ mb: 1 }}>
                {error}
              </Typography>
            )}
            {messages.map((m) => (
              <Box
                key={m.id}
                sx={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                  mb: 1,
                }}
              >
                <Box
                  sx={{
                    maxWidth: '85%',
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: m.role === 'user' ? '#dcfce7' : '#fff',
                    border: '1px solid',
                    borderColor: m.role === 'user' ? '#bbf7d0' : '#e2e8f0',
                    fontSize: '0.875rem',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {m.content}
                </Box>
              </Box>
            ))}
            <div ref={bottomRef} />
          </Box>

          {quickActions.length > 0 && (
            <Box sx={{ px: 1, py: 0.75, display: 'flex', flexWrap: 'wrap', gap: 0.5, bgcolor: '#fff' }}>
              {quickActions.map((a) => (
                <Chip
                  key={a.id}
                  size="small"
                  label={a.label}
                  onClick={() => send(a.label, a.id)}
                  disabled={busy}
                  sx={{ fontSize: '0.7rem' }}
                />
              ))}
            </Box>
          )}

          <Box sx={{ p: 1, display: 'flex', gap: 0.5, borderTop: '1px solid #e2e8f0', bgcolor: '#fff' }}>
            <Tooltip
              title={
                voiceSupported
                  ? (listening ? 'Stop listening' : 'Speak in your language')
                  : 'Voice not supported in this browser'
              }
            >
              <span>
                <IconButton
                  onClick={toggleVoiceInput}
                  disabled={busy || !sessionId || !voiceSupported}
                  sx={{
                    bgcolor: listening ? '#fee2e2' : '#e0f2fe',
                    color: listening ? '#dc2626' : '#0284c7',
                    '&:hover': { bgcolor: listening ? '#fecaca' : '#bae6fd' },
                  }}
                >
                  {listening ? <MicOffIcon /> : <MicIcon />}
                </IconButton>
              </span>
            </Tooltip>
            <TextField
              size="small"
              fullWidth
              placeholder={
                language === 'garhwali' || language === 'kumaoni'
                  ? 'गढ़वाली/कुमाऊनी मां लिखो या माइक दबाओ…'
                  : 'Type or tap mic to speak…'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              disabled={busy || !sessionId || listening}
            />
            <IconButton
              color="primary"
              onClick={() => send(input)}
              disabled={busy || !input.trim() || !sessionId || listening}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Paper>
      )}
    </>
  );
}
