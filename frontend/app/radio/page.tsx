'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { useAuth } from '@/lib/auth-context';

export default function RadioPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const initialized = useRef(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login?redirect=/radio');
    }
  }, [loading, isAuthenticated, router]);

  const openid = user?.id?.toString() ?? '';
  const issub = 'false';

  if (loading || !isAuthenticated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#888' }}>
        Loading...
      </div>
    );
  }

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/hls.js@latest" strategy="beforeInteractive" />
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif;
          background-color: #f8f9fa;
          color: #333;
          -webkit-font-smoothing: antialiased;
          line-height: 1.5;
        }
        .app-container { max-width: 800px; height: 100dvh; margin: 0 auto; display: flex; flex-direction: column; overflow: hidden; }
        .section { flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 2px 8px 4px; }
        .card:first-child { flex-shrink: 0; }
        .card:nth-child(2) { flex: 1; display: flex; flex-direction: column; overflow: hidden; margin-bottom: 0; }
        .card { background-color: transparent; border-radius: 0; padding: 0; margin-bottom: 8px; box-shadow: none; }
        .station-container { display: flex; overflow-x: auto; scroll-behavior: smooth; padding: 10px 0; margin-bottom: 10px; -webkit-overflow-scrolling: touch; }
        .station-item { flex: 0 0 auto; min-width: 80px; text-align: center; margin-right: 15px; padding: 12px 8px; border-radius: 12px; background-color: #f0f5ff; border: 2px solid transparent; cursor: pointer; transition: all 0.3s ease; position: relative; }
        .station-item.active { border-color: #1890ff; background-color: #e6f7ff; box-shadow: 0 2px 8px rgba(24,144,255,0.2); }
        .station-item:hover .station-icon { transform: scale(1.05); }
        .station-icon { width: 78px; height: 78px; border-radius: 50%; background-color: #1890ff; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; margin: 0 auto 8px; overflow: hidden; position: relative; }
        .station-icon img { width: 100%; height: 100%; object-fit: cover; }
        .station-time { position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%); font-size: 10px; color: white; font-weight: 600; background-color: rgba(0,0,0,0.7); padding: 2px 6px; border-radius: 8px; white-space: nowrap; z-index: 10; display: none; }
        .station-item.playing .station-time { display: block; }
        .station-item:nth-child(2) .station-icon { background-color: #fa8c16; }
        .station-item:nth-child(3) .station-icon { background-color: #52c41a; }
        .station-item:nth-child(4) .station-icon { background-color: #722ed1; }
        .station-item:nth-child(5) .station-icon { background-color: #eb2f96; }
        .station-name { font-size: 13px; white-space: nowrap; }
        .play-mini-button { position: absolute; top: 30%; left: 30%; width: 40%; height: 40%; border-radius: 50%; color: rgb(247,243,243); display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer; opacity: 0.8; transition: background-color 0.3s ease; }
        .station-icon:hover .play-mini-button { opacity: 1; background-color: rgba(0,0,0,0.7); }
        .station-item:active .play-mini-button { opacity: 1; background-color: rgba(0,0,0,0.7); }
        .station-item.playing .play-mini-button { opacity: 1; background-color: rgba(0,0,0,0.7); }
        .player-time { display: none; }
        .status-box { padding: 12px 16px; border-radius: 8px; font-size: 14px; margin-bottom: 20px; background-color: #f0f5ff; color: #1890ff; display: flex; align-items: center; }
        .status-box::before { content: "📻"; margin-right: 8px; }
        .transcript-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #f0f0f0; }
        .transcript-title { font-size: 16px; display: flex; align-items: center; }
        .transcript-buttons { display: flex; align-items: center; }
        .fullscreen-button { background: none; border: none; color: #1890ff; font-size: 14px; font-weight: 500; cursor: pointer; margin-right: 10px; padding: 4px 8px; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; border-radius: 4px; }
        .fullscreen-button:hover { transform: scale(1.05); background: #e6f7ff; }
        .settings-panel { position: fixed; top: 60px; right: 20px; background: white; border: 1px solid #d9d9d9; border-radius: 8px; padding: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1001; min-width: 250px; }
        .settings-panel h3 { margin: 0 0 12px 0; font-size: 16px; color: #333; }
        .settings-row { margin-bottom: 12px; }
        .settings-row label { display: block; margin-bottom: 6px; font-size: 14px; color: #666; }
        .settings-row input[type="range"] { width: 100%; margin-bottom: 4px; }
        .settings-row .value-display { text-align: center; font-size: 14px; color: #1890ff; font-weight: 500; }
        .settings-close { position: absolute; top: 8px; right: 8px; background: none; border: none; font-size: 20px; color: #999; cursor: pointer; padding: 4px; line-height: 1; }
        .settings-close:hover { color: #333; }
        .dark-mode { background-color: #1a1a1a !important; color: #e0e0e0 !important; }
        .dark-mode .subtitle-block { background-color: #2a2a2a !important; border-left-color: #52c97a !important; }
        .dark-mode .english-text { color: #ffffff !important; }
        .dark-mode .english-text .character { color: #ffffff !important; }
        .dark-mode .english-text .jyutping { color: #52c97a !important; }
        .dark-mode .chinese-text { color: #52c97a !important; }
        .dark-mode .transcript-header { border-bottom: 1px solid #3a3a3a; }
        .dark-mode .settings-panel { background-color: #2a2a2a !important; border-color: #3a3a3a !important; color: #e0e0e0 !important; }
        .dark-mode .settings-panel h3 { color: #e0e0e0 !important; }
        .dark-mode .settings-panel label { color: #b0b0b0 !important; }
        .dark-mode .settings-close { color: #999 !important; }
        .dark-mode .settings-close:hover { color: #e0e0e0 !important; }
        .mode-toggle { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #f0f0f0; border-radius: 20px; cursor: pointer; user-select: none; transition: background 0.3s; }
        .dark-mode .mode-toggle { background: #3a3a3a; }
        .mode-toggle-label { font-size: 14px; margin-right: 8px; }
        .mode-toggle-switch { position: relative; width: 44px; height: 24px; background: #ccc; border-radius: 12px; transition: background 0.3s; }
        .mode-toggle-switch.active { background: #4a9eff; }
        .mode-toggle-slider { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; background: white; border-radius: 50%; transition: transform 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .mode-toggle-switch.active .mode-toggle-slider { transform: translateX(20px); }
        .fullscreen-transcript { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: white; z-index: 1000; padding: 20px; box-sizing: border-box; display: flex; flex-direction: column; }
        .fullscreen-transcript .transcript-header { margin-bottom: 20px; }
        .fullscreen-transcript .transcript-container { flex: 1; max-height: none; overflow-y: auto; font-size: 18px; line-height: 1.8; }
        .transcript-container { flex: 1; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #d9d9d9 #f0f0f0; padding-right: 8px; min-height: 0; }
        .transcript-container::-webkit-scrollbar { width: 6px; }
        .transcript-container::-webkit-scrollbar-track { background: #f0f0f0; border-radius: 3px; }
        .transcript-container::-webkit-scrollbar-thumb { background-color: #d9d9d9; border-radius: 3px; }
        .subtitle-block { margin-bottom: 6px; padding: 12px; border-left: 4px solid #52c97a; background-color: #f9f9f9; border-radius: 4px; }
        .english-text { color: #000000; margin-bottom: 8px; font-size: 22px; line-height: 1.6; font-weight: 400; }
        .english-text .character { color: #000000; }
        .english-text .jyutping { color: #52c97a; }
        .chinese-text { color: #52c97a; margin-bottom: 0; font-size: 20px; line-height: 1.5; }
        .interim-text { min-height: 60px; font-size: 22px; color: #666; background-color: #f9f9f9; padding: 12px; border-radius: 6px; margin-top: 16px; }
        .footer { padding: 16px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #999; text-align: center; background-color: white; }
        .footer p { margin: 4px 0; }
        .notification { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background-color: rgba(0,0,0,0.75); color: white; padding: 10px 20px; border-radius: 6px; font-size: 14px; z-index: 1000; max-width: 90%; text-align: center; animation: fadeInOut 3s ease forwards; }
        @keyframes fadeInOut { 0%{opacity:0;transform:translate(-50%,-20px)} 15%{opacity:1;transform:translate(-50%,0)} 85%{opacity:1;transform:translate(-50%,0)} 100%{opacity:0;transform:translate(-50%,-20px)} }
        .jyutping-container { display: flex; flex-wrap: wrap; margin-bottom: 10px; }
        .char-jyutping-pair { display: inline-flex; flex-direction: column; align-items: center; margin-right: 2px; margin-bottom: 5px; }
        .jyutping { font-size: 14px; color: #52c97a; text-align: center; line-height: 1.2; }
        .character { font-size: 18px; text-align: center; line-height: 1.2; }
      `}</style>

      <meta id="metadatas" data-openid={openid} data-issub={issub} />

      <div className="app-container">
        <div className="max-w-md mx-auto" style={{ marginBottom: 0, padding: 0, width: '100%', flexShrink: 0 }}>
          <div className="text-white p-4 shadow-lg text-center" style={{ background: '#1a73e8', marginBottom: 0, borderRadius: 0 }}>
            <div className="text-3xl text-gray-800 tracking-wide text-center" style={{ color: 'white', textAlign: 'center', fontWeight: 600 }}>央广英文台同步双语字幕</div>
          </div>
        </div>

        <section className="section">
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            <div className="transcript-header" style={{ flexShrink: 0 }}>
              <div className="transcript-title">实时字幕</div>
              <div className="transcript-buttons">
                <button id="fullscreenBtn" className="fullscreen-button">[放大]</button>
              </div>
            </div>
            <div className="transcript-container" style={{ flex: 1, minHeight: 0 }}>
              <div id="transcriptText"></div>
            </div>
            <div id="interimText" style={{ height: 120, flexShrink: 0, overflowY: 'auto', fontSize: 22, color: '#333', padding: '12px 16px', background: '#f0faf3', border: '2px solid #52c97a', borderRadius: 8, marginTop: 8 }}>
              Select a station and press play to begin...
            </div>
          </div>

          <div className="card" style={{ flexShrink: 0, marginTop: 'auto', marginBottom: 0, paddingBottom: 0, paddingTop: 12, borderTop: '1px solid #eee' }}>
            <div className="station-container">
              <div className="station-item active" data-station-code="rthk_r1" data-use-centrifugo="true" data-stream="https://stm.rthk.hk/radio1">
                <div className="station-icon" style={{ borderRadius: '15%', width: 75, height: 75 }}>
                  <img src="/images/Radio_Television_Hong_Kong_Logo.svg.png" alt="RTHK" />
                  <div className="play-mini-button">▶</div>
                  <div className="station-time">00:00</div>
                </div>
                <div className="station-name">香港电台I</div>
              </div>
              <div className="station-item active" data-station-code="rthk_r2" data-use-centrifugo="true" data-stream="https://stm.rthk.hk/radio2">
                <div className="station-icon" style={{ borderRadius: '15%', width: 75, height: 75 }}>
                  <img src="/images/Radio_Television_Hong_Kong_Logo.svg.png" alt="RTHK" />
                  <div className="play-mini-button">▶</div>
                  <div className="station-time">00:00</div>
                </div>
                <div className="station-name">香港电台II</div>
              </div>
              <div className="station-item active" data-station-code="cri_english" data-use-centrifugo="true" data-stream="https://sk.cri.cn/am846.m3u8">
                <div className="station-icon">
                  <img src="https://cnvod.cnr.cn/audio2017/ondemand/media/1100/20211222/1640137536123.jpg" alt="CGTN" />
                  <div className="play-mini-button">▶</div>
                  <div className="station-time">00:00</div>
                </div>
                <div className="station-name">央广英语资讯</div>
              </div>
              <div className="station-item" data-url="https://radio.xingke888.com/sse7/events" data-stream="https://radio.xingke888.com/stream?keyid=r6">
                <div className="station-icon">
                  English
                  <div className="play-mini-button">▶</div>
                  <div className="station-time">00:00</div>
                </div>
                <div className="station-name">English1</div>
              </div>
              <div className="station-item active" data-url="https://radio.xingke888.com/sse3/events" data-stream="https://stm.rthk.hk/radio3">
                <div className="station-icon" style={{ borderRadius: '15%', width: 75, height: 75 }}>
                  <img src="/images/Radio_Television_Hong_Kong_Logo.svg.png" alt="RTHK" />
                  <div className="play-mini-button">▶</div>
                  <div className="station-time">00:00</div>
                </div>
                <div className="station-name">香港电台III</div>
              </div>
              <div className="station-item active" data-url="https://radio.xingke888.com/sse4/events" data-stream="https://stm.rthk.hk/radio4">
                <div className="station-icon" style={{ borderRadius: '15%', width: 75, height: 75 }}>
                  <img src="/images/Radio_Television_Hong_Kong_Logo.svg.png" alt="RTHK" />
                  <div className="play-mini-button">▶</div>
                  <div className="station-time">00:00</div>
                </div>
                <div className="station-name">香港电台IV</div>
              </div>
              <div className="station-item active" data-url="https://radio.xingke888.com/sse5/events" data-stream="https://stm.rthk.hk/radio5">
                <div className="station-icon" style={{ borderRadius: '15%', width: 75, height: 75 }}>
                  <img src="/images/Radio_Television_Hong_Kong_Logo.svg.png" alt="RTHK" />
                  <div className="play-mini-button">▶</div>
                  <div className="station-time">00:00</div>
                </div>
                <div className="station-name">香港电台V</div>
              </div>
            </div>

            <div id="playerTime" className="player-time">00:00</div>
            <audio id="audioPlayer" hidden />
          </div>

          <div id="status" className="status-box" style={{ display: 'none' }}>
            Ready to connect. Select a station to begin.
          </div>
        </section>

        <footer className="footer" style={{ display: 'none' }}>
          <p id="connectionInfo" style={{ display: 'none' }}>Not connected</p>
          <p id="connectionTime">-</p>
        </footer>
      </div>

      <RadioScript />
    </>
  );
}

// 将所有 vanilla JS 封装为独立组件，在 useEffect 中初始化
function RadioScript() {
  useEffect(() => {
    const API_BASE_URL = 'https://radio.xingke888.com/sse8';
    const CENTRIFUGO_SSE_URL = 'https://radio.xingke888.com/centrifugo/connection/uni_sse';

    const status = document.getElementById('status') as HTMLElement;
    const interimText = document.getElementById('interimText') as HTMLElement;
    const transcriptText = document.getElementById('transcriptText') as HTMLElement;
    const audioPlayer = document.getElementById('audioPlayer') as HTMLAudioElement;
    const connectionInfo = document.getElementById('connectionInfo') as HTMLElement;
    const connectionTime = document.getElementById('connectionTime') as HTMLElement;
    const stationItems = document.querySelectorAll<HTMLElement>('.station-item');
    const miniPlayButtons = document.querySelectorAll<HTMLElement>('.play-mini-button');
    const transcriptContainer = document.querySelector<HTMLElement>('.transcript-container')!;

    // Auto scroll
    const scrollObserver = new MutationObserver(() => {
      transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
    });
    scrollObserver.observe(transcriptText, { childList: true, subtree: true, characterData: true });

    const interimObserver = new MutationObserver(() => {
      interimText.scrollTop = interimText.scrollHeight;
    });
    interimObserver.observe(interimText, { childList: true, subtree: true, characterData: true });

    let eventSource: EventSource | null = null;
    let connectionStartTime: Date | null = null;
    let connectionTimer: ReturnType<typeof setInterval> | null = null;
    let isPlaying = false;
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    let hlsPlayer: any = null;
    let currentStation: HTMLElement | null = document.querySelector('.station-item.active');
    let clientId: string | null = null;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    let subscribedFlag = false;

    const displayedMessages = new Set<string>();

    const startProgressTimer = () => {
      if (progressTimer) clearInterval(progressTimer);
      let seconds = 0;
      progressTimer = setInterval(() => {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const timeText = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
        if (currentStation) {
          const stationTimeEl = currentStation.querySelector<HTMLElement>('.station-time');
          if (stationTimeEl) stationTimeEl.textContent = timeText;
        }
      }, 1000);
    };

    const stopProgressTimer = () => {
      if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
      document.querySelectorAll<HTMLElement>('.station-time').forEach(el => { el.textContent = '00:00'; });
    };

    const updateConnectionTime = () => {
      if (!connectionStartTime) return;
      const diff = Date.now() - connectionStartTime.getTime();
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      connectionTime.textContent = `Connected for: ${minutes}m ${String(seconds).padStart(2, '0')}s`;
    };

    const showNotification = (message: string) => {
      const existing = document.querySelector('.notification');
      if (existing) existing.remove();
      const notification = document.createElement('div');
      notification.className = 'notification';
      notification.textContent = message;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 3000);
    };

    function formatWithJyutping(text: string): string {
      if (!text) return '';
      const regex = /([^\(]+)\(([^\)]+)\)/g;
      const matches: { character: string; jyutping: string }[] = [];
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({ character: match[1], jyutping: match[2] });
      }
      if (matches.length === 0) return text;
      let html = '<div class="jyutping-container">';
      for (const item of matches) {
        html += `<span class="char-jyutping-pair"><span class="jyutping">${item.jyutping}</span><span class="character">${item.character}</span></span>`;
      }
      html += '</div>';
      return html;
    }

    const initHlsPlayer = (src: string) => {
      if (hlsPlayer) { hlsPlayer.destroy(); hlsPlayer = null; }
      const Hls = (window as any).Hls;
      if (src.includes('.m3u8') && Hls && Hls.isSupported()) {
        hlsPlayer = new Hls();
        hlsPlayer.loadSource(src);
        hlsPlayer.attachMedia(audioPlayer);
        hlsPlayer.on(Hls.Events.ERROR, (_event: any, data: any) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR: hlsPlayer.startLoad(); break;
              case Hls.ErrorTypes.MEDIA_ERROR: hlsPlayer.recoverMediaError(); break;
              default: showNotification('Audio stream failed to load'); audioPlayer.src = src; break;
            }
          }
        });
      } else {
        audioPlayer.src = src;
        audioPlayer.load();
      }
    };

    const sendHeartbeat = async (stationCode: string) => {
      if (!clientId) return;
      try {
        const resp = await fetch(`${API_BASE_URL}/api/client/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: clientId, channel: `station:${stationCode}` }),
        });
        const result = await resp.json();
        if (!result.success) console.warn('Heartbeat response abnormal:', result);
      } catch (err) {
        console.error('Failed to send heartbeat:', err);
      }
    };

    const startHeartbeat = (stationCode: string) => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      sendHeartbeat(stationCode);
      heartbeatInterval = setInterval(() => sendHeartbeat(stationCode), 30000);
    };

    const subscribeToStation = async (stationCode: string) => {
      const resp = await fetch(`${API_BASE_URL}/sse/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ station_code: stationCode, client_id: clientId }),
      });
      const result = await resp.json();
      console.log('Station subscribed:', result.message);
    };

    const connectViaCentrifugo = async (stationCode: string, stationName: string) => {
      try {
        if (eventSource) { eventSource.close(); eventSource = null; }
        subscribedFlag = false;
        if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
        if (connectionTimer) { clearInterval(connectionTimer); connectionTimer = null; }
        if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
        if (hlsPlayer) { hlsPlayer.destroy(); hlsPlayer = null; }
        if (audioPlayer.src) { audioPlayer.pause(); audioPlayer.src = ''; }

        clientId = null;
        isPlaying = false;

        stationItems.forEach(item => {
          item.classList.remove('playing');
          const btn = item.querySelector<HTMLElement>('.play-mini-button');
          if (btn) btn.textContent = '▶';
        });

        if (currentStation) {
          currentStation.classList.add('playing');
          const btn = currentStation.querySelector<HTMLElement>('.play-mini-button');
          if (btn) btn.textContent = '⌛';

          const streamUrl = currentStation.getAttribute('data-stream');
          if (streamUrl) {
            initHlsPlayer(streamUrl);
            audioPlayer.play().then(() => {
              isPlaying = true;
              if (btn) btn.textContent = '❚❚';
              startProgressTimer();
            }).catch(err => {
              console.error('Audio playback failed:', err);
              showNotification('Audio playback failed, please manually click play');
            });
          }
        }

        const resp = await fetch(`${API_BASE_URL}/sse/connect?station_code=${stationCode}`);
        if (!resp.ok) throw new Error('Failed to get connection info');
        const data = await resp.json();

        const sseUrl = new URL(CENTRIFUGO_SSE_URL);
        sseUrl.searchParams.append('cf_connect', JSON.stringify({ token: data.token }));
        eventSource = new EventSource(sseUrl.toString());

        eventSource.onmessage = (event) => {
          if (event.data === '{}') return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.connect) {
              clientId = msg.connect.client;
              status.textContent = `Connected to ${stationName}`;
              connectionStartTime = new Date();
              updateConnectionTime();
              connectionTimer = setInterval(updateConnectionTime, 1000);
              if (!subscribedFlag) {
                subscribedFlag = true;
                subscribeToStation(stationCode)
                  .then(() => startHeartbeat(stationCode))
                  .catch(err => { console.error('Subscription failed:', err); subscribedFlag = false; });
              }
              showNotification(`Successfully connected to ${stationName}`);
            }
            if (msg.pub?.data) {
              const pushData = msg.pub.data;
              if (pushData.event === 'recognized') {
                const translation = pushData.translations?.['zh-CN'] ?? '';
                const formattedText = pushData.text ? formatWithJyutping(pushData.text) : '';
                interimText.innerHTML = '';
                const MAX = 50000;
                if (translation) {
                  transcriptText.innerHTML += `<div class="subtitle-block"><div class="english-text">${formattedText}</div><div class="chinese-text">${translation}</div></div>`;
                } else {
                  transcriptText.innerHTML += `<div class="subtitle-block"><div class="english-text">${formattedText}</div></div>`;
                }
                if (transcriptText.innerHTML.length > MAX) {
                  const idx = transcriptText.innerHTML.indexOf('</div>', transcriptText.innerHTML.length - MAX);
                  transcriptText.innerHTML = idx !== -1 ? transcriptText.innerHTML.substring(idx + 6) : transcriptText.innerHTML.substring(transcriptText.innerHTML.length - MAX);
                }
                transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
              } else if (pushData.event === 'recognizing') {
                const formattedText = pushData.text ? formatWithJyutping(pushData.text) : '';
                const translation = pushData.translations?.['zh-CN'] ?? '';
                interimText.innerHTML = formattedText + (translation ? '<br>' + translation : '');
              } else if (pushData.event === 'started') {
                status.textContent = `${stationName} recognition started, waiting for subtitles...`;
                interimText.innerHTML = '<span style="color:#999">Waiting for radio signal...</span>';
              } else if (pushData.event === 'reconnecting') {
                status.textContent = pushData.isAudioSourceError
                  ? `⚠️ Audio source failed, retrying (${pushData.retryCount}/${pushData.maxRetries})...`
                  : `🔄 Reconnecting (${pushData.retryCount}/${pushData.maxRetries})...`;
              } else if (pushData.event === 'audioSourceFailed') {
                status.textContent = `❌ ${pushData.message}`;
                showNotification('Audio source connection failed');
              }
            }
          } catch (err) { console.error('Failed to parse message:', err); }
        };

        eventSource.onerror = () => {
          status.textContent = 'SSE connection error. Audio will continue to play.';
          if (eventSource?.readyState === EventSource.CLOSED) { eventSource.close(); eventSource = null; }
        };
      } catch (err: any) {
        console.error('Connection failed:', err);
        status.textContent = `Connection failed: ${err.message}`;
        showNotification(`Connection failed: ${err.message}`);
        if (currentStation) {
          const btn = currentStation.querySelector<HTMLElement>('.play-mini-button');
          if (btn) btn.textContent = '▶';
          currentStation.classList.remove('playing');
        }
      }
    };

    const connectToServer = async () => {
      if (!currentStation) { showNotification('Please select a station first'); return; }
      displayedMessages.clear();
      transcriptText.innerHTML = '';
      if (eventSource) { eventSource.close(); eventSource = null; }
      if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }

      const stationName = currentStation.querySelector<HTMLElement>('.station-name')?.textContent ?? '';
      const useCentrifugo = currentStation.getAttribute('data-use-centrifugo') === 'true';
      const stationCode = currentStation.getAttribute('data-station-code');

      if (useCentrifugo && stationCode) {
        await connectViaCentrifugo(stationCode, stationName);
        return;
      }

      const serverUrl = currentStation.getAttribute('data-url');
      const streamUrl = currentStation.getAttribute('data-stream');

      stationItems.forEach(item => {
        item.classList.remove('playing');
        const btn = item.querySelector<HTMLElement>('.play-mini-button');
        if (btn) btn.textContent = '▶';
      });
      currentStation.classList.add('playing');
      const currentButton = currentStation.querySelector<HTMLElement>('.play-mini-button')!;
      currentButton.textContent = '⌛';

      if (streamUrl) initHlsPlayer(streamUrl);

      audioPlayer.play().then(() => {
        isPlaying = true;
        currentButton.textContent = '❚❚';
        startProgressTimer();

        if (!serverUrl) {
          status.textContent = `Playing ${stationName} (audio only)`;
          connectionStartTime = new Date();
          updateConnectionTime();
          connectionTimer = setInterval(updateConnectionTime, 1000);
          interimText.innerHTML = '<span style="color:#999">This station does not support captions</span>';
          showNotification(`Playing ${stationName} (audio only)`);
          return;
        }

        eventSource = new EventSource(serverUrl);
        let retryCount = 0;
        const maxRetries = 3;

        eventSource.onopen = () => {
          status.textContent = 'Connected to radio signal with captions';
          retryCount = 0;
          interimText.innerHTML = '<span style="color:#999">Waiting for radio signal...</span>';
          if (!transcriptText.textContent?.trim()) {
            transcriptText.innerHTML = '<span style="color:#999">Transcription will appear here...</span>';
          }
          connectionStartTime = new Date();
          updateConnectionTime();
          connectionTimer = setInterval(updateConnectionTime, 1000);
          showNotification(`Successfully connected to ${stationName} with captions`);
        };

        eventSource.addEventListener('recognizing', (event) => {
          try {
            const data = JSON.parse((event as MessageEvent).data);
            const formattedText = data.text ? formatWithJyutping(data.text) : '';
            interimText.innerHTML = formattedText + '<br>' + (data.translations || '');
          } catch (e) { console.error('Error parsing recognition result:', e); }
        });

        eventSource.addEventListener('recognized', (event) => {
          try {
            const data = JSON.parse((event as MessageEvent).data);
            const formattedText = data.text ? formatWithJyutping(data.text) : '';
            const translation = data.translations?.['zh-CN'] ?? data.translations ?? '';
            interimText.innerHTML = '';
            if (translation) {
              transcriptText.innerHTML += `<div class="subtitle-block"><div class="english-text">${formattedText}</div><div class="chinese-text">${translation}</div></div>`;
            } else {
              transcriptText.innerHTML += `<div class="subtitle-block"><div class="english-text">${formattedText}</div></div>`;
            }
          } catch (e) { console.error('Error parsing recognized result:', e); }
        });

        eventSource.onerror = () => {
          status.textContent = 'Caption service error. Audio will continue to play.';
          if (retryCount < maxRetries) {
            retryCount++;
            showNotification(`Caption service error, retry attempt ${retryCount}/${maxRetries}`);
            if (eventSource) { eventSource.close(); eventSource = null; }
            setTimeout(() => {
              if (!eventSource && serverUrl) {
                eventSource = new EventSource(serverUrl);
              }
            }, 2000);
          } else {
            status.textContent = 'Caption service unavailable. Audio will continue to play.';
            interimText.innerHTML = '<span style="color:#ff4d4f">Caption service unavailable</span>';
            if (eventSource) { eventSource.close(); eventSource = null; }
          }
        };
      }).catch(err => {
        console.error('Failed to play audio:', err);
        showNotification('Failed to play audio, please check permissions');
        currentButton.textContent = '▶';
        currentStation!.classList.remove('playing');
      });
    };

    const disconnectFromServer = async () => {
      if (clientId && currentStation) {
        const stationCode = currentStation.getAttribute('data-station-code');
        if (stationCode) {
          try {
            await fetch(`${API_BASE_URL}/api/client/disconnect`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ client_id: clientId, channel: `station:${stationCode}` }),
            });
          } catch (err) { console.error('Failed to notify server:', err); }
        }
      }
      if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
      if (currentStation) {
        currentStation.classList.remove('playing');
        const btn = currentStation.querySelector<HTMLElement>('.play-mini-button');
        if (btn) btn.textContent = '▶';
      }
      if (eventSource) { eventSource.close(); eventSource = null; }
      if (hlsPlayer) { hlsPlayer.destroy(); hlsPlayer = null; }
      audioPlayer.pause();
      audioPlayer.src = '';
      audioPlayer.load();
      isPlaying = false;
      clientId = null;
      stopProgressTimer();
      status.textContent = 'Disconnected';
      if (connectionTimer) { clearInterval(connectionTimer); connectionTimer = null; }
      interimText.innerHTML = 'Select a station and press play to begin...';
      showNotification('Disconnected from radio');
    };

    // Fullscreen
    const fullscreenBtn = document.getElementById('fullscreenBtn')!;
    let isFullscreen = false;
    let originalFontSize = 16;
    let translationFontSize = 15;
    let lineHeight = 1.6;
    let isDarkMode = true;

    fullscreenBtn.addEventListener('click', () => {
      if (!isFullscreen) {
        const fullscreenEl = document.createElement('div');
        fullscreenEl.className = 'fullscreen-transcript dark-mode';
        fullscreenEl.innerHTML = `
          <div class="transcript-header">
            <div class="transcript-title">实时字幕</div>
            <div class="transcript-buttons">
              <button id="settingsBtn" class="fullscreen-button">[设置]</button>
              <button id="exitFullscreenBtn" class="fullscreen-button">[缩小]</button>
            </div>
          </div>
          <div class="transcript-container" id="fullscreenTranscriptContainer">${transcriptContainer.innerHTML}</div>
        `;
        document.body.appendChild(fullscreenEl);

        const fsCont = document.getElementById('fullscreenTranscriptContainer')!;
        fsCont.querySelectorAll<HTMLElement>('.english-text').forEach(el => { el.style.fontSize = originalFontSize + 'px'; el.style.lineHeight = String(lineHeight); });
        fsCont.querySelectorAll<HTMLElement>('.chinese-text').forEach(el => { el.style.fontSize = translationFontSize + 'px'; el.style.lineHeight = String(lineHeight); });

        let settingsPanel: HTMLElement | null = null;

        document.getElementById('settingsBtn')!.addEventListener('click', () => {
          if (settingsPanel) { settingsPanel.remove(); settingsPanel = null; return; }
          settingsPanel = document.createElement('div');
          settingsPanel.className = 'settings-panel';
          settingsPanel.innerHTML = `
            <button class="settings-close">×</button>
            <h3>显示设置</h3>
            <div class="settings-row">
              <div class="mode-toggle" id="modeToggle">
                <span class="mode-toggle-label" id="modeLabel">${isDarkMode ? '夜间模式' : '白天模式'}</span>
                <div class="mode-toggle-switch ${isDarkMode ? 'active' : ''}"><div class="mode-toggle-slider"></div></div>
              </div>
            </div>
            <div class="settings-row">
              <label>原文字体大小</label>
              <input type="range" id="originalFontSizeSlider" min="12" max="32" value="${originalFontSize}" step="1">
              <div class="value-display"><span id="originalFontSizeValue">${originalFontSize}</span>px</div>
            </div>
            <div class="settings-row">
              <label>译文字体大小</label>
              <input type="range" id="translationFontSizeSlider" min="12" max="32" value="${translationFontSize}" step="1">
              <div class="value-display"><span id="translationFontSizeValue">${translationFontSize}</span>px</div>
            </div>
            <div class="settings-row">
              <label>行距</label>
              <input type="range" id="lineHeightSlider" min="1.0" max="2.5" value="${lineHeight}" step="0.1">
              <div class="value-display"><span id="lineHeightValue">${lineHeight}</span></div>
            </div>
          `;
          document.body.appendChild(settingsPanel);

          settingsPanel.querySelector<HTMLElement>('.settings-close')!.addEventListener('click', () => { settingsPanel!.remove(); settingsPanel = null; });

          const modeToggle = document.getElementById('modeToggle')!;
          modeToggle.addEventListener('click', () => {
            isDarkMode = !isDarkMode;
            const sw = modeToggle.querySelector<HTMLElement>('.mode-toggle-switch')!;
            const label = document.getElementById('modeLabel')!;
            if (isDarkMode) { sw.classList.add('active'); label.textContent = '夜间模式'; fullscreenEl.classList.add('dark-mode'); settingsPanel!.classList.add('dark-mode'); }
            else { sw.classList.remove('active'); label.textContent = '白天模式'; fullscreenEl.classList.remove('dark-mode'); settingsPanel!.classList.remove('dark-mode'); }
          });

          document.getElementById('originalFontSizeSlider')!.addEventListener('input', (e) => {
            originalFontSize = parseInt((e.target as HTMLInputElement).value);
            document.getElementById('originalFontSizeValue')!.textContent = String(originalFontSize);
            fsCont.querySelectorAll<HTMLElement>('.english-text').forEach(el => { el.style.fontSize = originalFontSize + 'px'; });
          });

          document.getElementById('translationFontSizeSlider')!.addEventListener('input', (e) => {
            translationFontSize = parseInt((e.target as HTMLInputElement).value);
            document.getElementById('translationFontSizeValue')!.textContent = String(translationFontSize);
            fsCont.querySelectorAll<HTMLElement>('.chinese-text').forEach(el => { el.style.fontSize = translationFontSize + 'px'; });
          });

          document.getElementById('lineHeightSlider')!.addEventListener('input', (e) => {
            lineHeight = parseFloat((e.target as HTMLInputElement).value);
            document.getElementById('lineHeightValue')!.textContent = lineHeight.toFixed(1);
            fsCont.querySelectorAll<HTMLElement>('.subtitle-block, .english-text, .chinese-text').forEach(el => { el.style.lineHeight = String(lineHeight); });
          });
        });

        document.getElementById('exitFullscreenBtn')!.addEventListener('click', () => {
          if (settingsPanel) { settingsPanel.remove(); settingsPanel = null; }
          document.body.removeChild(fullscreenEl);
          isFullscreen = false;
          fullscreenBtn.textContent = '[放大]';
        });

        const originalObserver = new MutationObserver(() => {
          const fsCurrent = document.querySelector<HTMLElement>('.fullscreen-transcript .transcript-container');
          if (fsCurrent) {
            fsCurrent.innerHTML = transcriptContainer.innerHTML;
            fsCurrent.querySelectorAll<HTMLElement>('.english-text').forEach(el => { el.style.fontSize = originalFontSize + 'px'; el.style.lineHeight = String(lineHeight); });
            fsCurrent.querySelectorAll<HTMLElement>('.chinese-text').forEach(el => { el.style.fontSize = translationFontSize + 'px'; el.style.lineHeight = String(lineHeight); });
            fsCurrent.scrollTop = fsCurrent.scrollHeight;
          }
        });
        originalObserver.observe(transcriptContainer, { childList: true, subtree: true, characterData: true });

        isFullscreen = true;
        fullscreenBtn.textContent = '[缩小]';
        showNotification('Entered fullscreen mode');
      } else {
        const fsEl = document.querySelector<HTMLElement>('.fullscreen-transcript');
        if (fsEl) document.body.removeChild(fsEl);
        isFullscreen = false;
        fullscreenBtn.textContent = '[放大]';
        showNotification('Exited fullscreen mode');
      }
    });

    // Mini play buttons
    miniPlayButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        e.stopPropagation();
        const stationItem = button.closest<HTMLElement>('.station-item')!;
        if (stationItem.classList.contains('playing')) {
          await disconnectFromServer();
          return;
        }
        if (isPlaying) await disconnectFromServer();
        currentStation = stationItem;
        stationItems.forEach(s => s.classList.remove('active'));
        stationItem.classList.add('active');
        await connectToServer();
      });
    });

    // Station selection
    stationItems.forEach(station => {
      station.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('play-mini-button')) return;
        stationItems.forEach(s => s.classList.remove('active'));
        station.classList.add('active');
        currentStation = station;
        const stationName = station.querySelector<HTMLElement>('.station-name')?.textContent ?? '';
        showNotification(`Selected ${stationName}`);
      });
    });

    // Audio error
    audioPlayer.addEventListener('error', () => {
      const errorCode = audioPlayer.error?.code ?? 'unknown';
      status.textContent = `Audio error (${errorCode})`;
      showNotification('Audio playback error');
    });

    // Cleanup
    return () => {
      scrollObserver.disconnect();
      interimObserver.disconnect();
      if (eventSource) eventSource.close();
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (connectionTimer) clearInterval(connectionTimer);
      if (progressTimer) clearInterval(progressTimer);
      if (hlsPlayer) hlsPlayer.destroy();
      audioPlayer.pause();
    };
  }, []);

  return null;
}
