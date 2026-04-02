import { Injectable, UnauthorizedException } from '@nestjs/common';

interface AuthCenterResponse {
  data: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: number;
      username: string;
      name: string;
      email?: string;
    };
  };
}

interface RefreshResponse {
  data: {
    accessToken: string;
    refreshToken: string;
  };
}

@Injectable()
export class AuthCenterService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.AUTH_CENTER_URL ?? 'http://localhost:9000';
  }

  async login(identifier: string, password: string): Promise<AuthCenterResponse['data']> {
    return this.post('/auth/login', { identifier, password });
  }

  async register(username: string, password: string): Promise<AuthCenterResponse['data']> {
    return this.post('/auth/register', { username, password, name: username });
  }

  async refreshToken(refreshToken: string): Promise<RefreshResponse['data']> {
    return this.post('/token/refresh', { refreshToken });
  }

  async logout(refreshToken: string): Promise<void> {
    await this.post('/token/logout', { refreshToken }).catch(() => {});
  }

  private async post<T>(path: string, data: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new UnauthorizedException((body as { message?: string }).message ?? '认证中心请求失败');
    }

    return body as T;
  }
}
