export interface Project {
  id: string;
  userId: string;
  name: string;
  language: string;
  description: string | null;
  template: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}
