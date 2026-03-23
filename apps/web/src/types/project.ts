export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  type: "template" | "blank" | "raw";
  template: string | null;
  languages: string[];
  containerStatus: "pending" | "starting" | "ready" | "stopped" | "error" | "timeout";
  folderName: string;
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}
