'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { fastifyClient } from '@/lib/api/client';

const CATEGORIES = [
  { key: 'top',       label: '上衣' },
  { key: 'pants',     label: '裤子' },
  { key: 'skirt',     label: '裙子' },
  { key: 'accessory', label: '配饰' },
] as const;

type CategoryKey = typeof CATEGORIES[number]['key'];

interface ClothingItem {
  id: number;
  user_id: string;
  category: CategoryKey;
  name: string | null;
  image_url: string;
  filename: string;
  created_at: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export default function ClothingPage() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [activeTab, setActiveTab] = useState<CategoryKey | 'all'>('all');
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<CategoryKey>('top');
  const [uploadName, setUploadName] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    try {
      const res = await fastifyClient.get<ApiResponse<ClothingItem[]>>('/clothing/items');
      if (res.success) setItems(res.data);
    } catch {
      // not logged in or error — leave empty
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setError('');
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('请先选择图片'); return; }
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('category', uploadCategory);
      if (uploadName.trim()) form.append('name', uploadName.trim());

      const res = await fastifyClient.upload<ApiResponse<ClothingItem>>('/clothing/upload', form);
      if (res.success) {
        setItems(prev => [res.data, ...prev]);
        setPreviewUrl(null);
        setUploadName('');
        if (fileRef.current) fileRef.current.value = '';
      } else {
        setError(res.error || '上传失败');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('确认删除这件商品？')) return;
    try {
      await fastifyClient.delete(`/clothing/items/${id}`);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch {
      alert('删除失败');
    }
  }

  const displayed = activeTab === 'all' ? items : items.filter(i => i.category === activeTab);
  const categoryLabel = (key: CategoryKey) => CATEGORIES.find(c => c.key === key)?.label ?? key;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur dark:bg-stone-900/80">
        <div className="mx-auto flex h-14 max-w-screen-xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← 返回</Link>
          <span className="text-lg font-light">👗 服装店管理</span>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6">
        {/* Upload Panel */}
        <div className="mb-8 rounded-2xl border bg-white/80 p-5 shadow-sm backdrop-blur dark:bg-stone-900/70">
          <h2 className="mb-4 text-base font-medium">上传商品图片</h2>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            {/* Category */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">分类</label>
              <div className="flex gap-2">
                {CATEGORIES.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setUploadCategory(c.key)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      uploadCategory === c.key
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div className="flex flex-col gap-1 sm:w-48">
              <label className="text-xs text-muted-foreground">商品名称（可选）</label>
              <input
                value={uploadName}
                onChange={e => setUploadName(e.target.value)}
                placeholder="例：夏季碎花连衣裙"
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
              />
            </div>

            {/* File */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">选择图片</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileChange}
                className="text-sm"
              />
            </div>

            {/* Upload btn */}
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? '上传中…' : '上传'}
            </button>
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="mt-4">
              <img src={previewUrl} alt="预览" className="h-32 w-auto rounded-lg border object-cover" />
            </div>
          )}
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>

        {/* Category tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              activeTab === 'all'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:border-primary/50'
            }`}
          >
            全部 ({items.length})
          </button>
          {CATEGORIES.map(c => {
            const count = items.filter(i => i.category === c.key).length;
            return (
              <button
                key={c.key}
                onClick={() => setActiveTab(c.key)}
                className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  activeTab === c.key
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {c.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Items grid */}
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <span className="text-5xl">👗</span>
            <p className="mt-4 text-sm">暂无商品，上传第一张图片吧</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {displayed.map(item => (
              <div key={item.id} className="group relative overflow-hidden rounded-xl border bg-white/80 shadow-sm backdrop-blur dark:bg-stone-900/70">
                <div className="aspect-square w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
                  <img
                    src={item.image_url}
                    alt={item.name || categoryLabel(item.category)}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                </div>
                <div className="p-2">
                  <span className="inline-block rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                    {categoryLabel(item.category)}
                  </span>
                  {item.name && (
                    <p className="mt-1 truncate text-xs text-foreground">{item.name}</p>
                  )}
                </div>
                {/* Delete btn */}
                <button
                  onClick={() => handleDelete(item.id)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500"
                  title="删除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
