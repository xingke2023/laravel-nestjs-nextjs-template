'use client';

import { useState } from 'react';
import { fastifyClient } from '@/lib/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Trigram {
  name: string;
  symbol: string;
  nature: string;
}

interface HexagramResult {
  number: number;
  symbol: string;
  name: string;
  fullName: string;
  upperTrigram: Trigram;
  lowerTrigram: Trigram;
  grade: string;
  judgment: string;
  interpretation: string;
  movingLine: number;
}

interface Fortune {
  overall: string;
  career: string;
  wealth: string;
  love: string;
  health: string;
}

interface ChangedHexagram {
  number: number;
  symbol: string;
  name: string;
  fullName: string;
  grade: string;
  interpretation: string;
}

interface InputInfo {
  year: number;
  month: number;
  day: number;
  hour: number;
  shichen: string;
  shichenRange: string;
  ganzhi: string;
  shengxiao: string;
}

interface PredictData {
  input: InputInfo;
  hexagram: HexagramResult;
  fortune: Fortune;
  changedHexagram: ChangedHexagram;
}

const GRADE_STYLE: Record<string, string> = {
  '大吉': 'text-red-500 font-bold',
  '吉':   'text-orange-500 font-bold',
  '中吉': 'text-yellow-600 font-bold',
  '中平': 'text-gray-500',
  '小凶': 'text-purple-500',
  '凶':   'text-red-700 font-bold',
  '大凶': 'text-red-900 font-bold',
};

const MOVING_LINE_NAMES = ['初', '二', '三', '四', '五', '上'];

export default function IChingPage() {
  const [form, setForm] = useState({ year: '', month: '', day: '', hour: '0' });
  const [result, setResult] = useState<PredictData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fastifyClient.post<{ success: boolean; data: PredictData }>(
        '/iching/predict',
        {
          year: parseInt(form.year),
          month: parseInt(form.month),
          day: parseInt(form.day),
          hour: parseInt(form.hour),
        }
      );
      setResult(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '推算失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 dark:from-stone-900 dark:to-stone-800">
      <div className="container mx-auto max-w-3xl px-4 py-10">

        {/* 标题 */}
        <div className="mb-8 text-center">
          <div className="mb-2 text-6xl">☯</div>
          <h1 className="mb-2 text-3xl font-bold tracking-wide">九宫八卦 · 易经占卜</h1>
          <p className="text-muted-foreground">输入生辰八字，以梅花易数推算命卦</p>
        </div>

        {/* 输入表单 */}
        <Card className="mb-6 border-amber-200 dark:border-stone-600">
          <CardHeader>
            <CardTitle>生辰信息</CardTitle>
            <CardDescription>请输入出生年月日时（时辰按24小时制）</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor="year">年</Label>
                  <Input
                    id="year" type="number" placeholder="如 1990"
                    min={1900} max={2100} required
                    value={form.year}
                    onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="month">月</Label>
                  <Input
                    id="month" type="number" placeholder="1-12"
                    min={1} max={12} required
                    value={form.month}
                    onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="day">日</Label>
                  <Input
                    id="day" type="number" placeholder="1-31"
                    min={1} max={31} required
                    value={form.day}
                    onChange={e => setForm(f => ({ ...f, day: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hour">时（0-23）</Label>
                  <Input
                    id="hour" type="number" placeholder="0"
                    min={0} max={23}
                    value={form.hour}
                    onChange={e => setForm(f => ({ ...f, hour: e.target.value }))}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '推算中…' : '起卦'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 结果 */}
        {result && (
          <div className="space-y-4">

            {/* 生辰信息 */}
            <Card className="border-amber-200 dark:border-stone-600">
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="rounded-full bg-amber-100 px-3 py-1 dark:bg-stone-700">
                    {result.input.year}年{result.input.month}月{result.input.day}日
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 dark:bg-stone-700">
                    {result.input.shichen}（{result.input.hour}时）
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 dark:bg-stone-700">
                    {result.input.ganzhi}年
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 dark:bg-stone-700">
                    生肖：{result.input.shengxiao}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 本卦 */}
            <Card className="border-amber-200 dark:border-stone-600">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">
                      <span className="mr-3 text-4xl">{result.hexagram.symbol}</span>
                      {result.hexagram.fullName}
                      <span className="ml-2 text-sm text-muted-foreground">第 {result.hexagram.number} 卦</span>
                    </CardTitle>
                    <CardDescription className="mt-1 text-base">
                      卦辞：{result.hexagram.judgment}
                    </CardDescription>
                  </div>
                  <span className={`text-lg ${GRADE_STYLE[result.fortune.overall] ?? ''}`}>
                    {result.fortune.overall}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 上下卦 */}
                <div className="flex gap-6 text-sm">
                  <span>上卦：{result.hexagram.upperTrigram.symbol} {result.hexagram.upperTrigram.name}（{result.hexagram.upperTrigram.nature}）</span>
                  <span>下卦：{result.hexagram.lowerTrigram.symbol} {result.hexagram.lowerTrigram.name}（{result.hexagram.lowerTrigram.nature}）</span>
                  <span>动爻：{MOVING_LINE_NAMES[result.hexagram.movingLine - 1]}爻</span>
                </div>
                {/* 解释 */}
                <p className="rounded-md bg-amber-50 p-3 text-sm leading-relaxed dark:bg-stone-700/50">
                  {result.hexagram.interpretation}
                </p>
              </CardContent>
            </Card>

            {/* 四维运势 */}
            <Card className="border-amber-200 dark:border-stone-600">
              <CardHeader>
                <CardTitle>运势详解</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: '事业', icon: '💼', value: result.fortune.career },
                    { label: '财运', icon: '💰', value: result.fortune.wealth },
                    { label: '感情', icon: '❤️', value: result.fortune.love },
                    { label: '健康', icon: '🌿', value: result.fortune.health },
                  ].map(({ label, icon, value }) => (
                    <div key={label} className="rounded-md border p-3">
                      <div className="mb-1 text-sm font-medium">{icon} {label}</div>
                      <div className="text-sm text-muted-foreground">{value}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 变卦 */}
            <Card className="border-amber-200 dark:border-stone-600">
              <CardHeader>
                <CardTitle className="text-base">
                  变卦：
                  <span className="ml-2 text-2xl">{result.changedHexagram.symbol}</span>
                  <span className="ml-2">{result.changedHexagram.fullName}</span>
                  <span className={`ml-3 text-sm ${GRADE_STYLE[result.changedHexagram.grade] ?? ''}`}>
                    {result.changedHexagram.grade}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{result.changedHexagram.interpretation}</p>
              </CardContent>
            </Card>

          </div>
        )}
      </div>
    </div>
  );
}
