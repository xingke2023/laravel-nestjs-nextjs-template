'use client';

import { useEffect, useRef, useState } from 'react';
import { fastifyClient } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemeColorPicker } from '@/components/theme-color-picker';

interface RefImage {
  mimeType: string;
  data: string;
  previewUrl: string;
  name: string;
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

const MODEL = 'gemini-3.1-flash-image-preview'

const ASPECT_RATIOS = [
  { value: '',     label: '自动' },
  { value: '1:1',  label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3',  label: '4:3' },
  { value: '3:4',  label: '3:4' },
]

const IMAGE_SIZES = [
  { value: '512', label: '512' },
  { value: '1K',  label: '1K' },
  { value: '2K',  label: '2K' },
  { value: '4K',  label: '4K' },
]

const THINKING_LEVELS = [
  { value: 'MINIMAL', label: 'Minimal' },
  { value: 'LOW',     label: 'Low' },
  { value: 'MEDIUM',  label: 'Medium' },
  { value: 'HIGH',    label: 'High' },
]

const EXAMPLE_PROMPTS = [
  '一只可爱的猫咪坐在樱花树下，水彩风格',
  'A futuristic city at night with neon lights, cyberpunk style',
  '中国水墨画风格的山水，云雾缭绕',
  'Cozy coffee shop in autumn, warm lighting, illustration',
]

const SCENARIO_TABLE = [
  { scene: '电商产品合集', model: 'Flash', obj: '8-10', role: '0',  total: '8-10', desc: '多产品同框展示' },
  { scene: '品牌角色故事', model: 'Pro',   obj: '2-3',  role: '4-5', total: '6-8',  desc: '角色在不同场景冒险' },
  { scene: '产品+代言人',  model: 'Flash', obj: '5-6',  role: '2-3', total: '7-9',  desc: '角色手持/展示产品' },
  { scene: '游戏角色设计', model: 'Pro',   obj: '3-4',  role: '4-5', total: '7-9',  desc: '多角色交互场景' },
  { scene: '家居场景搭配', model: 'Flash', obj: '8-10', role: '0',  total: '8-10', desc: '多家具/装饰品组合' },
]

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function ChipGroup({ label, options, value, onChange }: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
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
  )
}

function SliderParam({ label, min, max, step, value, onChange, fmt, hints }: {
  label: string; min: number; max: number; step: number; value: number
  onChange: (v: number) => void; fmt: (v: number) => string; hints: string[]
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
      <div className="flex justify-between text-base text-muted-foreground">
        {hints.map((h, i) => <span key={i}>{h}</span>)}
      </div>
    </div>
  )
}

function Toggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="flex items-center gap-2.5 cursor-pointer" onClick={onToggle}>
      <div className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-stone-600'}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <Label className="cursor-pointer text-base">{label}</Label>
    </div>
  )
}

function ImageUploadGrid({ images, maxCount, onAdd, onRemove, inputRef }: {
  images: RefImage[]
  maxCount: number
  onAdd: (files: File[]) => void
  onRemove: (idx: number) => void
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {images.map((img, idx) => (
        <div key={idx} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.previewUrl} alt={img.name} className="h-full w-full object-cover" />
          <button type="button" onClick={() => onRemove(idx)}
            className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white text-base hover:bg-black">
            ×
          </button>
        </div>
      ))}
      {images.length < maxCount && (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-blue-300 text-blue-400 transition hover:border-blue-500 hover:text-blue-600 dark:border-stone-600 dark:text-stone-500">
          <span className="text-lg leading-none">+</span>
          <span className="text-base">添加</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { onAdd(Array.from(e.target.files ?? [])); e.target.value = '' }} />
    </div>
  )
}

export default function ImagePage() {
  const { user, isAuthenticated, logout } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('');
  const [imageSize, setImageSize] = useState('1K');
  const [thinkingLevel, setThinkingLevel] = useState('MINIMAL');
  const [temperature, setTemperature] = useState(1.0);
  const [topP, setTopP] = useState(0.95);
  const [enableSearch, setEnableSearch] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://tokens.fidelityai.net/');
  const [objectImages, setObjectImages] = useState<RefImage[]>([]);
  const [characterImages, setCharacterImages] = useState<RefImage[]>([]);
  const [result, setResult] = useState<ImageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const objectInputRef = useRef<HTMLInputElement>(null);
  const characterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    setHistoryLoading(true);
    fastifyClient.get<{ success: boolean; data: HistoryItem[] }>('/image/history')
      .then(res => setHistory(res.data))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  async function loadHistoryItem(item: HistoryItem) {
    try {
      const res = await fastifyClient.get<{ success: boolean; data: { image_data: string; mime_type: string; prompt: string; model: string; caption: string } }>(`/image/history/${item.id}`);
      const d = res.data;
      setResult({ mimeType: d.mime_type, image: d.image_data, caption: d.caption, prompt: d.prompt, model: d.model || '' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {}
  }

  async function addImages(files: File[], current: RefImage[], max: number, setter: React.Dispatch<React.SetStateAction<RefImage[]>>) {
    const newImgs: RefImage[] = await Promise.all(
      files.slice(0, max - current.length).map(async f => ({
        mimeType: f.type, data: await fileToBase64(f),
        previewUrl: URL.createObjectURL(f), name: f.name,
      }))
    )
    setter(prev => [...prev, ...newImgs])
  }

  function removeImage(idx: number, setter: React.Dispatch<React.SetStateAction<RefImage[]>>) {
    setter(prev => { URL.revokeObjectURL(prev[idx].previewUrl); return prev.filter((_, i) => i !== idx) })
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim()) return
    setError(''); setResult(null); setLoading(true)
    try {
      const res = await fastifyClient.post<{ success: boolean; data: ImageResult }>('/image/generate', {
        prompt: prompt.trim(), model: MODEL, historyType: 'image',
        aspectRatio, imageSize, thinkingLevel, temperature, topP, enableSearch,
        objectImages: objectImages.map(({ mimeType, data }) => ({ mimeType, data })),
        characterImages: characterImages.map(({ mimeType, data }) => ({ mimeType, data })),
        ...(baseUrl.trim() ? { baseUrl: baseUrl.trim(), ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) } : {}),
      })
      setResult(res.data);
      // 刷新历史记录
      const token = localStorage.getItem('accessToken');
      if (token) {
        fastifyClient.get<{ success: boolean; data: HistoryItem[] }>('/image/history')
          .then(r => setHistory(r.data)).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  function handleDownload() {
    if (!result) return
    const link = document.createElement('a')
    link.href = `data:${result.mimeType};base64,${result.image}`
    link.download = `gemini-${Date.now()}.png`
    link.click()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950">

      {/* 顶部标题栏 */}
      <header className="border-b bg-white/80 backdrop-blur dark:bg-stone-900/80">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎨</span>
            <div>
              <h1 className="text-2xl font-light leading-tight">Gemini最新版Nano Banana 2作图工具</h1>
              <p className="text-base text-muted-foreground">{MODEL}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/video"
              className="rounded-full border border-blue-200 bg-white px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:border-stone-600 dark:bg-stone-800 dark:text-blue-300 transition">
              Seedance 2.0 视频制作工具
            </a>
            <a href="/image-chat"
              className="rounded-full border border-blue-200 bg-white px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:border-stone-600 dark:bg-stone-800 dark:text-blue-300 transition">
              对话模式
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
                <button
                  type="button"
                  onClick={() => { logout(); window.location.href = '/login'; }}
                  className="text-xs text-muted-foreground hover:text-destructive transition"
                >
                  退出
                </button>
              </div>
            ) : (
              <a href="/login"
                className="rounded-full bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 transition">
                登录
              </a>
            )}
          </div>
        </div>
      </header>

      {/* 主体：左内容 + 右参数 */}
      <div className="mx-auto max-w-screen-2xl px-4 py-6">
        <div className="flex flex-col gap-6 lg:flex-row">

          {/* ── 左侧主内容 ── */}
          <div className="flex-1 min-w-0 space-y-4">

            <form onSubmit={handleGenerate} className="space-y-4">

              {/* 参考图 */}
              <Card className="border-blue-100 dark:border-stone-700">
                <CardHeader className="pb-3 pt-4">
                  <CardTitle className="text-base font-semibold">参考图</CardTitle>
                  <p className="text-base text-muted-foreground">对象保真最多 10 张 · 角色一致性最多 4 张</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 对象保真 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-base font-medium">🖼 对象保真参考图</p>
                        <p className="text-base text-muted-foreground">产品、物品、场景，保持外观一致</p>
                      </div>
                      <span className="text-base text-muted-foreground tabular-nums">{objectImages.length}/10</span>
                    </div>
                    <ImageUploadGrid images={objectImages} maxCount={10}
                      onAdd={f => addImages(f, objectImages, 10, setObjectImages)}
                      onRemove={idx => removeImage(idx, setObjectImages)}
                      inputRef={objectInputRef} />
                  </div>
                  {/* 角色一致 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-base font-medium">👤 角色一致性参考图</p>
                        <p className="text-base text-muted-foreground">人物、角色，保持面貌服装风格一致</p>
                      </div>
                      <span className="text-base text-muted-foreground tabular-nums">{characterImages.length}/4</span>
                    </div>
                    <ImageUploadGrid images={characterImages} maxCount={4}
                      onAdd={f => addImages(f, characterImages, 4, setCharacterImages)}
                      onRemove={idx => removeImage(idx, setCharacterImages)}
                      inputRef={characterInputRef} />
                  </div>
                </CardContent>
              </Card>

              {/* 提示词 */}
              <Card className="border-blue-100 dark:border-stone-700">
                <CardContent className="pt-4 space-y-3">
                  <Label htmlFor="prompt" className="text-base font-semibold">提示词（Prompt）</Label>
                  <Textarea id="prompt" rows={5} required className="resize-none"
                    placeholder="描述你想生成的图片，例如：一只在草地上奔跑的金毛犬，阳光明媚，写实风格"
                    value={prompt} onChange={e => setPrompt(e.target.value)} />
                  <div className="flex flex-wrap gap-1.5">
                    {EXAMPLE_PROMPTS.map(p => (
                      <button key={p} type="button" onClick={() => setPrompt(p)}
                        className="rounded-full border border-blue-200 bg-white px-2.5 py-0.5 text-base text-blue-700 hover:bg-blue-50 dark:border-stone-600 dark:bg-stone-800 dark:text-blue-300 dark:hover:bg-stone-700">
                        {p.length > 20 ? p.slice(0, 20) + '…' : p}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-base text-destructive">{error}</p>}

              <Button type="submit" size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-base" disabled={loading || !prompt.trim()}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    生成中，请稍候…
                  </span>
                ) : '✨ 生成图片'}
              </Button>
            </form>

            {/* 生成结果 */}
            {result && (
              <Card className="border-blue-100 dark:border-stone-700">
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">生成结果</CardTitle>
                    <Button size="sm" variant="outline" onClick={handleDownload} className="h-7 text-base">↓ 下载</Button>
                  </div>
                  <p className="text-base text-muted-foreground line-clamp-1">{result.prompt}</p>
                  <p className="text-base text-blue-500">{result.model}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`data:${result.mimeType};base64,${result.image}`} alt={result.prompt}
                    className="w-full rounded-lg object-contain shadow-sm" />
                  {result.caption && (
                    <p className="rounded-md bg-blue-50 p-3 text-base text-blue-800 dark:bg-stone-700/50 dark:text-blue-200">{result.caption}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 历史记录 */}
            {history.length > 0 && (
              <Card className="border-blue-100 dark:border-stone-700">
                <CardHeader className="pb-2 pt-4 cursor-pointer select-none" onClick={() => setHistoryOpen(v => !v)}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">🕒 历史记录（{history.length}）</CardTitle>
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
                          <p className="text-xs text-muted-foreground mt-0.5">{item.model} · {new Date(item.created_at).toLocaleString('zh-CN')}</p>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}
            {historyLoading && (
              <p className="text-sm text-muted-foreground text-center py-2">加载历史记录…</p>
            )}

            {/* 场景说明表 */}
            <Card className="border-blue-100 bg-blue-50/40 dark:border-stone-700 dark:bg-stone-800/30">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-base font-semibold">📚 参考图场景配额策略</CardTitle>
                <p className="text-base text-muted-foreground">每次请求最多 14 张参考图</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-base">
                    <thead>
                      <tr className="border-b border-blue-200 dark:border-stone-600">
                        {['场景', '模型', '对象', '角色', '合计', '说明'].map(h => (
                          <th key={h} className="py-2 pr-3 text-left font-semibold text-blue-700 dark:text-blue-300 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100 dark:divide-stone-700">
                      {SCENARIO_TABLE.map(row => (
                        <tr key={row.scene} className="hover:bg-blue-50/60 dark:hover:bg-stone-700/30">
                          <td className="py-1.5 pr-3 font-medium whitespace-nowrap">{row.scene}</td>
                          <td className="py-1.5 pr-3">
                            <span className={`rounded px-1.5 py-0.5 text-base font-medium ${
                              row.model === 'Pro'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                            }`}>{row.model}</span>
                          </td>
                          <td className="py-1.5 pr-3 text-muted-foreground">{row.obj}</td>
                          <td className="py-1.5 pr-3 text-muted-foreground">{row.role}</td>
                          <td className="py-1.5 pr-3 font-semibold text-blue-600 dark:text-blue-400">{row.total}</td>
                          <td className="py-1.5 text-muted-foreground">{row.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* ── 右侧参数面板 ── */}
          <aside className="w-full lg:w-72 xl:w-80 shrink-0 order-first lg:order-last">
            <div className="lg:sticky lg:top-6 space-y-3">
              <Card className="border-blue-100 dark:border-stone-700">
                <CardHeader className="pb-3 pt-4">
                  <CardTitle className="text-base font-semibold">参数设置</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-base text-muted-foreground uppercase tracking-wide">Base URL</Label>
                      <input
                        type="text"
                        value={baseUrl}
                        onChange={e => setBaseUrl(e.target.value)}
                        placeholder="留空使用服务器默认"
                        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-base outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 dark:focus:border-blue-500 dark:focus:ring-blue-900"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-base text-muted-foreground uppercase tracking-wide">API Key</Label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="留空使用服务器默认"
                        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-base outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 dark:focus:border-blue-500 dark:focus:ring-blue-900"
                      />
                    </div>
                  </div>

                  <div className="h-px bg-border" />

                  <ChipGroup label="宽高比 Aspect Ratio" options={ASPECT_RATIOS} value={aspectRatio} onChange={setAspectRatio} />
                  <ChipGroup label="分辨率 Image Size" options={IMAGE_SIZES} value={imageSize} onChange={setImageSize} />
                  <ChipGroup label="思考深度 Thinking" options={THINKING_LEVELS} value={thinkingLevel} onChange={setThinkingLevel} />

                  <div className="h-px bg-border" />

                  <SliderParam label="温度 Temperature" min={0} max={2} step={0.1}
                    value={temperature} onChange={setTemperature}
                    fmt={v => v.toFixed(1)}
                    hints={['0.0 精确', '1.0 默认', '2.0 创意']} />

                  <SliderParam label="topP" min={0} max={1} step={0.01}
                    value={topP} onChange={setTopP}
                    fmt={v => v.toFixed(2)}
                    hints={['0.0', '0.95 默认', '1.0']} />

                  <div className="h-px bg-border" />

                  <Toggle enabled={enableSearch} onToggle={() => setEnableSearch(v => !v)}
                    label="Google Image Search 联网搜图" />

                </CardContent>
              </Card>
            </div>
          </aside>

        </div>
      </div>
    </div>
  )
}
