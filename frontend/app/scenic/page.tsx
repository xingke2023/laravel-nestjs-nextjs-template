'use client';

import { useState } from 'react';
import { fastifyClient } from '@/lib/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Spot {
  uid: string;
  name: string;
  address: string | null;
  telephone: string | null;
  location: { lat: number; lng: number } | null;
  overall_rating: string | null;
  tag: string | null;
  description: string | null;
}

interface SpotsResult {
  success: boolean;
  region: string;
  total: number;
  data: Spot[];
}

interface SubSpotsResult {
  success: boolean;
  name: string;
  region: string;
  radius: number;
  main: Spot;
  total: number;
  subSpots: Spot[];
}

type Mode = 'region' | 'sub';

function SpotCard({ spot, index }: { spot: Spot; index: number }) {
  return (
    <div className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {index}
          </span>
          <h3 className="font-semibold leading-tight">{spot.name}</h3>
        </div>
        {spot.overall_rating && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            ★ {spot.overall_rating}
          </span>
        )}
      </div>

      <div className="space-y-1 text-sm text-muted-foreground">
        {spot.address && (
          <div className="flex gap-1.5">
            <span className="shrink-0">📍</span>
            <span>{spot.address}</span>
          </div>
        )}
        {spot.telephone && (
          <div className="flex gap-1.5">
            <span className="shrink-0">📞</span>
            <span>{spot.telephone}</span>
          </div>
        )}
        {spot.tag && (
          <div className="flex gap-1.5">
            <span className="shrink-0">🏷️</span>
            <span>{spot.tag}</span>
          </div>
        )}
        {spot.description && (
          <div className="flex gap-1.5">
            <span className="shrink-0">📝</span>
            <span className="line-clamp-2">{spot.description}</span>
          </div>
        )}
        {spot.location && (
          <div className="flex gap-1.5 text-xs opacity-60">
            <span className="shrink-0">🗺️</span>
            <span>{spot.location.lat.toFixed(5)}, {spot.location.lng.toFixed(5)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScenicPage() {
  const [mode, setMode] = useState<Mode>('region');

  // region mode
  const [region, setRegion] = useState('');
  // sub-spots mode
  const [spotName, setSpotName] = useState('');
  const [subRegion, setSubRegion] = useState('');
  const [radius, setRadius] = useState('5000');
  const [keywords, setKeywords] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [regionResult, setRegionResult] = useState<SpotsResult | null>(null);
  const [subResult, setSubResult] = useState<SubSpotsResult | null>(null);

  async function handleRegionSearch(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setRegionResult(null);
    setSubResult(null);
    setLoading(true);
    try {
      const res = await fastifyClient.get<SpotsResult>(
        `/scenic/spots?region=${encodeURIComponent(region)}`
      );
      setRegionResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : '查询失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubSearch(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubResult(null);
    setRegionResult(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        name: spotName,
        region: subRegion,
        radius,
        ...(keywords ? { keywords } : {}),
      });
      const res = await fastifyClient.get<SubSpotsResult>(`/scenic/sub-spots?${params}`);
      setSubResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : '查询失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-50 dark:from-stone-900 dark:to-stone-800">
      <div className="container mx-auto max-w-4xl px-4 py-10">

        {/* 标题 */}
        <div className="mb-8 text-center">
          <div className="mb-2 text-6xl">🏔️</div>
          <h1 className="mb-2 text-3xl font-bold tracking-wide">景区查询</h1>
          <p className="text-muted-foreground">基于百度地图 API，搜集地区景区清单或探索景区周边子景点</p>
        </div>

        {/* 模式切换 */}
        <div className="mb-6 flex rounded-lg border bg-card p-1">
          <button
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === 'region'
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => { setMode('region'); setError(''); setRegionResult(null); setSubResult(null); }}
          >
            🗺️ 地区景区清单
          </button>
          <button
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === 'sub'
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => { setMode('sub'); setError(''); setRegionResult(null); setSubResult(null); }}
          >
            🔍 景区周边子景点
          </button>
        </div>

        {/* 地区搜索表单 */}
        {mode === 'region' && (
          <Card className="mb-6 border-green-200 dark:border-stone-600">
            <CardHeader>
              <CardTitle>搜索地区景区</CardTitle>
              <CardDescription>输入城市或地区名称，自动搜集所有旅游景点</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegionSearch} className="flex gap-3">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="region">地区名称</Label>
                  <Input
                    id="region"
                    placeholder="如：成都、包头市、西藏"
                    value={region}
                    onChange={e => setRegion(e.target.value)}
                    required
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={loading}>
                    {loading ? '搜集中…' : '开始搜索'}
                  </Button>
                </div>
              </form>
              {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>
        )}

        {/* 子景点搜索表单 */}
        {mode === 'sub' && (
          <Card className="mb-6 border-green-200 dark:border-stone-600">
            <CardHeader>
              <CardTitle>搜索景区周边子景点</CardTitle>
              <CardDescription>输入主景区名称，在其坐标周边搜索子景点</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubSearch} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="spotName">景区名称</Label>
                    <Input
                      id="spotName"
                      placeholder="如：五当召风景区"
                      value={spotName}
                      onChange={e => setSpotName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="subRegion">所在地区</Label>
                    <Input
                      id="subRegion"
                      placeholder="如：包头市"
                      value={subRegion}
                      onChange={e => setSubRegion(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="radius">搜索半径（米）</Label>
                    <Input
                      id="radius"
                      type="number"
                      min={100}
                      max={50000}
                      placeholder="默认 5000"
                      value={radius}
                      onChange={e => setRadius(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="keywords">关键词（逗号分隔，可选）</Label>
                    <Input
                      id="keywords"
                      placeholder="默认：景点,寺庙,佛殿,参观,景区"
                      value={keywords}
                      onChange={e => setKeywords(e.target.value)}
                    />
                  </div>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? '搜索中…' : '查找子景点'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* 地区搜索结果 */}
        {regionResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                「{regionResult.region}」共找到 {regionResult.total} 个景区
              </h2>
              <span className="text-sm text-muted-foreground">数据来源：百度地图</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {regionResult.data.map((spot, i) => (
                <SpotCard key={spot.uid} spot={spot} index={i + 1} />
              ))}
            </div>
          </div>
        )}

        {/* 子景点搜索结果 */}
        {subResult && (
          <div className="space-y-4">
            {/* 主景区 */}
            <Card className="border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-emerald-700 dark:text-emerald-400">主景区</CardTitle>
              </CardHeader>
              <CardContent>
                <SpotCard spot={subResult.main} index={0} />
              </CardContent>
            </Card>

            {/* 子景点列表 */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                周边 {subResult.radius}m 内共找到 {subResult.total} 个子景点
              </h2>
              <span className="text-sm text-muted-foreground">数据来源：百度地图</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {subResult.subSpots.map((spot, i) => (
                <SpotCard key={spot.uid} spot={spot} index={i + 1} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
