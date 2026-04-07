'use client';

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemeColorPicker } from "@/components/theme-color-picker";

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 sm:h-16">
          <h1 className="truncate text-base font-light sm:text-3xl">统一会员登录管理系统</h1>
          <nav className="flex items-center gap-2 sm:gap-4">
            {isAuthenticated ? (
              <>
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  {user?.name}
                </span>
                <Button onClick={logout} variant="outline" size="sm">
                  退出
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="outline" size="sm">登录</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">注册</Button>
                </Link>
              </>
            )}
            <ThemeColorPicker />
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-primary/5 to-background py-10 text-center sm:py-16">
          <div className="container mx-auto px-4">
            <h2 className="mb-2 text-3xl font-bold tracking-tight sm:mb-3 sm:text-5xl">会员功能区</h2>
            <p className="text-base text-muted-foreground sm:text-lg">
              {isAuthenticated
                ? `欢迎回来，${user?.name}！`
                : "登录后解锁全部专属功能"}
            </p>
            {!isAuthenticated && (
              <div className="mt-5 flex justify-center gap-3 sm:mt-6 sm:gap-4">
                <Link href="/login">
                  <Button size="lg" variant="outline">登录</Button>
                </Link>
                <Link href="/register">
                  <Button size="lg">立即注册</Button>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* All Feature Buttons */}
        <section className="container mx-auto px-4 py-6 sm:py-8">
          <div className="mx-auto max-w-5xl space-y-6">
            <div>
              <h3 className="mb-3 text-base font-semibold text-foreground">免费工具</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <Link href="/scenic">
                  <Button variant="outline" className="h-14 w-full text-base font-normal tracking-wide shadow-sm sm:h-16 sm:text-xl">
                    景区查询
                  </Button>
                </Link>
              </div>
            </div>
            {isAuthenticated && (
              <div>
                <h3 className="mb-3 text-base font-semibold text-foreground">会员功能</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {[
                    { href: '/baccarat/index.html', label: '概率计算器' },
                    { href: '/iching',              label: '易经占卜' },
                    { href: '/interview',           label: '面试翻译助手' },
                    { href: '/image',               label: 'AI 作图' },
                  ].map(({ href, label }) => (
                    <Link key={href} href={href}>
                      <Button variant="outline" className="h-14 w-full text-base font-normal tracking-wide shadow-sm sm:h-16 sm:text-xl">
                        {label}
                      </Button>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
