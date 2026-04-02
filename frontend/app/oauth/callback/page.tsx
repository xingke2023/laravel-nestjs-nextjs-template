'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { authApi } from '@/lib/api';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const { setTokens } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (!accessToken) {
      router.push('/login?error=oauth_failed');
      return;
    }

    // 存储 Token
    setTokens({ accessToken, refreshToken: refreshToken ?? '' });

    // 清理 URL 中的 Token
    window.history.replaceState({}, '', window.location.pathname);

    // 获取用户信息
    authApi.me()
      .then((res) => {
        setTokens({ accessToken, refreshToken: refreshToken ?? '', user: res.user });
      })
      .catch(() => {
        // 忽略，Token 已存储，用户信息下次加载
      })
      .finally(() => {
        const returnTo = sessionStorage.getItem('returnTo') || '/';
        sessionStorage.removeItem('returnTo');
        router.push(returnTo);
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">登录中...</p>
    </div>
  );
}
