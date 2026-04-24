'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemeColorPicker } from '@/components/theme-color-picker';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function isWechatBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [login_field, setLoginField] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 微信内置浏览器自动跳转公众号网页授权
  useEffect(() => {
    if (isWechatBrowser()) {
      const redirectUri = encodeURIComponent(
        `${window.location.origin}/oauth/callback`
      );
      window.location.href =
        'https://mo.xingke888.com/api/oauth/wechat-mp?redirect_uri=' + redirectUri;
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ login: login_field, password });
      const redirect = searchParams.get('redirect');
      router.push(redirect || '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  function loginWithWechat() {
    sessionStorage.setItem(
      'returnTo',
      window.location.pathname === '/login' ? '/' : window.location.pathname
    );
    const redirectUri = encodeURIComponent(
      `${window.location.origin}/oauth/callback`
    );
    // 微信内置浏览器用公众号授权，否则用开放平台扫码
    const endpoint = isWechatBrowser() ? 'wechat-mp' : 'wechat';
    window.location.href =
      `https://mo.xingke888.com/api/oauth/${endpoint}?redirect_uri=` + redirectUri;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <ThemeColorPicker />
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>登录</CardTitle>
          <CardDescription>输入账号和密码登录</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="identifier">用户名或邮箱</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="用户名或邮箱"
                value={login_field}
                onChange={(e) => setLoginField(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={loginWithWechat}
            >
              微信登录
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              没有账号？{' '}
              <Link href="/register" className="underline">
                注册
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
