const LARAVEL_URL =
  process.env.NEXT_PUBLIC_LARAVEL_API_URL || 'http://localhost:8000/api';
const FASTIFY_URL =
  process.env.NEXT_PUBLIC_FASTIFY_API_URL || 'http://localhost:3200';

type TokenRefreshedCallback = (accessToken: string, refreshToken: string) => void;
type UnauthorizedCallback = () => void;

let onTokenRefreshed: TokenRefreshedCallback = () => {};
let onUnauthorized: UnauthorizedCallback = () => {
  if (typeof window !== 'undefined') window.location.href = '/login';
};

export function configureClient(config: {
  onTokenRefreshed?: TokenRefreshedCallback;
  onUnauthorized?: UnauthorizedCallback;
}) {
  if (config.onTokenRefreshed) onTokenRefreshed = config.onTokenRefreshed;
  if (config.onUnauthorized) onUnauthorized = config.onUnauthorized;
}

// Token refresh always goes through Laravel
async function refreshTokens(): Promise<void> {
  const refreshToken =
    typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
  if (!refreshToken) throw new Error('No refresh token');

  const response = await fetch(`${LARAVEL_URL}/token/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) throw new Error('Refresh failed');

  const data = await response.json();
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  onTokenRefreshed(data.accessToken, data.refreshToken);
}

// Shared refresh promise to avoid concurrent refresh calls
let refreshingPromise: Promise<void> | null = null;

/** Return true if a JWT access token is expired (or will expire in <30s). */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now() + 30_000;
  } catch {
    return false;
  }
}

class ApiClient {
  constructor(private baseURL: string) {}

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retry = true
  ): Promise<T> {
    // Proactively refresh if the token is expired/about-to-expire so that
    // public routes (which never return 401) still get a valid token.
    let token = this.getAccessToken();
    if (token && isTokenExpired(token)) {
      try {
        if (!refreshingPromise) {
          refreshingPromise = refreshTokens().finally(() => { refreshingPromise = null; });
        }
        await refreshingPromise;
      } catch {
        // Refresh failed — proceed with the expired token (server will decide)
      }
      token = this.getAccessToken();
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${this.baseURL}${endpoint}`, { ...options, headers });

    if (response.status === 401 && retry) {
      try {
        if (!refreshingPromise) {
          refreshingPromise = refreshTokens().finally(() => {
            refreshingPromise = null;
          });
        }
        await refreshingPromise;
        return this.request<T>(endpoint, options, false);
      } catch {
        onUnauthorized();
        throw new Error('Unauthorized');
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || error.error || 'An error occurred');
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(data) });
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    const token = this.getAccessToken();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST', headers, body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(err.message || err.error || 'Upload failed');
    }
    return response.json();
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Laravel: auth, business logic
export const laravelClient = new ApiClient(LARAVEL_URL);

// Fastify: high-performance services (iching, etc.)
export const fastifyClient = new ApiClient(FASTIFY_URL);

// Default export kept for backward compatibility
export const apiClient = laravelClient;
