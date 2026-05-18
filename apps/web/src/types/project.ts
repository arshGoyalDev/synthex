export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  type: "template" | "blank" | "raw";
  template: string | null;
  languages: string[];
  containerStatus:
    | "pending"
    | "starting"
    | "stopping"
    | "ready"
    | "stopped"
    | "error"
    | "timeout";
  folderName: string;
  isPinned?: boolean;
  runCommand?: string | null;
  previewCommand?: string | null;
  previewPort?: number | null;
  createdAt: string;
  updatedAt: string;
}
