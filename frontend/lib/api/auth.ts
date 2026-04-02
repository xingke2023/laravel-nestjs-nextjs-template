import { laravelClient } from './client';
import type { AuthResponse, LoginCredentials, RegisterCredentials, User } from './types';

export const authApi = {
  login: (data: LoginCredentials) =>
    laravelClient.post<AuthResponse>('/auth/login', data),

  register: (data: RegisterCredentials) =>
    laravelClient.post<AuthResponse>('/auth/register', data),

  refresh: (data: { refreshToken: string }) =>
    laravelClient.post<AuthResponse>('/token/refresh', data),

  logout: (refreshToken: string) =>
    laravelClient.post<{ message: string }>('/token/logout', { refreshToken }),

  me: () =>
    laravelClient.get<{ user: User }>('/me'),
};
