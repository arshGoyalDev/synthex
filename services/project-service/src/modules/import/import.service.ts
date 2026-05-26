import { db, pubsub, redis } from "../../config/database";
import { env } from "../../config";
import { AppError } from "../../utils/AppError";
import { safeName } from "../../utils/project";
import { detectAll } from "@synthex/templates";

const GITHUB_API = "https://api.github.com";

const parseGithubUrl = (url: string): { owner: string; repo: string } => {
  const match = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/,
  );
  if (!match || !match[1] || !match[2]) {
    throw new AppError("Invalid GitHub URL. Expected: https://github.com/owner/repo", 400);
  }
  return { owner: match[1], repo: match[2] };
}

const githubFetch = async (path: string, token?: string): Promise<any> => {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "synthex-import/1.0",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${GITHUB_API}${path}`, { headers });

  if (!res.ok) {
    if (res.status === 404) throw new AppError("GitHub repository not found or is private", 404);
    if (res.status === 403) throw new AppError("GitHub API rate limit exceeded. Try again later.", 429);
    throw new AppError(`GitHub API error: ${res.statusText}`, res.status);
  }

  return res.json();
}

const fetchFileContent = async (
  owner: string,
  repo: string,
  path: string,
  branch: string,
  token?: string,
): Promise<string | null> => {
  try {
    const data = await githubFetch(
      `/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      token,
    );
    if (data.encoding === "base64" && data.content) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return null;
  } catch {
    return null;
  }
}


class ImportService {
  private async getGithubToken(userId: string): Promise<{ token: string; scope?: string }> {
    const res = await fetch(`${env.USER_SERVICE_URL}/internal/github/token`, {
      headers: {
        "X-User-Id": userId,
        "X-Internal-Token": env.INTERNAL_API_KEY,
        "User-Agent": "synthex-import/1.0",
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new AppError("GitHub account not connected", 404);
      }
      throw new AppError("Failed to fetch GitHub credentials", 500);
    }

    const payload = (await res.json()) as { data?: { accessToken?: string; tokenScope?: string } };
    const token = payload.data?.accessToken;
    if (!token) {
      throw new AppError("GitHub access token not available", 400);
    }

    return { token, scope: payload.data?.tokenScope };
  }

  async detectGithub(repoUrl: string, userId?: string) {
    const { owner, repo } = parseGithubUrl(repoUrl);

    let token: string | undefined;
    if (userId) {
      try {
        const creds = await this.getGithubToken(userId);
        token = creds.token;
      } catch {
        token = undefined;
      }
    }

    // Fetch repo metadata + file tree in parallel
    const [repoMeta, treeData] = await Promise.all([
      githubFetch(`/repos/${owner}/${repo}`, token),
      githubFetch(`/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, token),
    ]);

    const branch: string = repoMeta.default_branch ?? "main";
    const filePaths: string[] = (treeData.tree ?? [])
      .filter((f: any) => f.type === "blob")
      .map((f: any) => f.path as string);

    // Fetch key config files for better detection
    const [packageJsonContent, requirementsContent, cargoContent] =
      await Promise.all([
        fetchFileContent(owner, repo, "package.json", branch, token),
        fetchFileContent(owner, repo, "requirements.txt", branch, token),
        fetchFileContent(owner, repo, "Cargo.toml", branch, token),
      ]);

    const detection = detectAll({
      filePaths,
      packageJsonContent: packageJsonContent ?? undefined,
      requirementsContent: requirementsContent ?? undefined,
      cargoContent: cargoContent ?? undefined,
    });

    return {
      name: repoMeta.name as string,
      description: (repoMeta.description as string | null) ?? undefined,
      repoUrl,
      repoBranch: branch,
      ...detection,
    };
  }

  async importGithub(
    userId: string,
    data: {
      repoUrl: string;
      repoBranch: string;
      name: string;
      description?: string;
      runCommand?: string;
      previewCommand?: string;
      previewPort?: number;
      installCommand?: string;
      isPreview: boolean;
      languages: string[];
      envVars?: Record<string, string>;
    },
  ) {
    const { token, scope } = await this.getGithubToken(userId);
    if (scope && !scope.includes("repo")) {
      throw new AppError("GitHub token missing repo scope", 403);
    }

    const authedRepoUrl = data.repoUrl.replace(
      /^https:\/\//,
      `https://x-access-token:${encodeURIComponent(token)}@`,
    );

    const safeLanguages = data.languages?.filter(Boolean) ?? [];
    if (safeLanguages.length === 0) {
      throw new AppError("Languages required for imported project", 400);
    }
    const project = await db.project.create({
      data: {
        name: data.name,
        folderName: safeName(data.name),
        description: data.description,
        type: "blank",
        languages: safeLanguages,
        userId,
        importSource: "github",
        repoUrl: authedRepoUrl,
        repoBranch: data.repoBranch,
        runCommand: data.runCommand ?? null,
        previewCommand: data.previewCommand ?? null,
        previewPort: data.previewPort ?? null,
        installCommand: data.installCommand ?? null,
        envVars: data.envVars ? (data.envVars as any) : undefined,
      },
    });

    await pubsub.publish("project:created", {
      projectId: project.id,
      projectName: project.folderName,
      userId,
      type: "blank",
      template: null,
      languages: safeLanguages,
      importSource: "github",
      repoUrl: authedRepoUrl,
      repoBranch: data.repoBranch,
      installCommand: data.installCommand ?? null,
      runCommand: data.runCommand ?? null,
      previewCommand: data.previewCommand ?? null,
      previewPort: data.previewPort ?? null,
      envVars: data.envVars ?? null,
    });

    await redis.set(
      `container:timeout:${project.id}`,
      JSON.stringify({ projectId: project.id, userId }),
      "EX",
      10 * 60, // 10 min — clone can take a while
    );

    return this.withRuntimeConfig(project);
  }

  async listGithubRepos(userId: string) {
    const { token, scope } = await this.getGithubToken(userId);
    if (scope && !scope.includes("repo")) {
      throw new AppError("GitHub token missing repo scope", 403);
    }

    const repos: Array<{
      id: number;
      name: string;
      fullName: string;
      private: boolean;
      htmlUrl: string;
      defaultBranch: string;
      description?: string | null;
    }> = [];

    let page = 1;
    const perPage = 100;

    while (true) {
      const data = await githubFetch(
        `/user/repos?per_page=${perPage}&page=${page}&sort=updated`,
        token,
      );

      if (!Array.isArray(data) || data.length === 0) break;

      for (const repo of data) {
        repos.push({
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          private: repo.private,
          htmlUrl: repo.html_url,
          defaultBranch: repo.default_branch,
          description: repo.description,
        });
      }

      if (data.length < perPage) break;
      page += 1;
    }

    return repos;
  }

  async detectZip(filePaths: string[], fileContents: Record<string, string>) {
    const detection = detectAll({
      filePaths,
      packageJsonContent: fileContents["package.json"],
      requirementsContent: fileContents["requirements.txt"],
      cargoContent: fileContents["Cargo.toml"],
    });

    return detection;
  }

  async importZip(
    userId: string,
    data: {
      zipKey: string;
      name: string;
      description?: string;
      runCommand?: string;
      previewCommand?: string;
      previewPort?: number;
      installCommand?: string;
      isPreview: boolean;
      languages: string[];
      envVars?: Record<string, string>;
    },
  ) {
    const safeLanguages = data.languages?.filter(Boolean) ?? [];
    if (safeLanguages.length === 0) {
      throw new AppError("Languages required for imported project", 400);
    }
    const project = await db.project.create({
      data: {
        name: data.name,
        folderName: safeName(data.name),
        description: data.description,
        type: "blank",
        languages: safeLanguages,
        userId,
        importSource: "zip",
        zipKey: data.zipKey,
        runCommand: data.runCommand ?? null,
        previewCommand: data.previewCommand ?? null,
        previewPort: data.previewPort ?? null,
        installCommand: data.installCommand ?? null,
        envVars: data.envVars ? (data.envVars as any) : undefined,
      },
    });

    await pubsub.publish("project:created", {
      projectId: project.id,
      projectName: project.folderName,
      userId,
      type: "blank",
      template: null,
      languages: safeLanguages,
      importSource: "zip",
      zipKey: data.zipKey,
      installCommand: data.installCommand ?? null,
      runCommand: data.runCommand ?? null,
      previewCommand: data.previewCommand ?? null,
      previewPort: data.previewPort ?? null,
      envVars: data.envVars ?? null,
    });

    await redis.set(
      `container:timeout:${project.id}`,
      JSON.stringify({ projectId: project.id, userId }),
      "EX",
      10 * 60,
    );

    return this.withRuntimeConfig(project);
  }

  async updateConfig(
    projectId: string,
    userId: string,
    data: {
      runCommand?: string | null;
      previewCommand?: string | null;
      previewPort?: number | null;
      installCommand?: string | null;
      envVars?: Record<string, string> | null;
    },
  ) {
    const project = await db.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw new AppError("Project not found", 404);

    const updated = await db.project.update({
      where: { id: projectId },
      data: {
        ...(data.runCommand !== undefined && { runCommand: data.runCommand }),
        ...(data.previewCommand !== undefined && { previewCommand: data.previewCommand }),
        ...(data.previewPort !== undefined && { previewPort: data.previewPort }),
        ...(data.installCommand !== undefined && { installCommand: data.installCommand }),
        ...(data.envVars !== undefined && { envVars: data.envVars as any }),
      },
    });

    return this.withRuntimeConfig(updated);
  }


  private withRuntimeConfig(project: any) {
    if (project.importSource) {
      return {
        ...project,
        runCommand: project.runCommand,
        previewCommand: project.previewCommand,
        previewPort: project.previewPort,
      };
    }
    return project;
  }
}

export { ImportService };
