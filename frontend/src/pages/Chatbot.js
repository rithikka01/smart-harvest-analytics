import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Send, Mic, Loader2, Bot, User, Volume2, Square, Trash2, Tractor } from 'lucide-react';
import { useFarm } from '@/contexts/FarmContext';
import { FarmSwitcher } from '@/components/FarmSwitcher';
import { browserSTTSupported, recognizeWithBrowser, transcribeWithWhisper, speak, stopSpeaking } from '@/lib/voice';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Chatbot = () => {
  const { t, i18n } = useTranslation();
  const { currentFarm } = useFarm();
  const lang = i18n.language;
  const [messages, setMessages] = useState([]);
  const [quick, setQuick] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const greeting = { role: 'assistant', content: t('chat.greeting') };

  const loadHistory = useCallback(async () => {
    try {
      const params = currentFarm ? { farm_id: currentFarm.id } : {};
      const res = await axios.get(`${BACKEND_URL}/api/chatbot/history`, { params });
      setMessages([greeting, ...res.data.map((m) => ({ role: m.role, content: m.content }))]);
    } catch (e) {
      setMessages([greeting]);
    }
  }, [currentFarm?.id, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/chatbot/quick-questions`, { params: { language: lang } }).then((r) => setQuick(r.data.questions)).catch(() => {});
  }, [lang]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => () => stopSpeaking(), []);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg) return;
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setInput('');
    setLoading(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/chatbot`, { message: msg, farm_id: currentFarm?.id || null, language: lang });
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.response }]);
    } catch (error) {
      toast.error(error.response?.data?.detail || t('chat.failed'));
      setMessages((prev) => [...prev, { role: 'assistant', content: t('chat.failed') }]);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setLoading(true);
        try {
          const text = await transcribeWithWhisper(blob, lang);
          setInput(text);
          toast.success(t('chat.voice_openai'));
        } catch (e) {
          if (browserSTTSupported()) {
            toast.message(t('chat.voice_browser'));
            try { setInput(await recognizeWithBrowser(lang)); } catch { toast.error(t('chat.voice_unsupported')); }
          } else {
            toast.error(e.response?.data?.detail || t('chat.voice_unsupported'));
          }
        } finally {
          setLoading(false);
        }
      };
      mr.start();
      setRecording(true);
    } catch (error) {
      if (browserSTTSupported()) {
        toast.message(t('chat.voice_browser'));
        setRecording(true);
        try { setInput(await recognizeWithBrowser(lang)); } catch { toast.error(t('chat.voice_unsupported')); }
        setRecording(false);
      } else {
        toast.error(t('chat.voice_unsupported'));
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) mediaRecorderRef.current.stop();
    setRecording(false);
  };

  const toggleSpeak = async (idx, text) => {
    if (speakingIdx === idx) { stopSpeaking(); setSpeakingIdx(null); return; }
    setSpeakingIdx(idx);
    try {
      const provider = await speak(text, lang);
      if (provider === 'browser') toast.message(t('chat.tts_browser'));
    } catch (e) {
      toast.error(t('common.unavailable'));
      setSpeakingIdx(null);
    }
  };

  const clearHistory = async () => {
    await axios.delete(`${BACKEND_URL}/api/chatbot/history`, { params: currentFarm ? { farm_id: currentFarm.id } : {} });
    setMessages([greeting]);
    toast.success(t('chat.cleared'));
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8 flex flex-col">
      <div className="bg-gradient-to-br from-primary to-green-600 text-white p-6 md:p-8">
        <div className="max-w-4xl mx-auto flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold mb-1" data-testid="chatbot-title">{t('chat.title')}</h1>
            <p className="text-white/90">{t('chat.subtitle')}</p>
            {currentFarm && (
              <p className="text-xs mt-2 inline-flex items-center gap-1 bg-white/15 rounded-full px-3 py-1" data-testid="chat-farm-context">
                <Tractor className="w-3.5 h-3.5" /> {t('chat.farm_context')}: {currentFarm.name}
              </p>
            )}
          </div>
          <FarmSwitcher light />
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8">
        <Card className="flex flex-col" style={{ minHeight: '60vh' }}>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: '55vh' }} data-testid="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`} data-testid={`message-${i}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${m.role === 'user' ? 'bg-primary' : 'bg-secondary'}`}>
                  {m.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                </div>
                <div className={`max-w-[80%] p-3 rounded-2xl whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-white' : 'bg-muted text-foreground'}`}>
                  {m.content}
                  {m.role === 'assistant' && (
                    <button onClick={() => toggleSpeak(i, m.content)} className="mt-2 flex items-center gap-1 text-xs text-primary font-semibold hover:underline" data-testid={`speak-button-${i}`}>
                      {speakingIdx === i ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      {speakingIdx === i ? t('chat.stop', 'Stop') : t('chat.listen')}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-secondary"><Bot className="w-5 h-5 text-white" /></div>
                <div className="bg-muted p-3 rounded-2xl"><Loader2 className="w-5 h-5 animate-spin" /></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardContent>

          <div className="px-4 pt-3 flex gap-2 overflow-x-auto" data-testid="quick-questions">
            {quick.map((q) => (
              <button key={q} onClick={() => send(q)} disabled={loading} className="flex-shrink-0 text-xs rounded-full border border-primary/40 text-primary px-3 py-1.5 hover:bg-primary/10 transition-colors" data-testid="quick-question">
                {q}
              </button>
            ))}
          </div>

          <div className="p-4 border-t mt-3">
            <div className="flex gap-2">
              <Button variant={recording ? 'destructive' : 'outline'} size="icon" className={`rounded-full h-12 w-12 flex-shrink-0 ${recording ? 'animate-pulse' : ''}`}
                onClick={recording ? stopRecording : startRecording} disabled={loading} title={recording ? t('chat.listening') : t('chat.speak')} data-testid="voice-record-button">
                <Mic className="w-5 h-5" />
              </Button>
              <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={recording ? t('chat.listening') : t('chat.placeholder')} disabled={loading} className="h-12" data-testid="chat-input" />
              <Button onClick={() => send()} disabled={loading || !input.trim()} className="rounded-full h-12 px-6" data-testid="send-message-button"><Send className="w-5 h-5" /></Button>
              <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 flex-shrink-0 text-muted-foreground" onClick={clearHistory} title={t('chat.clear')} data-testid="clear-history-button"><Trash2 className="w-5 h-5" /></Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Chatbot;
