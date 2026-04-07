'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { useAuth } from '@/lib/auth-context';
import { nestjsClient } from '@/lib/api/client';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechSDK: any;
  }
}

interface SpeechKeyResponse {
  key: string;
  region: string;
}

interface GeminiResponse {
  answer: string;
}

export default function InterviewPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login?redirect=/interview');
    }
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#888' }}>
        Loading...
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://csspeechstorage.blob.core.windows.net/drop/1.49.0/RawJavaScriptSDK/microsoft.cognitiveservices.speech.sdk.bundle.js"
        strategy="afterInteractive"
        onLoad={() => {
          // 脚本加载完毕后触发 custom event，让 InterviewTool 感知到
          window.dispatchEvent(new Event('speechsdkloaded'));
        }}
      />
      <InterviewTool />
    </>
  );
}

function InterviewTool() {
  const [sdkReady, setSdkReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<{ text: string; type: '' | 'error' | 'ready' }>({ text: 'Loading SDK...', type: '' });
  const [enFinals, setEnFinals] = useState<string[]>([]);
  const [zhFinals, setZhFinals] = useState<string[]>([]);
  const [enInterim, setEnInterim] = useState('');
  const [zhInterim, setZhInterim] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognizerRef = useRef<any>(null);

  // Listen for SDK load event + poll as fallback
  useEffect(() => {
    const markReady = () => {
      if (window.SpeechSDK) {
        setSdkReady(true);
        setStatus({ text: 'Ready — click mic to start', type: '' });
      }
    };
    window.addEventListener('speechsdkloaded', markReady);
    const check = setInterval(() => {
      if (window.SpeechSDK) { markReady(); clearInterval(check); }
    }, 300);
    const timeout = setTimeout(() => {
      clearInterval(check);
      if (!window.SpeechSDK) setStatus({ text: 'SDK failed to load', type: 'error' });
    }, 20000);
    return () => {
      window.removeEventListener('speechsdkloaded', markReady);
      clearInterval(check);
      clearTimeout(timeout);
    };
  }, []);

  function getZh(translations: unknown): string {
    if (!translations) return '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = translations as any;
    if (typeof t.get === 'function') return t.get('zh-Hans') || t.get('zh') || '';
    return t['zh-Hans'] || t['zh'] || '';
  }

  const stopTranslation = useCallback(() => {
    const recognizer = recognizerRef.current;
    if (!recognizer) {
      setIsRunning(false);
      setStatus({ text: 'Stopped — click mic to restart', type: '' });
      return;
    }
    recognizer.stopContinuousRecognitionAsync(
      () => {
        recognizer.close();
        recognizerRef.current = null;
        setIsRunning(false);
        setEnInterim('');
        setZhInterim('');
        setStatus({ text: 'Stopped — click mic to restart', type: '' });
      },
      (err: string) => {
        recognizerRef.current = null;
        setIsRunning(false);
        setStatus({ text: 'Stop error: ' + err, type: 'error' });
      }
    );
  }, []);

  const startTranslation = useCallback(async () => {
    if (!window.SpeechSDK) return;
    setStatus({ text: 'Fetching config…', type: '' });

    let key: string, region: string;
    try {
      const data = await nestjsClient.get<SpeechKeyResponse>('/speech-key');
      key = data.key;
      region = data.region;
    } catch (e) {
      setStatus({ text: 'Config error: ' + (e instanceof Error ? e.message : e), type: 'error' });
      return;
    }

    try {
      const { SpeechSDK } = window;
      const speechConfig = SpeechSDK.SpeechTranslationConfig.fromSubscription(key, region);
      speechConfig.speechRecognitionLanguage = 'en-US';
      speechConfig.addTargetLanguage('zh-Hans');

      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new SpeechSDK.TranslationRecognizer(speechConfig, audioConfig);
      recognizerRef.current = recognizer;

      recognizer.recognizing = (_s: unknown, e: { result: { text: string; translations: unknown } }) => {
        setEnInterim(e.result.text || '');
        setZhInterim(getZh(e.result.translations));
      };

      recognizer.recognized = (_s: unknown, e: { result: { reason: number; text: string; translations: unknown } }) => {
        if (e.result.reason === SpeechSDK.ResultReason.TranslatedSpeech && e.result.text) {
          const en = e.result.text;
          const zh = getZh(e.result.translations);
          setEnFinals(prev => [...prev.slice(-29), en]);
          setZhFinals(prev => [...prev.slice(-29), zh]);
          setEnInterim('');
          setZhInterim('');
        }
      };

      recognizer.canceled = (_s: unknown, e: { reason: number; errorDetails: string }) => {
        const msg = e.reason === SpeechSDK.CancellationReason.Error
          ? 'Error: ' + e.errorDetails : 'Cancelled';
        setStatus({ text: msg, type: 'error' });
        stopTranslation();
      };

      recognizer.sessionStopped = () => { stopTranslation(); };

      recognizer.startContinuousRecognitionAsync(
        () => {
          setIsRunning(true);
          setStatus({ text: 'Listening…', type: 'ready' });
        },
        (err: string) => {
          setStatus({ text: 'Start failed: ' + err, type: 'error' });
          recognizerRef.current = null;
        }
      );
    } catch (e) {
      setStatus({ text: 'Init failed: ' + (e instanceof Error ? e.message : e), type: 'error' });
    }
  }, [stopTranslation]);

  const handleAiAnswer = useCallback(async () => {
    if (enFinals.length === 0) return;
    const lastThree = enFinals.slice(-3).join(' ');
    setAiLoading(true);
    setAiAnswer('');
    try {
      const data = await nestjsClient.post<GeminiResponse>('/gemini', { text: lastThree });
      setAiAnswer(data.answer || 'No response');
    } catch (e) {
      setAiAnswer('Request failed: ' + (e instanceof Error ? e.message : e));
    } finally {
      setAiLoading(false);
    }
  }, [enFinals]);

  const handleClear = () => {
    setEnFinals([]);
    setZhFinals([]);
    setEnInterim('');
    setZhInterim('');
    setAiAnswer('');
  };

  return (
    <div style={styles.body}>
      {/* Header */}
      <div style={styles.header}>
        <button
          style={{
            ...styles.micBtn,
            ...(isRunning ? styles.micBtnActive : {}),
            ...((!sdkReady) ? styles.micBtnDisabled : {}),
          }}
          disabled={!sdkReady}
          onClick={() => isRunning ? stopTranslation() : startTranslation()}
        >
          {isRunning ? '⏹' : '🎤'}
        </button>
        <div style={styles.headerTitle}>
          <h1 style={styles.h1}>英文面试实时翻译工具</h1>
          <p style={styles.subtitle}>Real-time English → Chinese translation &amp; AI answer assistant</p>
        </div>
        <div style={{ ...styles.statusBar, ...(status.type === 'error' ? styles.statusError : status.type === 'ready' ? styles.statusReady : {}) }}>
          {status.text}
        </div>
      </div>

      {/* Main layout */}
      <div style={styles.mainLayout}>
        {/* Left: EN + ZH */}
        <div style={styles.leftCol}>
          <div style={{ ...styles.panel, borderLeft: '3px solid #3b82f6' }}>
            <div style={{ ...styles.panelLabel, color: '#60a5fa' }}>🎙 English (interviewer)</div>
            <div style={styles.panelContent}>
              {enInterim && <div style={styles.interim}><span style={styles.num}>…</span>{enInterim}</div>}
              {enFinals.length === 0 && !enInterim
                ? <span style={styles.placeholder}>Speech recognition will appear here…</span>
                : [...enFinals].reverse().map((t, i) => (
                  <div key={i} style={{ ...styles.final, color: i % 2 === 0 ? '#f1f5f9' : '#94a3b8' }}>
                    <span style={styles.num}>{enFinals.length - i}</span>{t}
                  </div>
                ))
              }
            </div>
          </div>
          <div style={{ ...styles.panel, borderLeft: '3px solid #06b6d4' }}>
            <div style={{ ...styles.panelLabel, color: '#22d3ee' }}>🌐 中文翻译</div>
            <div style={styles.panelContent}>
              {zhInterim && <div style={{ ...styles.interim, color: '#7dd3fc' }}><span style={styles.num}>…</span>{zhInterim}</div>}
              {zhFinals.length === 0 && !zhInterim
                ? <span style={styles.placeholder}>中文翻译将显示在这里…</span>
                : [...zhFinals].reverse().map((t, i) => (
                  <div key={i} style={{ ...styles.final, color: i % 2 === 0 ? '#bfdbfe' : '#67e8f9' }}>
                    <span style={styles.num}>{zhFinals.length - i}</span>{t}
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        {/* Right: AI answer */}
        <div style={styles.rightCol}>
          <div style={styles.aiPanel}>
            <div style={styles.aiPanelLabel}>✨ AI Suggested Answer</div>
            <div style={styles.aiAnswer}>
              {aiLoading
                ? <span style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.9rem' }}>AI is thinking…</span>
                : aiAnswer
                  ? <span style={{ whiteSpace: 'pre-wrap' }}>{aiAnswer}</span>
                  : <span style={styles.placeholder}>点击「AI Answer」按钮，针对最新问题获取建议回答…</span>
              }
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div style={styles.actionBar}>
        <div style={styles.interviewTag}>🧑‍💼 Role: <span style={{ color: '#a78bfa', fontWeight: 600, marginLeft: 4 }}>Desktop Engineer</span></div>
        <div style={{ flex: 1 }} />
        <button style={styles.btnClear} onClick={handleClear}>🗑 清空</button>
        <button
          style={{ ...styles.btnAi, ...(enFinals.length === 0 || aiLoading ? styles.btnDisabled : {}) }}
          disabled={enFinals.length === 0 || aiLoading}
          onClick={handleAiAnswer}
        >
          ✨ AI Answer
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    background: '#0f172a',
    color: '#e2e8f0',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px 16px 80px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    width: '98%',
    marginBottom: 18,
  },
  headerTitle: { flex: 1 },
  h1: { fontSize: '1.15rem', fontWeight: 700, color: '#f1f5f9' },
  subtitle: { fontSize: '0.75rem', color: '#64748b', marginTop: 2 },
  micBtn: {
    width: 52, height: 52, borderRadius: '50%', border: 'none',
    background: '#3b82f6', color: 'white', fontSize: '1.4rem', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'background 0.2s',
  },
  micBtnActive: { background: '#ef4444' },
  micBtnDisabled: { background: '#334155', cursor: 'not-allowed' },
  statusBar: {
    fontSize: '0.75rem', padding: '5px 10px', borderRadius: 6,
    background: '#1e293b', color: '#94a3b8', flexShrink: 0,
  },
  statusError: { color: '#f87171', background: '#3b1c1c' },
  statusReady: { color: '#34d399', background: '#0f2d20' },
  mainLayout: { display: 'flex', gap: 14, width: '98%', flex: 1 },
  leftCol: { display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 0 },
  rightCol: { display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 0 },
  panel: {
    background: '#1e293b', borderRadius: 12, padding: '14px 16px',
    display: 'flex', flexDirection: 'column',
  },
  panelLabel: {
    fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.1em', marginBottom: 10, flexShrink: 0,
  },
  panelContent: { fontSize: '1rem', lineHeight: 1.75, overflowY: 'auto', height: 200 },
  interim: { color: '#64748b', fontStyle: 'italic' },
  final: { color: '#f1f5f9' },
  num: {
    display: 'inline-block', minWidth: '1.8em', marginRight: 6,
    color: '#334155', fontSize: '0.75rem', textAlign: 'right', userSelect: 'none',
  },
  placeholder: { color: '#334155', fontSize: '0.88rem' },
  aiPanel: {
    background: '#1a1230', borderRadius: 12, borderLeft: '3px solid #7c3aed',
    padding: '14px 16px', flex: 1, overflowY: 'auto', minHeight: 160,
  },
  aiPanelLabel: {
    fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.1em', color: '#a78bfa', marginBottom: 10,
  },
  aiAnswer: { fontSize: '1.05rem', lineHeight: 1.85, color: '#e2e8f0' },
  actionBar: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: '#0f172a', borderTop: '1px solid #1e293b',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 12, padding: '12px 20px', zIndex: 100,
  },
  interviewTag: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    background: '#1e293b', border: '1px solid #334155', borderRadius: 20,
    padding: '4px 12px', fontSize: '0.72rem', color: '#64748b',
  },
  btnClear: {
    padding: '9px 20px', borderRadius: 8, border: '1px solid #334155',
    fontSize: '0.85rem', cursor: 'pointer', background: '#1e293b', color: '#94a3b8',
    whiteSpace: 'nowrap',
  },
  btnAi: {
    padding: '9px 20px', borderRadius: 8, border: 'none',
    fontSize: '0.85rem', cursor: 'pointer', background: '#7c3aed', color: 'white',
    whiteSpace: 'nowrap',
  },
  btnDisabled: { background: '#334155', cursor: 'not-allowed' },
};
