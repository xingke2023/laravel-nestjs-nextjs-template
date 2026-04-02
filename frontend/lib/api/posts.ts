import { nestjsClient } from './client';
import type { Post, PaginatedResponse, PostFormData } from './types';

export const postsApi = {
  getAll: (page = 1) =>
    nestjsClient.get<PaginatedResponse<Post>>(`/posts?page=${page}`),

  getOne: (id: number) =>
    nestjsClient.get<Post>(`/posts/${id}`),

  create: (data: PostFormData) =>
    nestjsClient.post<{ message: string; post: Post }>('/posts', data),

  update: (id: number, data: Partial<PostFormData>) =>
    nestjsClient.put<{ message: string; post: Post }>(`/posts/${id}`, data),

  delete: (id: number) =>
    nestjsClient.delete<{ message: string }>(`/posts/${id}`),
};
