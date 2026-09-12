import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const BCP47 = { en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', ml: 'ml-IN' };

export const browserSTTSupported = () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
export const browserTTSSupported = () => 'speechSynthesis' in window;

export const recognizeWithBrowser = (language) =>
  new Promise((resolve, reject) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return reject(new Error('unsupported'));
    const rec = new SR();
    rec.lang = BCP47[language] || 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => resolve(e.results[0][0].transcript);
    rec.onerror = (e) => reject(new Error(e.error));
    rec.onend = () => reject(new Error('no-speech'));
    rec.start();
    return rec;
  });

export const transcribeWithWhisper = async (blob, language) => {
  const fd = new FormData();
  fd.append('audio', blob, 'recording.webm');
  fd.append('language', language);
  const res = await axios.post(`${BACKEND_URL}/api/voice/transcribe`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data.text;
};

let currentAudio = null;

export const stopSpeaking = () => {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  if (browserTTSSupported()) window.speechSynthesis.cancel();
};

// Returns 'openai' | 'browser'. Throws if neither works.
export const speak = async (text, language) => {
  stopSpeaking();
  try {
    const res = await axios.post(`${BACKEND_URL}/api/voice/tts`, { text, language }, { responseType: 'blob', timeout: 20000 });
    const url = URL.createObjectURL(res.data);
    currentAudio = new Audio(url);
    await currentAudio.play();
    currentAudio.onended = () => URL.revokeObjectURL(url);
    return 'openai';
  } catch (e) {
    if (!browserTTSSupported()) throw e;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = BCP47[language] || 'en-IN';
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(language === 'en' ? 'en' : utter.lang.slice(0, 2)));
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
    return 'browser';
  }
};
