import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bot, Leaf, MessageCircle, Mic, MicOff, Send, Square, Trash2, User, Volume2, VolumeX } from 'lucide-react';
import { api } from '../services/api.js';
import { PageWrap, SectionTitle } from '../components/ui.jsx';
import { ErrorBox } from '../components/common.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

const STARTERS = [
  'How can I improve soil health before planting?',
  'What should I check if my tomato leaves are yellowing?',
  'How can I reduce water use when irrigating?',
];

export default function FarmChat() {
  const { t, language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem('cg_tts_enabled') !== 'false');
  const [voices, setVoices] = useState([]);
  const [speakingId, setSpeakingId] = useState(null);
  const [speechNotice, setSpeechNotice] = useState('');
  const [voiceNotice, setVoiceNotice] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const voiceModeRef = useRef(false);
  const busyRef = useRef(false);
  const lastVoiceRequestRef = useRef(null);
  const responseIdRef = useRef(0);
  const lastAutoResponseRef = useRef(null);

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setSpeechNotice(t('Speech synthesis is not supported in this browser.'));
      return undefined;
    }
    const updateVoices = () => setVoices(window.speechSynthesis.getVoices());
    updateVoices();
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
  }, [t]);

  const stopSpeech = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  const speak = useCallback((content, id, onFinish) => {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      setSpeechNotice(t('Speech synthesis is not supported in this browser.'));
      onFinish?.();
      return;
    }

    const locale = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' }[language] || 'en-IN';
    const voice = voices.find((item) => item.lang.toLowerCase() === locale.toLowerCase())
      || voices.find((item) => item.lang.toLowerCase().startsWith(`${language}-`));
    if (!voice) {
      setSpeechNotice(t('No voice is available for the selected language on this device.'));
      onFinish?.();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = locale;
    utterance.voice = voice;
    utterance.onstart = () => {
      setSpeakingId(id);
      setSpeechNotice('');
    };
    utterance.onend = () => {
      setSpeakingId((current) => current === id ? null : current);
      onFinish?.();
    };
    utterance.onerror = (event) => {
      setSpeakingId((current) => current === id ? null : current);
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        setSpeechNotice(t('Speech playback failed. Try replaying the response.'));
      }
      onFinish?.();
    };
    setSpeechNotice('');
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  }, [language, t, voices]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  useEffect(() => () => {
    voiceModeRef.current = false;
    if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    recognitionRef.current?.abort();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const submit = async (value = question) => {
    const text = value.trim();
    if (!text || busyRef.current) return;
    setQuestion('');
    setError('');
    busyRef.current = true;
    setBusy(true);
    try {
      const history = messages.slice(-10).map(({ role, content }) => ({ role, content }));
      const result = await api.askChat(text, history, language);
      setMessages((current) => [
        ...current,
        { role: 'user', content: text },
        { role: 'assistant', content: result.answer, inScope: result.in_scope, id: ++responseIdRef.current },
      ]);
    } catch (requestError) {
      setQuestion(text);
      setError(requestError.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const stopListening = useCallback(() => {
    voiceModeRef.current = false;
    setVoiceMode(false);
    if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      voiceModeRef.current = false;
      setVoiceMode(false);
      setVoiceNotice(t('Voice input is not supported in this browser.'));
      return;
    }
    if (busyRef.current) {
      setVoiceNotice(t('Wait for the current response to finish before speaking again.'));
      return;
    }

    voiceModeRef.current = true;
    setVoiceMode(true);
    recognitionRef.current?.abort();
    const recognition = new Recognition();
    const locale = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' }[language] || 'en-IN';
    let recognitionFailed = false;
    recognition.lang = locale;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    const resetSilenceTimer = () => {
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = window.setTimeout(() => {
        const activeRecognition = recognitionRef.current;
        if (!activeRecognition || !voiceModeRef.current) return;
        voiceModeRef.current = false;
        setVoiceMode(false);
        setListening(false);
        setVoiceNotice(t('Stopped listening after 5 seconds of silence.'));
        silenceTimerRef.current = null;
        recognitionRef.current = null;
        activeRecognition.stop();
      }, 5000);
    };
    recognition.onstart = () => {
      setListening(true);
      setVoiceNotice('');
      if (!silenceTimerRef.current) resetSilenceTimer();
    };
    recognition.onresult = (event) => {
      let transcript = '';
      let finalTranscript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript?.trim();
        if (!text) continue;
        transcript += `${text} `;
        if (result.isFinal) finalTranscript += `${text} `;
      }
      if (!transcript.trim()) return;
      resetSilenceTimer();
      if (!finalTranscript.trim()) return;
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
      const questionText = finalTranscript.trim();
      setQuestion(questionText);
      setVoiceNotice('');
      recognition.stop();
      setListening(false);
      submit(questionText);
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      recognitionFailed = true;
      const message = {
        'not-allowed': 'Allow microphone access in your browser to use voice input.',
        'service-not-allowed': 'Allow microphone access in your browser to use voice input.',
        'audio-capture': 'No microphone was found. Check your device microphone.',
        'no-speech': 'No speech was detected. Tap the microphone and try again.',
        network: 'Voice recognition needs an internet connection. Check your connection and try again.',
      }[event.error] || 'Voice recognition failed. Tap the microphone and try again.';
      setVoiceNotice(t(message));
      voiceModeRef.current = false;
      setVoiceMode(false);
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
      setListening(false);
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setListening(false);
      if (voiceModeRef.current && !recognitionFailed && !busyRef.current && !recognitionRef.current) {
        startListening();
      } else if (voiceModeRef.current && !recognitionFailed && busyRef.current) {
        if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
        setVoiceNotice(t('Waiting for the assistant response…'));
      } else {
        if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };

    recognitionRef.current = recognition;
    setVoiceNotice(t('Listening… Speak your farming question.'));
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      voiceModeRef.current = false;
      setVoiceMode(false);
      setListening(false);
      setVoiceNotice(t('Voice recognition could not start. Tap the microphone and try again.'));
    }
  }, [busyRef, language, submit, t]);

  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (!latest || latest.role !== 'assistant' || latest.id === lastAutoResponseRef.current) return;
    lastAutoResponseRef.current = latest.id;
    if (!voiceModeRef.current) {
      if (autoSpeak) speak(latest.content, latest.id);
      return;
    }
    if (autoSpeak) speak(latest.content, latest.id, () => {
      if (voiceModeRef.current) startListening();
    });
    else startListening();
  }, [autoSpeak, messages, speak, startListening]);

  useEffect(() => {
    const requestId = location.state?.startVoiceAt;
    if (!requestId || requestId === lastVoiceRequestRef.current) return;
    lastVoiceRequestRef.current = requestId;
    startListening();
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, startListening]);

  return (
    <PageWrap>
      <SectionTitle icon={MessageCircle} title={t('Farm assistant')}>
        <button type="button" className="btn-ghost !px-3" aria-pressed={autoSpeak}
          onClick={() => {
            const next = !autoSpeak;
            localStorage.setItem('cg_tts_enabled', String(next));
            if (!next) stopSpeech();
            setAutoSpeak(next);
          }}>
          {autoSpeak ? <Volume2 size={15} /> : <VolumeX size={15} />}
          {autoSpeak ? t('Auto speech on') : t('Auto speech off')}
        </button>
        <button type="button" className="btn-ghost !px-3" disabled={!messages.length || busy}
          onClick={() => { stopListening(); stopSpeech(); setMessages([]); setError(''); setQuestion(''); setSpeechNotice(''); setVoiceNotice(''); }}>
          <Trash2 size={15} />{t('New chat')}
        </button>
      </SectionTitle>
      <div className="mx-auto max-w-4xl">
        <div className="glass flex min-h-[65vh] flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><Bot size={20} /></span>
            <div>
              <div className="font-semibold">{t('CropGuard farming chatbot')}</div>
              <div className="text-xs text-emerald-100/45">{t('Ask about crops, soil, irrigation, pests, livestock, and farm operations')}</div>
            </div>
          </div>
          {speechNotice && <p role="status" className="border-b border-amber-300/10 px-5 py-2 text-xs text-amber-100/70">{speechNotice}</p>}
          {voiceNotice && <p role="status" aria-live="polite" className="border-b border-emerald-300/10 px-5 py-2 text-xs text-emerald-100/70">{voiceNotice}</p>}

          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" aria-live="polite">
            {!messages.length && (
              <div className="mx-auto max-w-xl py-8 text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300"><Leaf size={26} /></div>
                <h2 className="text-lg font-semibold">{t('How can I help on your farm?')}</h2>
                <p className="mt-2 text-sm text-emerald-100/50">{t('I’ll keep answers focused on farming. For crop treatments, confirm advice with your local agricultural extension service and follow product labels.')}</p>
                <div className="mt-6 flex flex-col gap-2">
                  {STARTERS.map((starter) => (
                    <button key={starter} type="button" disabled={busy} onClick={() => submit(starter)}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-emerald-100/75 transition hover:border-emerald-400/30 hover:bg-white/[0.06] disabled:opacity-50">
                      {t(starter)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-400/15 text-emerald-300"><Bot size={16} /></span>}
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === 'user' ? 'bg-emerald-400/15 text-emerald-50' : 'border border-white/10 bg-black/20 text-emerald-50/90'}`}>
                  {message.content}
                  {message.inScope === false && <div className="mt-2 text-[11px] text-emerald-100/40">{t('This assistant only answers farming-related questions.')}</div>}
                  {message.role === 'assistant' && (
                    <div className="mt-2 flex justify-end">
                      {speakingId === message.id ? (
                        <button type="button" className="inline-flex items-center gap-1.5 text-xs text-emerald-200/70 hover:text-emerald-100" onClick={stopSpeech}>
                          <Square size={13} />{t('Stop speaking')}
                        </button>
                      ) : (
                        <button type="button" className="inline-flex items-center gap-1.5 text-xs text-emerald-200/70 hover:text-emerald-100" onClick={() => speak(message.content, message.id)}>
                          <Volume2 size={14} />{t('Replay response')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {message.role === 'user' && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-emerald-100/70"><User size={16} /></span>}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-3 text-sm text-emerald-100/50">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-400/15 text-emerald-300"><Bot size={16} /></span>
                {t('Thinking about your farming question…')}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-white/10 p-4">
            <ErrorBox error={error} />
            <form className="mt-2 flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); submit(); }}>
              <label className="sr-only" htmlFor="farm-question">{t('Your farming question')}</label>
              <textarea id="farm-question" className="input max-h-36 min-h-12 resize-y" rows={1} maxLength={2000}
                placeholder={t('Ask a farming question…')} value={question} disabled={busy}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submit();
                  }
                }} />
              <button type="button" className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl transition ${voiceMode ? 'bg-rose-400 text-rose-950' : 'border border-white/10 bg-white/5 text-emerald-100 hover:bg-white/10'}`}
                aria-label={voiceMode ? t('Stop voice conversation') : t('Speak your question')}
                title={voiceMode ? t('Stop voice conversation') : t('Speak your question')}
                disabled={busy && !voiceMode}
                onClick={voiceMode ? stopListening : startListening}>
                {voiceMode ? <MicOff size={17} /> : <Mic size={17} />}
              </button>
              <button type="submit" className="btn h-12 !px-4" disabled={!question.trim() || busy} aria-label={t('Send question')}>
                <Send size={17} />
              </button>
            </form>
            <p className="mt-2 text-center text-[10px] text-emerald-100/35">{t('AI can make mistakes. Don’t use chatbot responses as a substitute for local expert advice.')}</p>
          </div>
        </div>
      </div>
    </PageWrap>
  );
}
