'use client';

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemeColorPicker } from "@/components/theme-color-picker";

const MEMBER_TOOLS = [
  { href: '/image',               icon: '🎨', label: 'Gemini 作图工具',       desc: 'Nano Banana 2 最新版，多轮对话连续生图' },
  { href: '/video',               icon: '🎬', label: 'Seedance 2.0 视频制作', desc: '火山引擎 Ark，文生视频 / 图生视频' },
  { href: '/interview',           icon: '🎙', label: '面试翻译助手',           desc: '实时语音转写，多语言对译' },
  { href: '/clothing',            icon: '👗', label: '服装店管理',             desc: '按分类上传和管理服装商品图片' },
  // { href: '/baccarat/index.html', icon: '🃏', label: '百家乐概率计算器',       desc: '幸运6幸运7期望值、牌靴算牌分析' },
];

function ToolCard({ href, icon, label, desc }: { href: string; icon: string; label: string; desc: string }) {
  return (
    <Link href={href} className="group block">
      <div className="flex h-full flex-col gap-2 rounded-2xl border border-border bg-white/70 p-4 shadow-sm backdrop-blur transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 dark:bg-stone-900/70 sm:gap-3 sm:p-5">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xl sm:h-12 sm:w-12 sm:text-2xl">{icon}</span>
        <div>
          <p className="text-base font-normal leading-snug text-foreground group-hover:text-primary transition-colors sm:text-lg">{label}</p>
          <p className="mt-1 hidden text-sm text-muted-foreground leading-relaxed sm:block">{desc}</p>
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950">

      {/* ── Header ── */}
      <header className="border-b bg-white/80 backdrop-blur dark:bg-stone-900/80 sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4 sm:px-6">
          <span className="text-lg font-light tracking-tight sm:text-2xl">会员专用AI工具平台</span>
          <nav className="flex items-center gap-1.5 sm:gap-2">
            {isAuthenticated ? (
              <>
                <span className="hidden text-sm text-muted-foreground sm:inline">{user?.name}</span>
                <Button onClick={logout} variant="outline" size="sm">退出</Button>
              </>
            ) : (
              <>
                <Link href="/login"><Button variant="outline" size="sm">登录</Button></Link>
                <Link href="/register"><Button size="sm">注册</Button></Link>
              </>
            )}
            <ThemeColorPicker />
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden py-8 sm:py-16">
          {/* decorative blobs */}
          <div className="pointer-events-none absolute -top-32 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
          <div className="pointer-events-none absolute top-10 right-0 h-64 w-64 rounded-full bg-blue-300/20 blur-2xl dark:bg-blue-600/10" />

          <div className="relative mx-auto max-w-screen-xl px-4 sm:px-6">

            {/* Hero */}
            <div className="mb-8 text-center sm:mb-12">
              <h1 className="mb-3 text-4xl font-light tracking-tight text-primary sm:mb-5 sm:text-7xl">
                会员功能区
              </h1>
              <p className="mx-auto max-w-xl text-base text-muted-foreground sm:text-2xl">
                {isAuthenticated
                  ? `欢迎回来，${user?.name}！探索你的专属 AI 工具`
                  : '登录后解锁全部专属 AI 能力'}
              </p>
              {!isAuthenticated && (
                <div className="mt-6 flex justify-center gap-3 sm:mt-8">
                  <Link href="/register"><Button size="lg" className="px-6 sm:px-8">立即注册</Button></Link>
                  <Link href="/login"><Button size="lg" variant="outline" className="px-6 sm:px-8">登录</Button></Link>
                </div>
              )}
            </div>

            {/* Tools */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {MEMBER_TOOLS.map(t => <ToolCard key={t.href} {...t} />)}
            </div>

          </div>
        </section>
      </main>
    </div>
  );
}
