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
    | "installing"
    | "stopping"
    | "ready"
    | "stopped"
    | "error"
    | "timeout";
  folderName: string;
  isPinned?: boolean;
  installCommand?: string | null;
  runCommand?: string | null;
  previewCommand?: string | null;
  previewPort?: number | null;
  envVars?: Record<string, string> | null;
  autoSaveEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}
