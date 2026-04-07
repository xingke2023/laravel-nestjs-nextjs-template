'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function SubtitlePage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login?redirect=/subtitle');
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
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f0f0f; color: #e0e0e0; height: 100vh; display: flex; flex-direction: column; }

        header { background: #1a1a1a; border-bottom: 1px solid #2a2a2a; padding: 14px 20px; display: flex; align-items: center; gap: 12px; }
        header h1 { font-size: 18px; font-weight: 600; color: #fff; }

        #status-dot { width: 10px; height: 10px; border-radius: 50%; background: #555; flex-shrink: 0; transition: background 0.3s; }
        #status-dot.connecting { background: #f59e0b; animation: pulse 1s infinite; }
        #status-dot.connected { background: #22c55e; }
        #status-dot.error { background: #ef4444; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

        #status-text { font-size: 13px; color: #888; margin-left: auto; }

        .controls { background: #1a1a1a; padding: 12px 20px; display: flex; gap: 10px; align-items: center; border-bottom: 1px solid #2a2a2a; flex-wrap: wrap; }
        select { background: #252525; color: #e0e0e0; border: 1px solid #333; border-radius: 6px; padding: 7px 12px; font-size: 14px; cursor: pointer; flex: 1; min-width: 200px; max-width: 380px; }
        select:focus { outline: none; border-color: #555; }
        button { padding: 7px 20px; border-radius: 6px; border: none; font-size: 14px; cursor: pointer; font-weight: 500; transition: background 0.2s; }
        #btn-connect { background: #2563eb; color: #fff; }
        #btn-connect:hover { background: #1d4ed8; }
        #btn-connect.active { background: #dc2626; }
        #btn-connect.active:hover { background: #b91c1c; }

        .lang-tabs { display: flex; gap: 6px; margin-left: auto; }
        .lang-tab { padding: 5px 12px; border-radius: 5px; border: 1px solid #333; background: #252525; color: #888; font-size: 12px; cursor: pointer; transition: all 0.2s; }
        .lang-tab.active { background: #2563eb; border-color: #2563eb; color: #fff; }

        .subtitle-area { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; }

        .segment { background: #1a1a1a; border-radius: 10px; padding: 14px 16px; border-left: 3px solid #2563eb; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

        .seg-original { font-size: 16px; color: #f0f0f0; line-height: 1.6; margin-bottom: 6px; }
        .seg-translation { font-size: 14px; color: #888; line-height: 1.5; }
        .seg-time { font-size: 11px; color: #444; margin-top: 6px; }

        .interim { background: #1a1a1a; border-radius: 10px; padding: 14px 16px; border-left: 3px solid #f59e0b; }
        .interim .seg-original { color: #f59e0b; }

        #empty-tip { text-align: center; color: #444; margin: auto; font-size: 15px; line-height: 2; }

        .event-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-top: 4px; }
        .badge-info { background: #1e3a5f; color: #60a5fa; }
        .badge-warn { background: #3b2a00; color: #f59e0b; }
        .badge-error { background: #3b0000; color: #f87171; }
      `}</style>

      <header>
        <div id="status-dot"></div>
        <h1>电台实时字幕</h1>
        <span id="status-text">未连接</span>
      </header>

      <div className="controls">
        <select id="station-select">
          <option value="">-- 选择电台 --</option>
        </select>
        <button id="btn-connect">连接</button>
        <div className="lang-tabs">
          <div className="lang-tab active" data-lang="original">原文</div>
          <div className="lang-tab" data-lang="translation">译文</div>
          <div className="lang-tab" data-lang="both">双语</div>
        </div>
      </div>

      <div className="subtitle-area" id="subtitle-area">
        <div id="empty-tip">选择电台后点击连接<br />实时字幕将显示在这里</div>
      </div>

      <SubtitleScript />
    </>
  );
}

function SubtitleScript() {
  useEffect(() => {
    const WS_URL = 'wss://radio.xingke888.com/centrifugo/connection/websocket';
    const API_URL = 'https://radio.xingke888.com/sse8';

    let ws: WebSocket | null = null;
    let currentStation: string | null = null;
    let msgId = 1;
    let displayMode = 'both';
    let segments: { text: string; translations: Record<string, string>; time: string }[] = [];
    const MAX_SEGMENTS = 50;

    const dot = document.getElementById('status-dot') as HTMLElement;
    const statusText = document.getElementById('status-text') as HTMLElement;
    const btnConnect = document.getElementById('btn-connect') as HTMLButtonElement;
    const stationSelect = document.getElementById('station-select') as HTMLSelectElement;
    const subtitleArea = document.getElementById('subtitle-area') as HTMLElement;
    const emptyTip = document.getElementById('empty-tip') as HTMLElement;

    // 加载电台列表
    fetch(API_URL + '/api/radios')
      .then(r => r.json())
      .then((data: { radios?: { id: string; name?: string; language?: string; targetLanguage?: string }[] }) => {
        if (data.radios) {
          data.radios.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.name || r.id;
            (opt as any).dataset.lang = r.language || 'en-US';
            (opt as any).dataset.targetLang = r.targetLanguage || 'zh-CN';
            stationSelect.appendChild(opt);
          });
        }
      })
      .catch(() => {
        const fallback = [
          { code: 'rthk_r1', name: '香港电台一' },
          { code: 'msnbc', name: 'MSNBC' },
          { code: 'cnnnews', name: 'CNN' },
          { code: 'bbcworldservice', name: 'BBC World Service' },
          { code: 'npr', name: 'NPR' },
        ];
        fallback.forEach(r => {
          const opt = document.createElement('option');
          opt.value = r.code;
          opt.textContent = r.name;
          stationSelect.appendChild(opt);
        });
      });

    // 语言模式切换
    document.querySelectorAll<HTMLElement>('.lang-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll<HTMLElement>('.lang-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        displayMode = tab.dataset.lang!;
        rerenderSegments();
      });
    });

    function setStatus(state: string, text: string) {
      dot.className = state;
      statusText.textContent = text;
    }

    function escHtml(str: string): string {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function buildSegmentEl(seg: { text: string; translations: Record<string, string>; time: string }): HTMLElement {
      const div = document.createElement('div');
      div.className = 'segment';
      const transText = Object.values(seg.translations).filter(Boolean).join(' / ');
      let html = '';
      if (displayMode === 'original' || displayMode === 'both') {
        html += `<div class="seg-original">${escHtml(seg.text)}</div>`;
      }
      if ((displayMode === 'translation' || displayMode === 'both') && transText) {
        html += `<div class="seg-translation">${escHtml(transText)}</div>`;
      }
      html += `<div class="seg-time">${seg.time}</div>`;
      div.innerHTML = html;
      return div;
    }

    let interimEl: HTMLElement | null = null;

    function showInterim(text: string) {
      if (!interimEl) {
        interimEl = document.createElement('div');
        interimEl.className = 'interim';
        interimEl.innerHTML = '<div class="seg-original"></div>';
        subtitleArea.appendChild(interimEl);
      }
      interimEl.querySelector<HTMLElement>('.seg-original')!.textContent = text;
      subtitleArea.scrollTop = subtitleArea.scrollHeight;
    }

    function addSegment(data: { text: string; translations?: Record<string, string> }) {
      if (interimEl) { interimEl.remove(); interimEl = null; }
      const seg = { text: data.text, translations: data.translations || {}, time: new Date().toLocaleTimeString() };
      segments.push(seg);
      if (segments.length > MAX_SEGMENTS) segments.shift();
      const el = buildSegmentEl(seg);
      subtitleArea.appendChild(el);
      subtitleArea.scrollTop = subtitleArea.scrollHeight;
      const all = subtitleArea.querySelectorAll('.segment');
      if (all.length > MAX_SEGMENTS) all[0].remove();
    }

    function rerenderSegments() {
      subtitleArea.querySelectorAll('.segment').forEach(e => e.remove());
      segments.forEach(seg => subtitleArea.appendChild(buildSegmentEl(seg)));
      subtitleArea.scrollTop = subtitleArea.scrollHeight;
    }

    function showBadge(text: string, type = 'info') {
      const wrap = document.createElement('div');
      wrap.className = 'event-badge-wrap';
      wrap.style.textAlign = 'center';
      wrap.innerHTML = `<span class="event-badge badge-${type}">${escHtml(text)}</span>`;
      subtitleArea.appendChild(wrap);
      subtitleArea.scrollTop = subtitleArea.scrollHeight;
    }

    function handleEvent(data: { event: string; text?: string; translations?: Record<string, string>; message?: string }) {
      const event = data.event;
      if (event === 'recognized') {
        if (emptyTip && emptyTip.parentNode) emptyTip.remove();
        addSegment(data as { text: string; translations?: Record<string, string> });
      } else if (event === 'recognizing') {
        showInterim(data.text || '');
      } else if (['reconnecting', 'started', 'stopped', 'streamEnded', 'streamError'].includes(event)) {
        showBadge(data.message || event, event === 'reconnecting' ? 'warn' : 'info');
      } else if (['audioSourceFailed', 'allKeysFailed'].includes(event)) {
        showBadge(data.message || event, 'error');
        setStatus('error', data.message || event);
      }
    }

    function disconnect() {
      if (ws) { ws.close(); ws = null; }
      setStatus('', '未连接');
      btnConnect.textContent = '连接';
      btnConnect.classList.remove('active');
    }

    function connect() {
      const code = stationSelect.value;
      if (!code) { alert('请先选择电台'); return; }
      currentStation = code;
      disconnect();
      segments = [];
      subtitleArea.innerHTML = '';
      subtitleArea.appendChild(emptyTip);
      emptyTip.textContent = '连接中...';

      setStatus('connecting', '连接中...');
      btnConnect.textContent = '断开';
      btnConnect.classList.add('active');

      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        ws!.send(JSON.stringify({ id: msgId++, connect: {} }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        // pong
        if (!msg || Object.keys(msg).length === 0) {
          ws!.send(JSON.stringify({}));
          return;
        }

        // 连接成功
        if (msg.connect !== undefined) {
          setStatus('connecting', '订阅频道...');
          ws!.send(JSON.stringify({ id: msgId++, subscribe: { channel: 'station:' + currentStation } }));
        }

        // 订阅成功
        if (msg.subscribe !== undefined) {
          setStatus('connected', '已连接 · ' + (stationSelect.options[stationSelect.selectedIndex]?.textContent || currentStation));
          if (emptyTip) emptyTip.textContent = '等待字幕...';
        }

        // 收到推送数据
        if (msg.push?.pub?.data) {
          handleEvent(msg.push.pub.data);
        }

        // 错误
        if (msg.error) {
          setStatus('error', '错误: ' + (msg.error.message || JSON.stringify(msg.error)));
        }
      };

      ws.onerror = () => setStatus('error', '连接错误');
      ws.onclose = () => {
        if (btnConnect.classList.contains('active')) {
          setStatus('error', '连接断开');
          btnConnect.textContent = '重连';
        }
      };
    }

    btnConnect.addEventListener('click', () => {
      if (btnConnect.classList.contains('active')) {
        disconnect();
      } else {
        connect();
      }
    });

    stationSelect.addEventListener('change', () => {
      if (ws) connect();
    });

    return () => {
      if (ws) ws.close();
    };
  }, []);

  return null;
}
