'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { authApi } from '@/lib/api';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const { setTokens } = useAuth();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    try {
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get('accessToken');
      const refreshToken = params.get('refreshToken') ?? '';

      if (!accessToken) {
        router.push('/login?error=oauth_failed');
        return;
      }

      // 先存 token
      setTokens({ accessToken, refreshToken });

      // 清理 URL 中的 token 参数
      window.history.replaceState({}, '', window.location.pathname);

      // 拉取用户信息后跳转
      authApi.me()
        .then((res) => {
          setTokens({ accessToken, refreshToken, user: res.user });
        })
        .catch(() => {
          // 忽略，token 已存储，刷新后 auth-context 会自动补拉
        })
        .finally(() => {
          const returnTo = sessionStorage.getItem('returnTo') || '/';
          sessionStorage.removeItem('returnTo');
          router.push(returnTo);
        });
    } catch (e) {
      console.error('OAuth callback error:', e);
      router.push('/login?error=oauth_failed');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">登录中...</p>
    </div>
  );
}
