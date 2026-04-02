import { NextRequest, NextResponse } from 'next/server';

const authRoutes = ['/login', '/register'];
const publicRoutes = ['/oauth/callback'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开路由直接放行
  if (publicRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // 从 cookie 中读取 token（SSR 场景，localStorage 不可用）
  // 实际 token 在 localStorage，这里仅做简单判断；客户端页面自行处理跳转
  const isAuthRoute = authRoutes.includes(pathname);

  // 无需服务端拦截，客户端 auth-context 已处理未登录跳转
  // 仅在此处确保 auth 路由不被缓存
  if (isAuthRoute) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
