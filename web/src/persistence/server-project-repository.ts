import { importDiagram } from "../domain/diagram";
import { projectRepository, type ProjectRecord, type ProjectRepository, type ProjectSummary } from "./project-repository";

interface ApiErrorBody { error?: { code?: string; message?: string; details?: { current?: ServerProject | null } } }
interface ServerProject {
  id: string; revision: number; createdAt: string; updatedAt: string;
  document: unknown;
  accessRole?: "owner" | "editor" | "viewer";
  retentionLimit?: number;
}

export class ProjectConflictError extends Error {
  constructor(public current: ProjectRecord | null) { super("A newer version of this project is stored on the server"); }
}
export class SyncUnavailableError extends Error { constructor() { super("The server is unavailable; changes remain saved locally"); } }

async function json(response: Response) {
  const value = await response.json();
  if (!response.ok) {
    const body = value as ApiErrorBody;
    throw Object.assign(new Error(body.error?.message ?? "Server request failed"), { status: response.status, code: body.error?.code, details: body.error?.details });
  }
  return value;
}

function record(project: ServerProject): ProjectRecord {
  const document = importDiagram(project.document);
  return { id: project.id, title: document.metadata.title, document, createdAt: project.createdAt, updatedAt: project.updatedAt, serverRevision: project.revision, accessRole: project.accessRole, retentionLimit: project.retentionLimit };
}

export function createServerProjectRepository(getCsrf: () => string | null, local: ProjectRepository = projectRepository): ProjectRepository {
  const revisions = new Map<string, number>();
  return {
    async list() {
      try {
        const value = await json(await fetch("/api/projects", { credentials: "same-origin" })) as { projects: Array<ProjectSummary & { revision: number }> };
        value.projects.forEach((project) => revisions.set(project.id, project.revision));
        const serverIds = new Set(value.projects.map((project) => project.id));
        const cached = await local.list();
        const pending: ProjectSummary[] = [];
        for (const summary of cached) {
          if (serverIds.has(summary.id)) continue;
          const cachedRecord = await local.get(summary.id);
          if (cachedRecord?.serverRevision === undefined) pending.push(summary);
          else await local.delete(summary.id);
        }
        return [...value.projects, ...pending].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      } catch (error) {
        if ((error as { status?: number }).status === 401) throw error;
        return local.list();
      }
    },
    async get(id) {
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, { credentials: "same-origin" });
        if (response.status === 404) {
          const cached = await local.get(id);
          if (cached?.serverRevision === undefined) return cached;
          if (cached) await local.delete(id);
          return null;
        }
        const value = await json(response) as { project: ServerProject };
        const result = record(value.project); revisions.set(id, value.project.revision); await local.put(result); return result;
      } catch (error) {
        if ((error as { status?: number }).status === 401) throw error;
        return local.get(id);
      }
    },
    async put(project) {
      await local.put(project);
      const expectedRevision = project.serverRevision ?? revisions.get(project.id) ?? 0;
      try {
        const value = await json(await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
          method: "PUT", credentials: "same-origin",
          headers: { "content-type": "application/json", "x-csrf-token": getCsrf() ?? "" },
          body: JSON.stringify({ document: project.document, expectedRevision }),
        })) as { project: ServerProject };
        const result = record(value.project); revisions.set(project.id, result.serverRevision!); await local.put(result); return result;
      } catch (error) {
        const apiError = error as Error & { status?: number; code?: string; details?: { current?: ServerProject | null } };
        if (apiError.status === 409 && apiError.code === "revision_conflict") {
          const current = apiError.details?.current ? record(apiError.details.current) : null;
          if (current) revisions.set(project.id, current.serverRevision!);
          throw new ProjectConflictError(current);
        }
        if (!apiError.status) throw new SyncUnavailableError();
        throw error;
      }
    },
    async delete(id) {
      let revision = revisions.get(id);
      if (revision === undefined) revision = (await this.get(id))?.serverRevision;
      if (revision !== undefined) await json(await fetch(`/api/projects/${encodeURIComponent(id)}?revision=${revision}`, { method: "DELETE", credentials: "same-origin", headers: { "x-csrf-token": getCsrf() ?? "" } }));
      revisions.delete(id); await local.delete(id);
    },
  };
}
