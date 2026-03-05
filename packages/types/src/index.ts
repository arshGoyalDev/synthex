// packages/types/src/index.ts
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  language: string;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}