'use client';

import { useEffect, useRef, useState } from 'react';
import { fastifyClient } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemeColorPicker } from '@/components/theme-color-picker';

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface RefImage {
  mimeType: string;
  data: string;
  previewUrl: string;
  name: string;
}

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  image?: string;
  mimeType?: string;
  caption?: string;
  model?: string;
  loading?: boolean;
  error?: string;
}

interface ImageResult {
  mimeType: string;
  image: string;
  caption: string | null;
  prompt: string;
  model: string;
}

interface HistoryItem {
  id: number;
  type: string;
  prompt: string;
  model: string | null;
  mime_type: string;
  caption: string | null;
  created_at: string;
}

/** Gemini contents format for multi-turn chat */
interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}
interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const MODELS = [
  { value: 'gemini-2.5-flash-image',        label: '2.5 Flash' },
  { value: 'gemini-3.1-flash-image-preview', label: '3.1 Flash' },
];

const ASPECT_RATIOS = [
  { value: '',     label: '自动' },
  { value: '1:1',  label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3',  label: '4:3' },
  { value: '3:4',  label: '3:4' },
];

const IMAGE_SIZES = [
  { value: '512', label: '512' },
  { value: '1K',  label: '1K' },
  { value: '2K',  label: '2K' },
  { value: '4K',  label: '4K' },
];

const THINKING_LEVELS = [
  { value: 'MINIMAL', label: 'Minimal' },
  { value: 'LOW',     label: 'Low' },
  { value: 'MEDIUM',  label: 'Medium' },
  { value: 'HIGH',    label: 'High' },
];

const QUICK_PROMPTS = [
  '一只可爱的猫咪坐在樱花树下，水彩风格',
  'A futuristic city at night, cyberpunk style',
  '中国水墨画风格的山水，云雾缭绕',
  'Cozy coffee shop in autumn, warm lighting',
  '赛博朋克风格的机器人，高细节插画',
  '星空下的帐篷营地，电影感光效',
];

/* ─────────────────────────────────────────────
   Small UI helpers
───────────────────────────────────────────── */
function ChipGroup({ label, options, value, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-base text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`rounded-md border px-2.5 py-1 text-base transition ${
              value === o.value
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-border bg-background text-muted-foreground hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-300'
            }`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SliderParam({ label, min, max, step, value, onChange, fmt, hints }: {
  label: string; min: number; max: number; step: number; value: number;
  onChange: (v: number) => void; fmt: (v: number) => string; hints: string[];
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-base text-muted-foreground uppercase tracking-wide">{label}</Label>
        <span className="font-mono text-base font-medium text-blue-600 dark:text-blue-400">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-blue-500 h-1.5" />
      <div className="flex justify-between text-sm text-muted-foreground">
        {hints.map((h, i) => <span key={i}>{h}</span>)}
      </div>
    </div>
  );
}

function Toggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="flex items-center gap-2.5 cursor-pointer" onClick={onToggle}>
      <div className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-stone-600'}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <Label className="cursor-pointer text-sm">{label}</Label>
    </div>
  );
}

function ImageUploadGrid({ images, maxCount, onAdd, onRemove, inputRef }: {
  images: RefImage[];
  maxCount: number;
  onAdd: (files: File[]) => void;
  onRemove: (idx: number) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {images.map((img, idx) => (
        <div key={idx} className="relative h-14 w-14 overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.previewUrl} alt={img.name} className="h-full w-full object-cover" />
          <button type="button" onClick={() => onRemove(idx)}
            className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white text-xs hover:bg-black">
            ×
          </button>
        </div>
      ))}
      {images.length < maxCount && (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-blue-300 text-blue-400 transition hover:border-blue-500 hover:text-blue-600 dark:border-stone-600 dark:text-stone-500">
          <span className="text-lg leading-none">+</span>
          <span className="text-xs">添加</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { onAdd(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Chat message row
───────────────────────────────────────────── */
function MessageRow({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs text-white">🎨</div>
      )}
      <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
        isUser
          ? 'rounded-br-sm bg-blue-600 text-white'
          : msg.loading
            ? 'rounded-bl-sm bg-white dark:bg-stone-800 border border-border text-muted-foreground'
            : msg.error
              ? 'rounded-bl-sm bg-destructive/10 border border-destructive/30 text-destructive'
              : 'rounded-bl-sm bg-white dark:bg-stone-800 border border-border text-foreground'
      }`}>
        {msg.loading ? (
          <span className="flex items-center gap-1.5">
            <svg className="h-3 w-3 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            生成中…
          </span>
        ) : msg.error ? (
          <span>⚠ {msg.error}</span>
        ) : (
          msg.text
        )}
      </div>
      {isUser && (
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs dark:bg-stone-700">🙂</div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Utils
───────────────────────────────────────────── */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

let msgIdCounter = 0;
function nextId() { return ++msgIdCounter; }

/* ─────────────────────────────────────────────
   Params panel (reused in sidebar + mobile)
───────────────────────────────────────────── */
function ParamsPanel({
  baseUrl, setBaseUrl, apiKey, setApiKey,
  model, setModel, aspectRatio, setAspectRatio,
  imageSize, setImageSize, thinkingLevel, setThinkingLevel,
  temperature, setTemperature, topP, setTopP,
  enableSearch, setEnableSearch,
}: {
  baseUrl: string; setBaseUrl: (v: string) => void;
  apiKey: string; setApiKey: (v: string) => void;
  model: string; setModel: (v: string) => void;
  aspectRatio: string; setAspectRatio: (v: string) => void;
  imageSize: string; setImageSize: (v: string) => void;
  thinkingLevel: string; setThinkingLevel: (v: string) => void;
  temperature: number; setTemperature: (v: number) => void;
  topP: number; setTopP: (v: number) => void;
  enableSearch: boolean; setEnableSearch: (v: (prev: boolean) => boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="border-blue-100 dark:border-stone-700">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold">API 配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-base text-muted-foreground uppercase tracking-wide">Base URL</Label>
            <input type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
              placeholder="留空使用服务器默认"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-base outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 dark:focus:border-blue-500 dark:focus:ring-blue-900" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-base text-muted-foreground uppercase tracking-wide">API Key</Label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder="留空使用服务器默认"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-base outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 dark:focus:border-blue-500 dark:focus:ring-blue-900" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-100 dark:border-stone-700">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold">生成参数</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ChipGroup label="模型" options={MODELS} value={model} onChange={setModel} />
          <ChipGroup label="宽高比" options={ASPECT_RATIOS} value={aspectRatio} onChange={setAspectRatio} />
          <ChipGroup label="分辨率" options={IMAGE_SIZES} value={imageSize} onChange={setImageSize} />
          <ChipGroup label="思考深度" options={THINKING_LEVELS} value={thinkingLevel} onChange={setThinkingLevel} />
          <div className="h-px bg-border" />
          <SliderParam label="温度 Temperature" min={0} max={2} step={0.1}
            value={temperature} onChange={setTemperature}
            fmt={v => v.toFixed(1)} hints={['0.0 精确', '1.0', '2.0 创意']} />
          <SliderParam label="TopP" min={0} max={1} step={0.01}
            value={topP} onChange={setTopP}
            fmt={v => v.toFixed(2)} hints={['0.0', '0.95', '1.0']} />
          <div className="h-px bg-border" />
          <Toggle enabled={enableSearch} onToggle={() => setEnableSearch(v => !v)} label="Google Image Search" />
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main page
───────────────────────────────────────────── */
export default function ImageChatPage() {
  const { user, isAuthenticated, logout } = useAuth();
  /* params */
  const [model, setModel] = useState('gemini-3.1-flash-image-preview');
  const [aspectRatio, setAspectRatio] = useState('');
  const [imageSize, setImageSize] = useState('1K');
  const [thinkingLevel, setThinkingLevel] = useState('MINIMAL');
  const [temperature, setTemperature] = useState(1.0);
  const [topP, setTopP] = useState(0.95);
  const [enableSearch, setEnableSearch] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://tokens.fidelityai.net/');

  /* reference images */
  const [objectImages, setObjectImages] = useState<RefImage[]>([]);
  const [characterImages, setCharacterImages] = useState<RefImage[]>([]);
  const objectInputRef = useRef<HTMLInputElement>(null);
  const characterInputRef = useRef<HTMLInputElement>(null);
  const [showMobileParams, setShowMobileParams] = useState(false);

  /* chat */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [geminiHistory, setGeminiHistory] = useState<GeminiContent[]>([]);
  const [currentImage, setCurrentImage] = useState<ChatMessage | null>(null);
  const [imageHistory, setImageHistory] = useState<ChatMessage[]>([]);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageFeedBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { imageFeedBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [imageHistory, isGenerating]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    fastifyClient.get<{ success: boolean; data: HistoryItem[] }>('/image/history')
      .then(res => setHistory(res.data))
      .catch(() => {});
  }, []);

  async function loadHistoryItem(item: HistoryItem) {
    try {
      const res = await fastifyClient.get<{ success: boolean; data: { image_data: string; mime_type: string; prompt: string; model: string; caption: string } }>(`/image/history/${item.id}`);
      const d = res.data;
      const msg: ChatMessage = { id: nextId(), role: 'assistant', text: d.prompt, image: d.image_data, mimeType: d.mime_type, caption: d.caption ?? undefined, model: d.model ?? '' };
      setCurrentImage(msg);
      setImageHistory(prev => [...prev, msg]);
    } catch {}
  }

  async function addImages(files: File[], current: RefImage[], max: number, setter: React.Dispatch<React.SetStateAction<RefImage[]>>) {
    const newImgs: RefImage[] = await Promise.all(
      files.slice(0, max - current.length).map(async f => ({
        mimeType: f.type, data: await fileToBase64(f),
        previewUrl: URL.createObjectURL(f), name: f.name,
      }))
    );
    setter(prev => [...prev, ...newImgs]);
  }

  function removeImage(idx: number, setter: React.Dispatch<React.SetStateAction<RefImage[]>>) {
    setter(prev => { URL.revokeObjectURL(prev[idx].previewUrl); return prev.filter((_, i) => i !== idx); });
  }

  function downloadImage(msg: ChatMessage) {
    if (!msg.image) return;
    const link = document.createElement('a');
    link.href = `data:${msg.mimeType};base64,${msg.image}`;
    link.download = `gemini-chat-${msg.id}.png`;
    link.click();
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isGenerating) return;
    const userMsg: ChatMessage = { id: nextId(), role: 'user', text: text.trim() };
    const assistantId = nextId();
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', text: '正在生成图片…', loading: true };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsGenerating(true);

    const newHistory: GeminiContent[] = [...geminiHistory, { role: 'user', parts: [{ text: text.trim() }] }];

    try {
      const res = await fastifyClient.post<{ success: boolean; data: ImageResult }>('/image/generate', {
        prompt: text.trim(), contents: newHistory, model, historyType: 'image',
        aspectRatio, imageSize, thinkingLevel, temperature, topP, enableSearch,
        objectImages: objectImages.map(({ mimeType, data }) => ({ mimeType, data })),
        characterImages: characterImages.map(({ mimeType, data }) => ({ mimeType, data })),
        ...(baseUrl.trim() ? { baseUrl: baseUrl.trim(), ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) } : {}),
      });
      const done: ChatMessage = {
        id: assistantId, role: 'assistant', text: res.data.prompt || text.trim(),
        loading: false, image: res.data.image, mimeType: res.data.mimeType,
        caption: res.data.caption ?? undefined, model: res.data.model,
      };
      setMessages(prev => prev.map(m => m.id === assistantId ? done : m));
      setCurrentImage(done);
      setImageHistory(prev => [...prev, done]);
      setGeminiHistory([...newHistory, { role: 'model', parts: [{ inlineData: { mimeType: res.data.mimeType, data: res.data.image } }] }]);
      // 刷新历史
      const token = localStorage.getItem('accessToken');
      if (token) {
        fastifyClient.get<{ success: boolean; data: HistoryItem[] }>('/image/history')
          .then(r => setHistory(r.data)).catch(() => {});
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '生成失败，请重试';
      const errEntry: ChatMessage = { id: assistantId, role: 'assistant', text: text.trim(), loading: false, error: errMsg };
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, text: '', loading: false, error: errMsg } : m));
      setImageHistory(prev => [...prev, errEntry]);
    } finally {
      setIsGenerating(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  function clearChat() {
    setMessages([]); setCurrentImage(null); setImageHistory([]); setGeminiHistory([]);
  }

  const paramsProps = {
    baseUrl, setBaseUrl, apiKey, setApiKey, model, setModel,
    aspectRatio, setAspectRatio, imageSize, setImageSize,
    thinkingLevel, setThinkingLevel, temperature, setTemperature,
    topP, setTopP, enableSearch, setEnableSearch,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950">

      {/* ── Header ── */}
      <header className="border-b bg-white/80 backdrop-blur dark:bg-stone-900/80 sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🎨</span>
            <div>
              <h1 className="text-2xl font-light leading-tight">Gemini最新版Nano Banana 2作图工具(聊天连续版)</h1>
              <p className="text-base text-muted-foreground">{model}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button type="button" onClick={clearChat}
                className="rounded-full border border-border px-3 py-1 text-base text-muted-foreground hover:border-destructive/50 hover:text-destructive transition">
                清空对话
              </button>
            )}
            <button type="button" onClick={() => setShowMobileParams(v => !v)}
              className="xl:hidden rounded-full border border-blue-200 bg-white px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:border-stone-600 dark:bg-stone-800 dark:text-blue-300 transition">
              {showMobileParams ? '关闭参数' : '参数'}
            </button>
            <a href="/video"
              className="rounded-full border border-blue-200 bg-white px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:border-stone-600 dark:bg-stone-800 dark:text-blue-300 transition">
              Seedance 2.0 视频制作工具
            </a>
            <a href="/image"
              className="rounded-full border border-blue-200 bg-white px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:border-stone-600 dark:bg-stone-800 dark:text-blue-300 transition">
              标准模式
            </a>
            <ThemeColorPicker />
            <ThemeToggle />
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-border">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-xs font-semibold text-white">
                  {(user.name || user.email || '?')[0].toUpperCase()}
                </div>
                <span className="hidden sm:block text-sm text-foreground max-w-[100px] truncate">
                  {user.name || user.email}
                </span>
                <button type="button" onClick={() => { logout(); window.location.href = '/login'; }}
                  className="text-xs text-muted-foreground hover:text-destructive transition">
                  退出
                </button>
              </div>
            ) : (
              <a href="/login" className="rounded-full bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 transition">
                登录
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="mx-auto max-w-screen-2xl px-4 py-6">
        <div className="flex flex-col gap-6 xl:flex-row">

          {/* ── Left: Chat ── */}
          <div className="flex flex-col gap-4 w-full xl:w-80 shrink-0">

            {/* Mobile params */}
            {showMobileParams && (
              <div className="xl:hidden">
                <ParamsPanel {...paramsProps} />
              </div>
            )}

            {/* 参考图 */}
            <Card className="border-blue-100 dark:border-stone-700">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base font-semibold">参考图</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-base font-medium">🖼 对象保真参考图</p>
                      <p className="text-xs text-muted-foreground">产品、物品、场景，保持外观一致</p>
                    </div>
                    <span className="text-sm text-muted-foreground">{objectImages.length}/10</span>
                  </div>
                  <ImageUploadGrid images={objectImages} maxCount={10}
                    onAdd={f => addImages(f, objectImages, 10, setObjectImages)}
                    onRemove={idx => removeImage(idx, setObjectImages)}
                    inputRef={objectInputRef} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-base font-medium">👤 角色一致性参考图</p>
                      <p className="text-xs text-muted-foreground">人物、角色，保持面貌服装风格一致</p>
                    </div>
                    <span className="text-sm text-muted-foreground">{characterImages.length}/4</span>
                  </div>
                  <ImageUploadGrid images={characterImages} maxCount={4}
                    onAdd={f => addImages(f, characterImages, 4, setCharacterImages)}
                    onRemove={idx => removeImage(idx, setCharacterImages)}
                    inputRef={characterInputRef} />
                </div>
              </CardContent>
            </Card>

            {/* 对话 + 输入 合并 */}
            <Card className="border-blue-100 dark:border-stone-700">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base font-semibold">对话</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pb-3">
                {/* 消息列表 */}
                <div className="overflow-y-auto max-h-60 space-y-2">
                  {messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">暂无对话，在下方输入提示词开始</p>
                  ) : (
                    <>
                      {messages.map(msg => <MessageRow key={msg.id} msg={msg} />)}
                      <div ref={bottomRef} />
                    </>
                  )}
                </div>

                <div className="h-px bg-border" />

                {/* 输入框 */}
                <div className="flex items-end gap-1.5">
                  <textarea
                    ref={inputRef}
                    rows={3}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isGenerating}
                    placeholder="提示词… Enter 发送"
                    className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-base outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:bg-stone-800 dark:border-stone-600 dark:focus:border-blue-500 dark:focus:ring-blue-900"
                  />
                  <Button type="button" disabled={!input.trim() || isGenerating}
                    onClick={() => sendMessage(input)}
                    className="h-[72px] w-10 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 p-0">
                    {isGenerating ? (
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                      </svg>
                    )}
                  </Button>
                </div>

                {/* 建议提示词 */}
                <div className="flex flex-wrap gap-1">
                  {QUICK_PROMPTS.map(p => (
                    <button key={p} type="button"
                      onClick={() => { setInput(p); setTimeout(() => inputRef.current?.focus(), 50); }}
                      className="rounded-full border border-blue-100 bg-white/80 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 dark:border-stone-700 dark:bg-stone-800/60 dark:text-blue-300 transition">
                      {p.length > 18 ? p.slice(0, 18) + '…' : p}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* ── Center: Image feed ── */}
          <div className="flex-1 min-w-0 space-y-4">
            {imageHistory.length === 0 && !isGenerating ? (
              <Card className="border-blue-100 dark:border-stone-700">
                <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
                  <div className="text-6xl opacity-20">🖼</div>
                  <p className="text-base">图片将在此处显示</p>
                  <p className="text-sm">在左侧输入提示词开始生成</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {imageHistory.map(msg => (
                  <Card key={msg.id} className="border-blue-100 dark:border-stone-700 overflow-hidden">
                    <CardHeader className="pb-2 pt-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-base text-muted-foreground truncate">{msg.text}</p>
                        <span className="shrink-0 text-sm text-blue-400">{msg.model}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-3 space-y-2">
                      {msg.image ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`data:${msg.mimeType};base64,${msg.image}`} alt={msg.text}
                            className="w-full rounded-lg object-contain" />
                          {msg.caption && (
                            <p className="text-base text-muted-foreground">{msg.caption}</p>
                          )}
                          <div className="flex justify-end">
                            <button type="button" onClick={() => downloadImage(msg)}
                              className="rounded-full border border-blue-200 bg-white px-3 py-0.5 text-sm text-blue-600 hover:bg-blue-50 dark:border-stone-600 dark:bg-stone-700 dark:text-blue-300 transition">
                              ↓ 下载
                            </button>
                          </div>
                        </>
                      ) : msg.error ? (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                          <p className="text-base font-semibold text-destructive mb-1">⚠ 生成失败</p>
                          <p className="text-base text-foreground whitespace-pre-wrap leading-relaxed">{msg.error}</p>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}

                {/* Loading card */}
                {isGenerating && (
                  <Card className="border-blue-100 dark:border-stone-700">
                    <CardContent className="flex items-center gap-3 py-8">
                      <svg className="h-5 w-5 animate-spin text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <p className="text-base text-muted-foreground">正在根据对话上下文生成图片…</p>
                    </CardContent>
                  </Card>
                )}
                <div ref={imageFeedBottomRef} />
              </>
            )}
          </div>

          {/* ── Right: Param panel (desktop) ── */}
          <aside className="hidden xl:block w-72 shrink-0">
            <div className="sticky top-20 space-y-4">
              <ParamsPanel {...paramsProps} />

              {/* 历史记录 */}
              {history.length > 0 && (
                <Card className="border-blue-100 dark:border-stone-700">
                  <CardHeader className="pb-2 pt-3 cursor-pointer select-none" onClick={() => setHistoryOpen(v => !v)}>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">🕒 历史（{history.length}）</CardTitle>
                      <span className="text-muted-foreground text-sm">{historyOpen ? '▲' : '▼'}</span>
                    </div>
                  </CardHeader>
                  {historyOpen && (
                    <CardContent>
                      <div className="space-y-2">
                        {history.map(item => (
                          <button key={item.id} type="button" onClick={() => loadHistoryItem(item)}
                            className="w-full text-left rounded-lg border border-border px-3 py-2 hover:bg-blue-50 dark:hover:bg-stone-700/50 transition">
                            <p className="text-sm font-medium line-clamp-1">{item.prompt}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{new Date(item.created_at).toLocaleString('zh-CN')}</p>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}
