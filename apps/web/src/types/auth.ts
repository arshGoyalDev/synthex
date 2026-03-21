export interface AuthResponse {
  accessToken: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
