'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { fastifyClient } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemeColorPicker } from '@/components/theme-color-picker';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface MediaItem {
  uid?: string;
  mediaType?: 'image' | 'video' | 'audio';
  url?: string;
  mimeType?: string;
  previewUrl?: string;
  name?: string;
  uploading?: boolean;
  uploadProgress?: number;   // 0–100
  uploadError?: string;
}

interface TaskData {
  taskId: string;
  status: string;
  videoUrl: string | null;
  error: string | null;
  callbackUrl?: string | null;
  webhookReceived?: boolean;
  resolution?: string | null;
  duration?: number | null;
  ratio?: string | null;
  seed?: number | null;
  fps?: number | null;
  webSearchCount?: number | null;
  usage?: { completion_tokens?: number; total_tokens?: number } | null;
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const MODELS = [
  { value: 'doubao-seedance-2-0-260128',      label: 'Seedance 2.0' },
  { value: 'doubao-seedance-2-0-fast-260128', label: 'Seedance 2.0 Fast（速）' },
];

const RESOLUTIONS = [
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
];

const RATIOS = [
  { value: '21:9', label: '21:9' },
  { value: '16:9', label: '16:9' },
  { value: '4:3',  label: '4:3' },
  { value: '1:1',  label: '1:1' },
  { value: '3:4',  label: '3:4' },
  { value: '9:16', label: '9:16' },
];

const DURATIONS = Array.from({ length: 12 }, (_, i) => ({ value: i + 4, label: `${i + 4}s` }));

const EXAMPLE_PROMPTS = [
  '日落时分，一只老鹰在雪山上空翱翔，史诗级镜头，4K超清',
  '城市夜景延时摄影，霓虹灯流光，车流如河',
  '将视频1礼盒中的香水替换成图片1中的面霜，运镜不变',
  '一杯咖啡在桌上，热气袅袅，早晨阳光透过窗户照射进来，电影感画面',
];

// ── Virtual avatar library ────────────────────
interface AvatarItem {
  assetId: string;
  label: string;
  thumb: string;
}

const STATUS_LABELS: Record<string, string> = {
  running:    '生成中…',
  queued:     '队列中…',
  pending:    '等待中…',
  succeeded:  '生成成功',
  failed:     '生成失败',
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const FASTIFY_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_FASTIFY_API_URL) ||
  'http://localhost:3200';

/** Upload a file via XHR so we get real upload progress. Returns the public URL. */
function uploadWithProgress(
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const form = new FormData();
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${FASTIFY_BASE}/upload`);
    xhr.setRequestHeader('Accept', 'application/json');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText).data.url); }
        catch { reject(new Error('响应解析失败')); }
      } else {
        try { reject(new Error(JSON.parse(xhr.responseText).error || `HTTP ${xhr.status}`)); }
        catch { reject(new Error(`HTTP ${xhr.status}`)); }
      }
    };
    xhr.onerror   = () => reject(new Error('网络错误'));
    xhr.ontimeout = () => reject(new Error('上传超时'));
    xhr.send(form);
  });
}

function getVideoInfo(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el  = document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({ duration: el.duration, width: el.videoWidth, height: el.videoHeight });
    };
    el.onerror = () => { URL.revokeObjectURL(url); reject(new Error('无法读取视频信息')); };
    el.src = url;
  });
}

// ──────────────────────────────────────────────
// Small UI components
// ──────────────────────────────────────────────

function ChipGroup({ label, options, value, onChange }: {
  label: string;
  options: { value: string | number; label: string }[];
  value: string | number;
  onChange: (v: string | number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`rounded-md border px-2.5 py-1 text-xs transition ${
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

function Toggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="flex items-center gap-2.5 cursor-pointer" onClick={onToggle}>
      <div className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-stone-600'}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <Label className="cursor-pointer text-xs">{label}</Label>
    </div>
  );
}

// ──────────────────────────────────────────────
// Avatar library
// ──────────────────────────────────────────────

const GAP = 6; // gap-1.5 = 6px

function AvatarLibrary({ avatars, selectedIds, onAdd, onRemove }: {
  avatars: AvatarItem[];
  selectedIds: string[];
  onAdd: (assetId: string, label: string) => void;
  onRemove: (assetId: string) => void;
}) {
  const [search, setSearch]         = useState('');
  const [lightbox, setLightbox]     = useState<AvatarItem | null>(null);
  const scrollRef                   = useRef<HTMLDivElement>(null);
  const [cols, setCols]             = useState(7);
  const [rowH, setRowH]             = useState(120);

  // Measure container → recalculate cols + rowH
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = (w: number) => {
      // Fit as many ~80px items as possible, min 4 max 9
      const c = Math.min(9, Math.max(4, Math.floor((w + GAP) / (80 + GAP))));
      const itemW = (w - (c - 1) * GAP) / c;
      setRowH(Math.round(itemW * 4 / 3) + GAP);
      setCols(c);
    };
    update(el.clientWidth);
    const ro = new ResizeObserver(([e]) => update(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const filtered = search.trim()
    ? avatars.filter(a => a.label.includes(search.trim()))
    : avatars;

  // Group into rows of `cols`
  const rows: AvatarItem[][] = [];
  for (let i = 0; i < filtered.length; i += cols) rows.push(filtered.slice(i, i + cols));

  const virtualizer = useVirtualizer({
    count:           rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize:    () => rowH,
    overscan:        4,
  });

  return (
    <Card className="border-purple-100 dark:border-stone-700">
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">👤 虚拟人像库</CardTitle>
          <span className="text-[11px] text-muted-foreground">
            点击添加 · 滚动查看更多（{filtered.length} 人）
          </span>
        </div>
        <input
          type="text"
          placeholder="搜索职业、国籍、年龄…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
        />
      </CardHeader>
      <CardContent className="pb-3 pt-0">
        {/* Scroll container — fixed to ~2 row heights so user can see there's more */}
        <div
          ref={scrollRef}
          style={{ height: rowH * 2, overflowY: 'auto' }}
          className="overscroll-contain"
        >
          {/* Inner div sized to total virtual height */}
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map(vRow => {
              const rowItems = rows[vRow.index];
              return (
                <div
                  key={vRow.index}
                  style={{ position: 'absolute', top: vRow.start, left: 0, right: 0, height: rowH - GAP }}
                  className="flex gap-1.5"
                >
                  {rowItems.map(av => {
                    const selected = selectedIds.includes(av.assetId);
                    return (
                      <div
                        key={av.assetId}
                        style={{ flex: '1 1 0', minWidth: 0, height: rowH - GAP }}
                        className="group relative"
                      >
                        <button
                          type="button"
                          onClick={() => selected ? onRemove(av.assetId) : onAdd(av.assetId, av.label)}
                          title={av.label.replace(/_/g, ' ')}
                          className={`relative h-full w-full overflow-hidden rounded-lg border-2 transition ${
                            selected
                              ? 'border-purple-500 ring-1 ring-purple-400'
                              : 'border-transparent hover:border-purple-300'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={av.thumb}
                            alt={av.label}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-black/60 px-0.5 py-0.5 text-[8px] leading-tight text-white line-clamp-1">
                            {av.label.replace(/_/g, ' ')}
                          </div>
                          {selected && (
                            <div className="absolute inset-0 flex items-center justify-center bg-purple-600/30">
                              <span className="rounded-full bg-purple-600 px-1 py-0.5 text-[9px] font-bold text-white">✓</span>
                            </div>
                          )}
                        </button>
                        {/* Zoom button — visible on hover */}
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setLightbox(av); }}
                          title="查看高清照片"
                          className="absolute right-0.5 top-0.5 flex md:hidden md:group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
                            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M11 8v6M8 11h6"/>
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                  {/* Pad last row to keep consistent column widths */}
                  {Array.from({ length: cols - rowItems.length }).map((_, i) => (
                    <div key={i} style={{ flex: '1 1 0' }} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        {/* Scroll hint fade */}
        <div className="pointer-events-none -mt-6 h-6 bg-gradient-to-t from-white to-transparent dark:from-stone-900" />
      </CardContent>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}>
          <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)}
              className="absolute -top-8 right-0 text-white/80 hover:text-white text-sm">
              ✕ 关闭
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.thumb.replace('/thumbs/', '/').replace('.webp', '.png')}
              alt={lightbox.label}
              className="w-full rounded-xl shadow-2xl object-cover" />
            <p className="mt-2 text-center text-sm text-white/90">
              {lightbox.label.replace(/_/g, ' ')}
            </p>
            <button
              type="button"
              onClick={() => {
                const selected = selectedIds.includes(lightbox.assetId);
                selected ? onRemove(lightbox.assetId) : onAdd(lightbox.assetId, lightbox.label);
                setLightbox(null);
              }}
              className="mt-3 w-full rounded-lg bg-purple-600 py-2 text-sm font-medium text-white hover:bg-purple-700">
              {selectedIds.includes(lightbox.assetId) ? '✓ 已选中（点击取消）' : '＋ 使用此人像'}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ──────────────────────────────────────────────
// Unified media panel
// ──────────────────────────────────────────────

const MEDIA_LIMITS = { image: 8, video: 4, audio: 4 } as const;
const MEDIA_ZH     = { image: '图片', video: '视频', audio: '音频' } as const;
const MEDIA_COLOR  = {
  image: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  video: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  audio: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
} as const;

function MediaPanel({ items, onAddFiles, onRemove }: {
  items: MediaItem[];
  onAddFiles: (files: File[]) => void;
  onRemove: (idx: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  /** Return "图片1", "视频2" etc. for each item based on its type-local index. */
  function typeLabel(idx: number): string {
    const t = items[idx].mediaType!;
    const n = items.slice(0, idx + 1).filter(m => m.mediaType === t).length;
    return `${MEDIA_ZH[t]}${n}`;
  }

  return (
    <Card className="border-blue-100 dark:border-stone-700">
      <CardHeader className="pb-3 pt-4">
        <CardTitle className="text-sm font-semibold">📎 参考素材（可选）</CardTitle>
        <p className="text-xs text-muted-foreground">
          图片最多 8 张 · 视频最多 4 条 · 音频最多 4 条
        </p>
        <p className="text-xs text-purple-600 dark:text-purple-400">
          不支持真人人脸 · 可从下方人像库选取
        </p>
      </CardHeader>
      <CardContent className="space-y-3">

        {/* Added items — grouped by type */}
        {(['image', 'video', 'audio'] as const).map(t => {
          const group = items.map((item, idx) => ({ item, idx })).filter(({ item }) => item.mediaType === t);
          if (group.length === 0) return null;
          return (
            <div key={t} className="flex flex-wrap gap-2">
              {group.map(({ item, idx }) => {
                const label = typeLabel(idx);
                const isAvatar = item.url?.startsWith('asset://');
                const pct = item.uploadProgress ?? 0;
                return (
                  <div key={item.uid ?? idx}
                    className={`relative flex items-center gap-1 overflow-hidden rounded-lg border bg-background px-1.5 py-1 text-xs transition-colors ${
                      item.uploading ? 'border-blue-300 dark:border-blue-700' : 'border-border'
                    }`}>

                    {/* Preview / icon */}
                    {item.previewUrl ? (
                      <div className="relative h-8 w-8 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.previewUrl} alt="" className="h-full w-full rounded object-cover" />
                        {item.uploading && (
                          <div className="absolute inset-0 flex items-center justify-center rounded bg-black/50">
                            <span className="text-[9px] font-bold text-white">{pct}%</span>
                          </div>
                        )}
                      </div>
                    ) : t === 'video' ? (
                      <span className="shrink-0 text-base leading-none">{item.uploading ? '⏳' : '🎞'}</span>
                    ) : t === 'audio' ? (
                      <span className="shrink-0 text-base leading-none">{item.uploading ? '⏳' : '🎵'}</span>
                    ) : null}

                    {/* Type badge — shows percentage while uploading */}
                    <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                      isAvatar
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                        : MEDIA_COLOR[t]
                    }`}>
                      {item.uploading ? `${pct}%` : `${label}${isAvatar ? ' 人像' : ''}`}
                    </span>

                    {/* Remove — disabled while uploading */}
                    <button type="button" onClick={() => onRemove(idx)}
                      disabled={item.uploading}
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] hover:bg-destructive hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
                      ×
                    </button>

                    {/* Progress bar at bottom */}
                    {item.uploading && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-100 dark:bg-blue-900">
                        <div
                          className="h-full bg-blue-500 transition-all duration-200"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Upload trigger — always enabled; individual items show their own progress */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-blue-300 px-4 py-2.5 text-xs text-blue-500 hover:border-blue-500 hover:bg-blue-50 dark:border-stone-600 dark:text-blue-400 dark:hover:bg-stone-800"
        >
          <span className="text-sm font-medium">＋ 上传文件</span>
          <span className="text-muted-foreground">图片 / 视频 / 音频</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*,audio/*"
          multiple
          className="hidden"
          onChange={e => { onAddFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}
        />
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────
// Video thumbnail + lightbox
// ──────────────────────────────────────────────

/** Convert "W:H" ratio string to a CSS aspect-ratio value and a fixed height. */
function ratioStyle(ratio: string): { aspectRatio: string; height: string } {
  const [w, h] = ratio.split(':').map(Number);
  if (!w || !h) return { aspectRatio: '16/9', height: '96px' };
  // For portrait (h > w) use a taller thumb; for landscape use standard height
  const thumbH = h > w ? 160 : 96;
  return { aspectRatio: `${w}/${h}`, height: `${thumbH}px` };
}

function VideoThumb({ src, ratio = '16:9' }: { src: string; ratio?: string }) {
  const [open, setOpen] = useState(false);
  const { aspectRatio, height } = ratioStyle(ratio);

  return (
    <>
      {/* Thumbnail row */}
      <div className="flex items-end gap-3">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={src}
          style={{ aspectRatio, height, width: 'auto' }}
          className="cursor-pointer rounded-lg shadow-sm ring-1 ring-border hover:ring-blue-400 transition"
          onClick={() => setOpen(true)}
          title="点击放大"
        />
        <div className="flex flex-col gap-1.5">
          <button type="button" onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 dark:border-stone-600 dark:bg-stone-800 dark:text-blue-300">
            ⛶ 放大播放
          </button>
          <a href={src} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted dark:bg-stone-800">
            ↗ 新标签页打开
          </a>
        </div>
      </div>

      {/* Lightbox modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}>
          <div className="relative max-h-full max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setOpen(false)}
              className="absolute -top-8 right-0 text-white/80 hover:text-white text-sm">
              ✕ 关闭
            </button>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={src} controls autoPlay
              className="w-full max-h-[85vh] rounded-lg shadow-xl" />
          </div>
        </div>
      )}
    </>
  );
}

// ──────────────────────────────────────────────
// Prompt textarea with @ mention
// ──────────────────────────────────────────────

/** Get pixel {top, left} of a character at `index` inside a textarea. */
function getCaretCoords(ta: HTMLTextAreaElement, index: number): { top: number; left: number } {
  const mirror = document.createElement('div');
  const style = window.getComputedStyle(ta);
  for (const prop of [
    'boxSizing','width','height','overflowX','overflowY',
    'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
    'paddingTop','paddingRight','paddingBottom','paddingLeft',
    'fontStyle','fontVariant','fontWeight','fontStretch','fontSize',
    'fontSizeAdjust','lineHeight','fontFamily','letterSpacing','wordSpacing',
    'tabSize','whiteSpace','wordBreak','overflowWrap',
  ] as const) {
    mirror.style[prop as never] = style[prop as never];
  }
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.top = '0';
  mirror.style.left = '0';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordBreak = 'break-word';

  const text = ta.value.slice(0, index);
  mirror.textContent = text;

  const caret = document.createElement('span');
  caret.textContent = '\u200b';   // zero-width space to mark position
  mirror.appendChild(caret);
  document.body.appendChild(mirror);

  const taRect  = ta.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const caretRect  = caret.getBoundingClientRect();

  document.body.removeChild(mirror);

  return {
    left: caretRect.left - mirrorRect.left + taRect.left - ta.scrollLeft,
    top:  caretRect.top  - mirrorRect.top  + taRect.top  - ta.scrollTop,
  };
}

function PromptWithMention({ value, onChange, mentionItems }: {
  value: string;
  onChange: (v: string) => void;
  mentionItems: string[];
}) {
  const taRef    = useRef<HTMLTextAreaElement>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const [open, setOpen]         = useState(false);
  const [query, setQuery]       = useState('');
  const [atPos, setAtPos]       = useState(-1);
  const [activeIdx, setActiveIdx] = useState(0);
  const [dropPos, setDropPos]   = useState({ top: 0, left: 0 });

  const filtered = mentionItems.filter(m => m.startsWith(query));

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val    = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    onChange(val);

    const slice   = val.slice(0, cursor);
    const atIndex = slice.lastIndexOf('@');
    const fragment = slice.slice(atIndex + 1);

    if (atIndex !== -1 && !fragment.includes(' ') && !fragment.includes('\n')) {
      setAtPos(atIndex);
      setQuery(fragment);
      setActiveIdx(0);

      // Compute pixel position of the '@' character relative to wrapper div
      const ta   = e.target;
      const wrap = wrapRef.current;
      if (wrap) {
        const coords    = getCaretCoords(ta, atIndex);
        const wrapRect  = wrap.getBoundingClientRect();
        setDropPos({
          left: coords.left - wrapRect.left,
          top:  coords.top  - wrapRect.top,   // dropdown appears above: subtract dropdown height via CSS
        });
      }
      setOpen(true);
    } else {
      setOpen(false);
    }
  }

  function insertMention(item: string) {
    const ta = taRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart ?? value.length;
    const next   = value.slice(0, atPos) + item + value.slice(cursor);
    onChange(next);
    setOpen(false);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = atPos + item.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown')  { e.preventDefault(); setActiveIdx(i => (i + 1) % filtered.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => (i - 1 + filtered.length) % filtered.length); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filtered[activeIdx]); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  return (
    <div ref={wrapRef} className="relative">
      <textarea
        id="prompt"
        ref={taRef}
        rows={6}
        required
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="描述你想生成的视频内容，输入 @ 快速引用素材…"
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {open && filtered.length > 0 && (
        <ul
          className="absolute z-50 w-36 overflow-hidden rounded-md border border-border bg-popover shadow-lg"
          style={{
            left: dropPos.left,
            // Place above the '@': shift up by dropdown height (~32px per item) + line height (~20px)
            top: dropPos.top - filtered.length * 32 - 20,
          }}
        >
          {filtered.map((item, i) => (
            <li key={item}
              onMouseDown={() => insertMention(item)}
              className={`cursor-pointer px-3 py-1.5 text-sm ${i === activeIdx ? 'bg-blue-500 text-white' : 'hover:bg-muted'}`}>
              @{item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Status badge
// ──────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    succeeded: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    failed:    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    running:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    queued:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    pending:   'bg-gray-100 text-gray-700 dark:bg-stone-700 dark:text-stone-300',
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${colorMap[status] || colorMap.pending}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

// ──────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────

export default function VideoPage() {
  const { user, isAuthenticated, logout } = useAuth();
  const [prompt, setPrompt]           = useState('');
  const [mediaItems, setMediaItems]   = useState<MediaItem[]>([]);
  const [model, setModel]             = useState(MODELS[1].value);
  const [resolution, setResolution]   = useState('480p');
  const [ratio, setRatio]             = useState('16:9');
  const [duration, setDuration]       = useState(4);
  const [generateAudio, setGenerateAudio] = useState(true);
  const [watermark, setWatermark]     = useState(false);
  const [webSearch, setWebSearch]     = useState(false);

  const [apiUrl, setApiUrl]           = useState('https://tokens.fidelityai.net/');
  const [apiKey, setApiKey]           = useState('');

  const [avatars, setAvatars]         = useState<AvatarItem[]>([]);

  const [submitting, setSubmitting]   = useState(false);
  const [task, setTask]               = useState<TaskData | null>(null);

  interface VideoHistoryItem {
    id: number;
    task_id: string;
    prompt: string;
    model: string | null;
    status: string;
    video_url: string | null;
    resolution: string | null;
    duration: number | null;
    ratio: string | null;
    created_at: string;
  }
  const [videoHistory, setVideoHistory] = useState<VideoHistoryItem[]>([]);
  const [historyOpen, setHistoryOpen]   = useState(false);
  const [polling, setPolling]         = useState(false);
  const [error, setError]             = useState('');

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const taskIdRef  = useRef<string | null>(null);

  const TERMINAL = ['succeeded', 'failed', 'expired', 'cancelled'];

  // ── Load video history ────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    fastifyClient.get<{ success: boolean; data: VideoHistoryItem[] }>('/video/history')
      .then(res => setVideoHistory(res.data))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load avatar library ───────────────────────
  useEffect(() => {
    fetch('/avatars/index.json')
      .then(r => r.json())
      .then((data: AvatarItem[]) => setAvatars(data.reverse()))
      .catch(() => { /* silent fail — library just stays empty */ });
  }, []);

  // ── Polling ──────────────────────────────────
  const pollTask = useCallback(async (taskId: string) => {
    try {
      const res = await fastifyClient.get<{ success: boolean; data: TaskData }>(`/video/task/${taskId}`);
      const data = res.data;
      setTask(data);
      if (TERMINAL.includes(data.status)) {
        setPolling(false);
        if (pollRef.current) clearInterval(pollRef.current);
        // Persist final state so page refresh can restore it
        localStorage.setItem('video_task', JSON.stringify(data));
      }
    } catch (err) {
      // Show error but keep polling — a transient network error shouldn't stop retries
      setError(err instanceof Error ? err.message : '查询失败，将继续重试');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Restore localStorage values on mount ──
  useEffect(() => {
    const savedUrl = localStorage.getItem('video_api_url');
    const savedKey = localStorage.getItem('video_api_key');
    if (savedUrl) setApiUrl(savedUrl);
    if (savedKey) setApiKey(savedKey);
  }, []);

  // ── Restore task on mount + visibility polling ──
  useEffect(() => {
    const saved = localStorage.getItem('video_task');
    let taskId: string | null = null;

    if (saved) {
      try {
        const data: TaskData = JSON.parse(saved);
        setTask(data);
        taskIdRef.current = data.taskId;
        if (!TERMINAL.includes(data.status)) {
          taskId = data.taskId;
          setPolling(true);
          pollRef.current = setInterval(() => pollTask(data.taskId), 30_000);
          setTimeout(() => pollTask(data.taskId), 500);
        }
      } catch { /* ignore */ }
    }

    // When tab becomes visible again, poll immediately — browsers throttle
    // setInterval in background tabs (sometimes to >1 min).
    function onVisible() {
      if (document.visibilityState !== 'visible') return;
      // Read current taskId from ref to handle tasks started after mount
      const id = taskIdRef.current;
      if (id) pollTask(id);
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Add / remove media ────────────────────────
  async function addFiles(files: File[]) {
    const MAX_SIZE = 50 * 1024 * 1024;
    const MAX_VIDEO_DURATION = 15;
    const rejected: string[] = [];
    // Track how many of each type are being added in this batch (for limit check)
    const batchCount = { image: 0, video: 0, audio: 0 };

    for (const f of files) {
      const mediaType = f.type.startsWith('image/') ? 'image' as const
                      : f.type.startsWith('video/') ? 'video' as const
                      : f.type.startsWith('audio/') ? 'audio' as const
                      : null;
      if (!mediaType) continue;

      if (f.size > MAX_SIZE) {
        rejected.push(`${f.name}（超过 50MB）`);
        continue;
      }

      if (mediaType === 'video') {
        try {
          const { duration, width, height } = await getVideoInfo(f);
          if (duration > MAX_VIDEO_DURATION) {
            rejected.push(`${f.name}（时长 ${Math.round(duration)}s，超过 15s）`);
            continue;
          }
          if (width * height < 409600) {
            rejected.push(`${f.name}（分辨率 ${width}×${height} 不足，最小需要 640×640）`);
            continue;
          }
        } catch {
          rejected.push(`${f.name}（无法读取视频信息）`);
          continue;
        }
      }

      const currentCount = mediaItems.filter(m => m.mediaType === mediaType).length
                         + batchCount[mediaType];
      if (currentCount >= MEDIA_LIMITS[mediaType]) continue;
      batchCount[mediaType]++;

      // Add to list immediately with uploading state, then upload in background
      const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: MediaItem = {
        uid, mediaType, mimeType: f.type, name: f.name,
        uploading: true, uploadProgress: 0,
        ...(mediaType === 'image' ? { previewUrl: URL.createObjectURL(f) } : {}),
      };
      setMediaItems(prev => [...prev, item]);

      uploadWithProgress(f, (pct) => {
        setMediaItems(prev =>
          prev.map(m => m.uid === uid ? { ...m, uploadProgress: pct } : m)
        );
      }).then(url => {
        setMediaItems(prev =>
          prev.map(m => m.uid === uid ? { ...m, url, uploading: false, uploadProgress: 100 } : m)
        );
      }).catch(err => {
        const msg = err instanceof Error ? err.message : '未知错误';
        setError(`${f.name} 上传失败：${msg}`);
        setMediaItems(prev => {
          const found = prev.find(m => m.uid === uid);
          if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
          return prev.filter(m => m.uid !== uid);
        });
      });
    }

    if (rejected.length) setError(`以下文件已跳过：${rejected.join('、')}`);
  }

  function removeItem(idx: number) {
    setMediaItems(prev => {
      const item = prev[idx];
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }

  // ── Submit ────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setError(''); setTask(null); setSubmitting(true);
    if (pollRef.current) clearInterval(pollRef.current);

    try {
      const imgItems = mediaItems.filter(m => m.mediaType === 'image');
      const vidItems = mediaItems.filter(m => m.mediaType === 'video');
      const audItems = mediaItems.filter(m => m.mediaType === 'audio');
      const res = await fastifyClient.post<{ success: boolean; data: { taskId: string; status: string } }>('/video/generate', {
        prompt: prompt.trim(),
        images: imgItems.map(({ url }) => ({ url })),
        videos: vidItems.map(({ url }) => ({ url })),
        audios: audItems.map(({ url }) => ({ url })),
        model, resolution, ratio, duration, generateAudio, watermark, webSearch,
        ...(apiUrl.trim() ? { apiUrl: apiUrl.trim() } : {}),
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });

      const { taskId, callbackUrl } = res.data as { taskId: string; status: string; callbackUrl?: string };
      const initialTask = { taskId, status: res.data.status, videoUrl: null, error: null, callbackUrl: callbackUrl || null };
      taskIdRef.current = taskId;
      setTask(initialTask);
      localStorage.setItem('video_task', JSON.stringify(initialTask));
      setPolling(true);

      // 刷新视频历史
      const token = localStorage.getItem('accessToken');
      if (token) {
        setTimeout(() => {
          fastifyClient.get<{ success: boolean; data: VideoHistoryItem[] }>('/video/history')
            .then(r => setVideoHistory(r.data)).catch(() => {});
        }, 1000);
      }

      // Always poll every 30s; webhook is a bonus push, not a replacement.
      const interval = 30_000;
      pollRef.current = setInterval(() => pollTask(taskId), interval);
      // First check after 15s regardless
      setTimeout(() => pollTask(taskId), 15_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  const isRunning      = task && !['succeeded', 'failed'].includes(task.status);
  const anyUploading   = mediaItems.some(m => m.uploading);
  const missingApiConf = !apiUrl.trim() || !apiKey.trim();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-sky-50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950">

      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur dark:bg-stone-900/80">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://www.radiotranslator.com/logof.png" alt="logo" className="h-9 w-auto object-contain" />
            <h1 className="text-2xl font-light tracking-wide leading-tight">FidelityAI Seedance 2.0 视频制作工具</h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/image-chat"
              className="hidden sm:inline-flex rounded-full border border-blue-200 bg-white px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:border-stone-600 dark:bg-stone-800 dark:text-blue-300 transition">
              Gemini 对话作图
            </a>
            <a href="/image"
              className="hidden sm:inline-flex rounded-full border border-blue-200 bg-white px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:border-stone-600 dark:bg-stone-800 dark:text-blue-300 transition">
              Gemini 标准作图
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

      <div className="mx-auto max-w-screen-2xl px-4 py-6">
        <div className="flex flex-col gap-6 lg:flex-row">

          {/* ── Left: form ── */}
          <div className="flex-1 min-w-0 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Reference media — unified upload panel */}
              <MediaPanel
                items={mediaItems}
                onAddFiles={addFiles}
                onRemove={removeItem}
              />

              {/* Avatar library */}
              <AvatarLibrary
                avatars={avatars}
                selectedIds={mediaItems.filter(m => m.url?.startsWith('asset://')).map(m => m.url!.replace('asset://', ''))}
                onAdd={(assetId, label) => {
                  const imgCount = mediaItems.filter(m => m.mediaType === 'image').length;
                  if (imgCount >= MEDIA_LIMITS.image) return;
                  const av = avatars.find(a => a.assetId === assetId);
                  setMediaItems(prev => [...prev, {
                    mediaType: 'image', url: `asset://${assetId}`, name: label, previewUrl: av?.thumb,
                  }]);
                }}
                onRemove={assetId => setMediaItems(prev => prev.filter(m => m.url !== `asset://${assetId}`))}
              />

              {/* Prompt */}
              <Card className="border-blue-100 dark:border-stone-700">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <Label htmlFor="prompt" className="text-sm font-semibold">提示词（Prompt）</Label>
                    <span className="text-[11px] text-muted-foreground">输入 @ 快速引用素材</span>
                  </div>

                  {/* @ mention textarea wrapper */}
                  <PromptWithMention
                    value={prompt}
                    onChange={setPrompt}
                    mentionItems={[
                      ...mediaItems.filter(m => m.mediaType === 'image').map((_, i) => `图片${i + 1}`),
                      ...mediaItems.filter(m => m.mediaType === 'video').map((_, i) => `视频${i + 1}`),
                      ...mediaItems.filter(m => m.mediaType === 'audio').map((_, i) => `音频${i + 1}`),
                    ]}
                  />

                  <div className="flex flex-wrap gap-1.5">
                    {EXAMPLE_PROMPTS.map(p => (
                      <button key={p} type="button" onClick={() => setPrompt(p)}
                        className="rounded-full border border-blue-200 bg-white px-2.5 py-0.5 text-xs text-blue-700 hover:bg-blue-50 dark:border-stone-600 dark:bg-stone-800 dark:text-blue-300 dark:hover:bg-stone-700">
                        {p.length > 22 ? p.slice(0, 22) + '…' : p}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

              {missingApiConf && (
                <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400">
                  请先在右侧「接口配置」中填写接口地址和 API Key
                </p>
              )}

              <Button type="submit" size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-base"
                disabled={submitting || !!isRunning || anyUploading || !prompt.trim() || missingApiConf}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    提交中…
                  </span>
                ) : anyUploading ? '素材上传中，请等待…' : isRunning ? '生成中，请等待…' : '🎬 生成视频'}
              </Button>
            </form>

            {/* 历史记录 */}
            {videoHistory.length > 0 && (
              <Card className="border-blue-100 dark:border-stone-700">
                <CardHeader className="pb-2 pt-4 cursor-pointer select-none" onClick={() => setHistoryOpen(v => !v)}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">🕒 历史记录（{videoHistory.length}）</CardTitle>
                    <span className="text-muted-foreground text-sm">{historyOpen ? '▲' : '▼'}</span>
                  </div>
                </CardHeader>
                {historyOpen && (
                  <CardContent>
                    <div className="space-y-2">
                      {videoHistory.map(item => (
                        <div key={item.id} className="rounded-lg border border-border px-3 py-2">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <StatusBadge status={item.status} />
                            <span className="text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleString('zh-CN')}</span>
                          </div>
                          <p className="text-xs font-medium line-clamp-2">{item.prompt}</p>
                          {item.video_url && (
                            <a href={item.video_url} target="_blank" rel="noreferrer"
                              className="mt-1 inline-block text-xs text-blue-600 hover:underline dark:text-blue-400">
                              ▶ 查看视频
                            </a>
                          )}
                          {item.resolution && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{item.resolution} · {item.duration}s · {item.ratio}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Task status & result */}
            {task && (
              <Card className="border-blue-100 dark:border-stone-700">
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-sm font-semibold">任务状态</CardTitle>
                    <button type="button" onClick={() => { setTask(null); localStorage.removeItem('video_task'); if (pollRef.current) clearInterval(pollRef.current); setPolling(false); }}
                      className="text-[11px] text-muted-foreground hover:text-destructive">清除</button>
                    <div className="flex items-center gap-1.5">
                      {task.webhookReceived && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          Webhook
                        </span>
                      )}
                      <StatusBadge status={task.status} />
                    </div>
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground">ID: {task.taskId}</p>
                  {task.callbackUrl && (
                    <p className="truncate font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                      回调: {task.callbackUrl}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {polling && (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <svg className="h-3.5 w-3.5 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        每 30 秒自动查询，视频生成约需 1–3 分钟
                      </div>
                      <button type="button" onClick={() => pollTask(task.taskId)}
                        className="shrink-0 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">
                        立即刷新
                      </button>
                    </div>
                  )}

                  {task.error && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{task.error}</p>
                  )}

                  {task.videoUrl && (
                    <VideoThumb src={task.videoUrl} ratio={task.ratio || ratio} />
                  )}

                  {task.status === 'succeeded' && !task.videoUrl && (
                    <p className="text-xs text-muted-foreground">视频已生成，但暂时无法解析播放地址。</p>
                  )}

                  {/* Metadata */}
                  {task.status === 'succeeded' && (
                    <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/40 p-3 text-xs">
                      {task.resolution && <div><span className="text-muted-foreground">分辨率</span><br /><span className="font-medium">{task.resolution}</span></div>}
                      {task.duration   && <div><span className="text-muted-foreground">时长</span><br /><span className="font-medium">{task.duration}s</span></div>}
                      {task.fps        && <div><span className="text-muted-foreground">帧率</span><br /><span className="font-medium">{task.fps} fps</span></div>}
                      {task.ratio      && <div><span className="text-muted-foreground">比例</span><br /><span className="font-medium">{task.ratio}</span></div>}
                      {task.seed != null && <div><span className="text-muted-foreground">Seed</span><br /><span className="font-mono font-medium">{task.seed}</span></div>}
                      {task.usage?.total_tokens != null && <div><span className="text-muted-foreground">Tokens</span><br /><span className="font-medium">{task.usage.total_tokens.toLocaleString()}</span></div>}
                      {task.webSearchCount != null && (
                        <div><span className="text-muted-foreground">联网搜索</span><br />
                          <span className={`font-medium ${task.webSearchCount > 0 ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                            {task.webSearchCount > 0 ? `${task.webSearchCount} 次` : '未使用'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Right: params ── */}
          <aside className="w-full lg:w-72 xl:w-80 shrink-0">
            <div className="lg:sticky lg:top-6 space-y-3">

              {/* API config */}
              <Card className="border-blue-100 dark:border-stone-700">
                <CardHeader className="pb-3 pt-4">
                  <CardTitle className="text-sm font-semibold">接口配置</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">接口地址</Label>
                    <input
                      type="text"
                      placeholder="https://tokens.fidelityai.net/"
                      value={apiUrl}
                      onChange={e => { setApiUrl(e.target.value); localStorage.setItem('video_api_url', e.target.value); }}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">API Key</Label>
                    <input
                      type="password"
                      placeholder="sk-…"
                      value={apiKey}
                      onChange={e => { setApiKey(e.target.value); localStorage.setItem('video_api_key', e.target.value); }}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  {(apiUrl.trim() || apiKey.trim()) && (
                    <button type="button"
                      onClick={() => { setApiUrl(''); setApiKey(''); localStorage.removeItem('video_api_url'); localStorage.removeItem('video_api_key'); }}
                      className="text-[11px] text-muted-foreground hover:text-destructive">
                      清除配置
                    </button>
                  )}
                  <p className="text-[11px] text-muted-foreground">留空则使用服务器默认配置</p>
                </CardContent>
              </Card>

              <Card className="border-blue-100 dark:border-stone-700">
                <CardHeader className="pb-3 pt-4">
                  <CardTitle className="text-sm font-semibold">参数设置</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">

                  <ChipGroup label="模型 Model" options={MODELS} value={model} onChange={v => setModel(v as string)} />
                  <ChipGroup label="分辨率 Resolution" options={RESOLUTIONS} value={resolution} onChange={v => setResolution(v as string)} />
                  <ChipGroup label="画面比例 Ratio" options={RATIOS} value={ratio} onChange={v => setRatio(v as string)} />
                  <ChipGroup label="时长 Duration（4–15s）" options={DURATIONS} value={duration} onChange={v => setDuration(v as number)} />

                  <div className="h-px bg-border" />

                  <Toggle enabled={generateAudio} onToggle={() => setGenerateAudio(v => !v)} label="生成背景音频" />
                  <Toggle enabled={watermark} onToggle={() => setWatermark(v => !v)} label="添加水印" />
                  <Toggle enabled={webSearch} onToggle={() => setWebSearch(v => !v)} label="联网搜索（提升时效性）" />

                  <div className="h-px bg-border" />

                  <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-700 space-y-1 dark:bg-stone-800 dark:text-blue-300">
                    <p className="font-semibold">使用说明</p>
                    <p>• 提示词为必填，支持中英文</p>
                    <p>• 参考图片：上传或粘贴 URL（最多 8 张）</p>
                    <p>• 参考视频：仅支持 URL（最多 4 条）</p>
                    <p>• 参考音频：上传或粘贴 URL（最多 4 条）</p>
                    <p>• 视频生成约需 1–3 分钟，每 30 秒自动查询</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
