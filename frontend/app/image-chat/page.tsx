'use client';

import { useEffect, useRef, useState } from 'react';
import { fastifyClient } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

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
  { value: 'gemini-2.5-flash-image',       label: '2.5 Flash' },
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
      <Label className="text-xs text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`rounded-md border px-2.5 py-1 text-xs transition ${
              value === o.value
                ? 'border-violet-500 bg-violet-500 text-white'
                : 'border-border bg-background text-muted-foreground hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-300'
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
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">{label}</Label>
        <span className="font-mono text-xs font-medium text-violet-600 dark:text-violet-400">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-violet-500 h-1.5" />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        {hints.map((h, i) => <span key={i}>{h}</span>)}
      </div>
    </div>
  );
}

function Toggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="flex items-center gap-2.5 cursor-pointer" onClick={onToggle}>
      <div className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-violet-500' : 'bg-gray-300 dark:bg-stone-600'}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <Label className="cursor-pointer text-xs">{label}</Label>
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
        <div key={idx} className="relative h-12 w-12 overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.previewUrl} alt={img.name} className="h-full w-full object-cover" />
          <button type="button" onClick={() => onRemove(idx)}
            className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white text-[10px] hover:bg-black">
            ×
          </button>
        </div>
      ))}
      {images.length < maxCount && (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-violet-300 text-violet-400 transition hover:border-violet-500 hover:text-violet-600 dark:border-stone-600 dark:text-stone-500">
          <span className="text-base leading-none">+</span>
          <span className="text-[9px]">添加</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { onAdd(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Chat message row (left panel, compact)
───────────────────────────────────────────── */
function MessageRow({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500 text-xs text-white">
          🎨
        </div>
      )}
      <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
        isUser
          ? 'rounded-br-sm bg-violet-600 text-white'
          : msg.loading
            ? 'rounded-bl-sm bg-white dark:bg-stone-800 border border-border text-muted-foreground'
            : msg.error
              ? 'rounded-bl-sm bg-destructive/10 border border-destructive/30 text-destructive'
              : 'rounded-bl-sm bg-white dark:bg-stone-800 border border-border text-foreground'
      }`}>
        {msg.loading ? (
          <span className="flex items-center gap-1.5">
            <svg className="h-3 w-3 animate-spin text-violet-500" viewBox="0 0 24 24" fill="none">
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
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs dark:bg-stone-700">
          🙂
        </div>
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
   Main page
───────────────────────────────────────────── */
export default function ImageChatPage() {
  /* params */
  const [model, setModel] = useState('gemini-2.5-flash-image');
  const [aspectRatio, setAspectRatio] = useState('');
  const [imageSize, setImageSize] = useState('1K');
  const [thinkingLevel, setThinkingLevel] = useState('MINIMAL');
  const [temperature, setTemperature] = useState(1.0);
  const [topP, setTopP] = useState(0.95);
  const [enableSearch, setEnableSearch] = useState(false);

  /* reference images */
  const [objectImages, setObjectImages] = useState<RefImage[]>([]);
  const [characterImages, setCharacterImages] = useState<RefImage[]>([]);
  const objectInputRef = useRef<HTMLInputElement>(null);
  const characterInputRef = useRef<HTMLInputElement>(null);
  const [showRefPanel, setShowRefPanel] = useState(false);

  /* chat */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  /** Gemini multi-turn contents history */
  const [geminiHistory, setGeminiHistory] = useState<GeminiContent[]>([]);

  /* current image displayed in right panel */
  const [currentImage, setCurrentImage] = useState<ChatMessage | null>(null);
  /* image history for feed */
  const [imageHistory, setImageHistory] = useState<ChatMessage[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageFeedRef = useRef<HTMLDivElement>(null);
  const imageFeedBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    imageFeedBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [imageHistory, isGenerating]);

  async function addImages(files: File[], current: RefImage[], max: number, setter: React.Dispatch<React.SetStateAction<RefImage[]>>) {
    const newImgs: RefImage[] = await Promise.all(
      files.slice(0, max - current.length).map(async f => ({
        mimeType: f.type,
        data: await fileToBase64(f),
        previewUrl: URL.createObjectURL(f),
        name: f.name,
      }))
    );
    setter(prev => [...prev, ...newImgs]);
  }

  function removeImage(idx: number, setter: React.Dispatch<React.SetStateAction<RefImage[]>>) {
    setter(prev => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
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

    // Build new Gemini history: append new user turn
    const newHistory: GeminiContent[] = [
      ...geminiHistory,
      { role: 'user', parts: [{ text: text.trim() }] },
    ];

    try {
      const res = await fastifyClient.post<{ success: boolean; data: ImageResult }>('/image/generate', {
        prompt: text.trim(),
        contents: newHistory,    // send full multi-turn history
        model,
        aspectRatio,
        imageSize,
        thinkingLevel,
        temperature,
        topP,
        enableSearch,
        objectImages: objectImages.map(({ mimeType, data }) => ({ mimeType, data })),
        characterImages: characterImages.map(({ mimeType, data }) => ({ mimeType, data })),
      });

      const done: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        text: res.data.prompt || text.trim(),
        loading: false,
        image: res.data.image,
        mimeType: res.data.mimeType,
        caption: res.data.caption ?? undefined,
        model: res.data.model,
      };

      setMessages(prev => prev.map(m => m.id === assistantId ? done : m));
      setCurrentImage(done);
      setImageHistory(prev => [...prev, done]);

      // Store model turn with actual inlineData so the model can reference
      // the previous image in subsequent turns (official multi-turn pattern).
      const modelTurn: GeminiContent = {
        role: 'model',
        parts: [{ inlineData: { mimeType: res.data.mimeType, data: res.data.image } }],
      };
      setGeminiHistory([...newHistory, modelTurn]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '生成失败，请重试';
      const errEntry: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        text: text.trim(),
        loading: false,
        error: errMsg,
      };
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, text: '', loading: false, error: errMsg } : m
      ));
      // Push error into feed so it appears in the image panel
      setImageHistory(prev => [...prev, errEntry]);
    } finally {
      setIsGenerating(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function clearChat() {
    setMessages([]);
    setCurrentImage(null);
    setImageHistory([]);
    setGeminiHistory([]);
  }  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-violet-50 via-white to-purple-50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 overflow-hidden">

      {/* ── Header ── */}
      <header className="shrink-0 border-b bg-white/80 backdrop-blur dark:bg-stone-900/80 z-10">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🎨</span>
            <div>
              <h1 className="text-sm font-bold leading-tight">Gemini 图片聊天生成</h1>
              <p className="text-[11px] text-muted-foreground">{model} · 每条消息独立生成图片</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button type="button" onClick={clearChat}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-destructive/50 hover:text-destructive transition">
                清空对话
              </button>
            )}
            <a href="/image"
              className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs text-violet-600 hover:bg-violet-50 dark:border-stone-600 dark:bg-stone-800 dark:text-violet-300 transition">
              标准模式
            </a>
          </div>
        </div>
      </header>

      {/* ── Body: left-chat + center-image + right-params ── */}
      <div className="flex flex-1 overflow-hidden mx-auto w-full max-w-screen-2xl">

        {/* ── Left: Chat panel (narrow) ── */}
        <div className="flex w-72 xl:w-80 shrink-0 flex-col overflow-hidden border-r bg-white/60 backdrop-blur dark:bg-stone-900/60 dark:border-stone-700">

          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center px-2">
                <div className="text-4xl">💬</div>
                <p className="text-sm font-semibold text-foreground">开始聊天生成图片</p>
                <p className="text-xs text-muted-foreground">输入提示词，每条消息都会根据聊天上下文重新生成图片</p>
                <div className="w-full space-y-1.5 text-left">
                  {QUICK_PROMPTS.map(p => (
                    <button key={p} type="button"
                      onClick={() => { setInput(p); setTimeout(() => inputRef.current?.focus(), 50); }}
                      className="w-full rounded-lg border border-violet-100 bg-white/80 px-2.5 py-1.5 text-left text-xs text-violet-700 hover:bg-violet-50 dark:border-stone-700 dark:bg-stone-800/60 dark:text-violet-300 transition">
                      {p.length > 28 ? p.slice(0, 28) + '…' : p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map(msg => (
                  <MessageRow key={msg.id} msg={msg} />
                ))}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* ── Input area ── */}
          <div className="shrink-0 border-t bg-white/90 backdrop-blur px-3 py-2.5 dark:bg-stone-900/90 space-y-2">

            {/* Ref images — always visible */}
            <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-2.5 dark:border-stone-700 dark:bg-stone-800/60 space-y-2.5">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <p className="text-[11px] font-medium">🖼 对象保真</p>
                  <span className="text-[10px] text-muted-foreground">{objectImages.length}/10</span>
                </div>
                <ImageUploadGrid images={objectImages} maxCount={10}
                  onAdd={f => addImages(f, objectImages, 10, setObjectImages)}
                  onRemove={idx => removeImage(idx, setObjectImages)}
                  inputRef={objectInputRef} />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <p className="text-[11px] font-medium">👤 角色一致</p>
                  <span className="text-[10px] text-muted-foreground">{characterImages.length}/4</span>
                </div>
                <ImageUploadGrid images={characterImages} maxCount={4}
                  onAdd={f => addImages(f, characterImages, 4, setCharacterImages)}
                  onRemove={idx => removeImage(idx, setCharacterImages)}
                  inputRef={characterInputRef} />
              </div>
            </div>

            {/* textarea + send */}
            <div className="flex items-end gap-1.5">
              <textarea
                ref={inputRef}
                rows={4}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isGenerating}
                placeholder="提示词… Enter 发送"
                className="flex-1 resize-none rounded-xl border border-border bg-white px-3 py-2 text-xs outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200 disabled:opacity-50 dark:bg-stone-800 dark:border-stone-600 dark:focus:border-violet-500 dark:focus:ring-violet-900"
              />
              <Button type="button" disabled={!input.trim() || isGenerating}
                onClick={() => sendMessage(input)}
                className="h-[88px] w-10 shrink-0 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 p-0">
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
          </div>
        </div>

        {/* ── Center: Image feed (scrollable chat) ── */}
        <div className="flex flex-1 flex-col overflow-hidden bg-black/5 dark:bg-black/20">
          <div className="flex-1 overflow-y-auto px-4 py-4" ref={imageFeedRef}>
            {imageHistory.length === 0 && !isGenerating ? (
              /* Empty state */
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="text-6xl opacity-20">🖼</div>
                <p className="text-sm">图片将在此处显示</p>
                <p className="text-xs">在左侧输入提示词开始生成</p>
              </div>
            ) : (
              <div className="mx-auto max-w-2xl space-y-6">
                {/* Render history in chronological order (oldest first) */}
                {imageHistory.map(msg => (
                  <div key={msg.id} className="space-y-2">
                    {/* Prompt label */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground bg-white/70 dark:bg-stone-800/70 rounded-full px-2.5 py-0.5 border border-border truncate max-w-[80%]">
                        {msg.text}
                      </span>
                      <span className="shrink-0 text-[10px] text-violet-400">{msg.model}</span>
                    </div>

                    {/* Image card */}
                    {msg.image ? (
                      <div className="rounded-2xl overflow-hidden border border-border bg-white shadow-sm dark:bg-stone-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`data:${msg.mimeType};base64,${msg.image}`}
                          alt={msg.text}
                          className="w-full object-contain"
                        />
                        {(msg.caption) && (
                          <p className="px-3 py-2 text-xs text-muted-foreground border-t border-border">{msg.caption}</p>
                        )}
                        <div className="flex items-center justify-end px-3 py-1.5 border-t border-border">
                          <button type="button" onClick={() => downloadImage(msg)}
                            className="rounded-full border border-violet-200 bg-white px-3 py-0.5 text-xs text-violet-600 hover:bg-violet-50 dark:border-stone-600 dark:bg-stone-700 dark:text-violet-300 transition">
                            ↓ 下载
                          </button>
                        </div>
                      </div>
                    ) : msg.error ? (
                      /* Error card */
                      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 dark:bg-destructive/10">
                        <p className="text-xs font-semibold text-destructive mb-1">⚠ 生成失败</p>
                        <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{msg.error}</p>
                      </div>
                    ) : null}
                  </div>
                ))}

                {/* Loading card at bottom */}
                {isGenerating && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground bg-white/70 dark:bg-stone-800/70 rounded-full px-2.5 py-0.5 border border-border">
                        {input || '生成中…'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-border bg-white px-5 py-6 shadow-sm dark:bg-stone-800">
                      <svg className="h-5 w-5 animate-spin text-violet-400 shrink-0" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <p className="text-sm text-muted-foreground">正在根据对话上下文生成图片…</p>
                    </div>
                  </div>
                )}

                <div ref={imageFeedBottomRef} />
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Param panel ── */}
        <aside className="hidden xl:flex w-60 shrink-0 flex-col overflow-y-auto border-l bg-white/70 backdrop-blur dark:bg-stone-900/70 dark:border-stone-700">
          <div className="p-4 space-y-4">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">参数设置</p>

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

            <Toggle enabled={enableSearch} onToggle={() => setEnableSearch(v => !v)}
              label="Google Image Search" />

            <div className="h-px bg-border" />

            <Card className="border-violet-100 bg-violet-50/60 dark:border-stone-700 dark:bg-stone-800/40">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs font-semibold text-violet-700 dark:text-violet-300">💡 提示</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 space-y-1.5 text-[11px] text-muted-foreground">
                <p>• 每条消息都是独立请求</p>
                <p>• 参数修改后下次生效</p>
                <p>• Enter 发送，Shift+Enter 换行</p>
                <p>• 点击历史缩略图可查看旧图</p>
              </CardContent>
            </Card>
          </div>
        </aside>

      </div>
    </div>
  );
}
