import { HttpError } from "../lib/errors.mjs";
import { isUuid } from "../lib/security.mjs";
import { validateDiagram } from "../domain/validate-diagram.mjs";

const ROLES = new Set(["viewer", "editor"]);
const documentTotals = (document) => ({
  nodeCount: Array.isArray(document.processes) ? document.processes.reduce((total, process) => total + process.nodes.length, 0) : document.nodes?.length ?? 0,
  edgeCount: Array.isArray(document.processes) ? document.processes.reduce((total, process) => total + process.edges.length, 0) : document.edges?.length ?? 0,
});

export class ProjectService {
  constructor(store, config) { this.store = store; this.config = { defaultRevisionRetention: 50, ...config }; }

  #ids(userId, projectId) {
    if (!isUuid(userId) || !isUuid(projectId)) throw new HttpError(400, "Project id must be a UUID", "invalid_project_id");
  }
  #path(ownerId, projectId) { this.#ids(ownerId, projectId); return ["projects", ownerId, `${projectId}.json`]; }
  #indexPath(userId) { if (!isUuid(userId)) throw new HttpError(400, "User id must be a UUID", "invalid_user_id"); return ["projects", userId, "_index.json"]; }
  #membershipPath(userId) { if (!isUuid(userId)) throw new HttpError(400, "User id must be a UUID", "invalid_user_id"); return ["memberships", `${userId}.json`]; }
  #revisionPath(ownerId, projectId, revision) { this.#ids(ownerId, projectId); return ["revisions", ownerId, projectId, `${revision}.json`]; }

  #summary(project, role = "owner") {
    const totals = documentTotals(project.document);
    return { id: project.id, revision: project.revision, createdAt: project.createdAt, updatedAt: project.updatedAt, title: project.document.metadata.title,
      ...totals, accessRole: role, ownerId: project.ownerId };
  }
  #decorated(project, role) { return { ...project, accessRole: role, isOwner: role === "owner" }; }

  async #access(userId, projectId) {
    this.#ids(userId, projectId);
    const owned = await this.store.read(this.#path(userId, projectId));
    if (owned) return { project: owned, ownerId: userId, role: "owner" };
    const memberships = await this.store.read(this.#membershipPath(userId), { projects: {} });
    const membership = memberships.projects?.[projectId];
    if (!membership || !isUuid(membership.ownerId) || !ROLES.has(membership.role)) return null;
    const project = await this.store.read(this.#path(membership.ownerId, projectId));
    if (!project || !project.members?.some((member) => member.userId === userId && member.role === membership.role)) return null;
    return { project, ownerId: membership.ownerId, role: membership.role };
  }

  async list(userId) {
    const ownIndex = await this.store.read(this.#indexPath(userId), { projects: {} });
    const memberships = await this.store.read(this.#membershipPath(userId), { projects: {} });
    const shared = await Promise.all(Object.entries(memberships.projects ?? {}).map(async ([projectId, membership]) => {
      if (!isUuid(projectId) || !isUuid(membership.ownerId)) return null;
      const project = await this.store.read(this.#path(membership.ownerId, projectId));
      return project ? this.#summary(project, membership.role) : null;
    }));
    return [...Object.values(ownIndex.projects ?? {}).map((item) => ({ ...item, accessRole: "owner", ownerId: userId })), ...shared.filter(Boolean)]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(userId, projectId) {
    const access = await this.#access(userId, projectId);
    return access ? this.#decorated(access.project, access.role) : null;
  }

  async put(userId, projectId, documentValue, expectedRevision) {
    const document = validateDiagram(documentValue, this.config.maxDocumentBytes);
    const initialAccess = await this.#access(userId, projectId);
    const ownerId = initialAccess?.ownerId ?? userId;
    return this.store.locked(`projects:${ownerId}`, async () => {
      const access = await this.#access(userId, projectId);
      if (access?.role === "viewer") throw new HttpError(403, "Viewers cannot edit this project", "viewer_read_only");
      const path = this.#path(ownerId, projectId);
      const current = await this.store.read(path);
      const index = await this.store.read(this.#indexPath(ownerId), { projects: {} });
      if (!current) {
        if (userId !== ownerId) throw new HttpError(404, "Project not found", "not_found");
        if (Object.keys(index.projects ?? {}).length >= this.config.maxProjectsPerUser) throw new HttpError(409, "Project quota reached", "project_quota");
        if (expectedRevision !== 0) throw new HttpError(409, "Project was changed or removed", "revision_conflict", { current: null });
      } else if (!access) throw new HttpError(403, "Project access denied", "forbidden");
      else if (expectedRevision !== current.revision) throw new HttpError(409, "Project has a newer server revision", "revision_conflict", { current: this.#decorated(current, access.role) });

      const now = new Date().toISOString();
      const record = { id: projectId, ownerId, revision: (current?.revision ?? 0) + 1, createdAt: current?.createdAt ?? now, updatedAt: now,
        members: current?.members ?? [], retentionLimit: current?.retentionLimit ?? this.config.defaultRevisionRetention, document };
      await this.store.write(path, record);
      await this.store.write(this.#revisionPath(ownerId, projectId, record.revision), { revision: record.revision, createdAt: now, actorId: userId, document });
      index.projects ??= {}; index.projects[projectId] = this.#summary(record);
      await this.store.write(this.#indexPath(ownerId), index);
      await this.#prune(ownerId, projectId, record.retentionLimit);
      return this.#decorated(record, access?.role ?? "owner");
    });
  }

  async delete(userId, projectId, expectedRevision) {
    const access = await this.#access(userId, projectId);
    if (!access) return;
    if (access.role !== "owner") throw new HttpError(403, "Only the owner can delete this project", "owner_required");
    return this.store.locked(`projects:${userId}`, async () => {
      const current = await this.store.read(this.#path(userId, projectId));
      if (!current) return;
      if (expectedRevision !== current.revision) throw new HttpError(409, "Project has a newer server revision", "revision_conflict", { current: this.#decorated(current, "owner") });
      for (const member of current.members ?? []) await this.#removeMembership(member.userId, projectId);
      await this.store.remove(this.#path(userId, projectId));
      for (const file of await this.store.list(["revisions", userId, projectId])) await this.store.remove(["revisions", userId, projectId, file]);
      const index = await this.store.read(this.#indexPath(userId), { projects: {} });
      delete index.projects?.[projectId]; await this.store.write(this.#indexPath(userId), index);
    });
  }

  async members(userId, projectId) {
    const access = await this.#access(userId, projectId);
    if (!access) throw new HttpError(404, "Project not found", "not_found");
    return { ownerId: access.ownerId, members: access.project.members ?? [], accessRole: access.role };
  }

  async addMember(userId, projectId, targetUserId, role) {
    if (!isUuid(targetUserId) || !ROLES.has(role)) throw new HttpError(400, "Choose a valid member and role", "invalid_member");
    const access = await this.#access(userId, projectId);
    if (!access) throw new HttpError(404, "Project not found", "not_found");
    if (access.role !== "owner") throw new HttpError(403, "Only the owner can manage members", "owner_required");
    if (targetUserId === userId) throw new HttpError(400, "The owner already has full access", "invalid_member");
    return this.store.locked(`projects:${userId}`, async () => {
      const project = await this.store.read(this.#path(userId, projectId));
      const members = (project.members ?? []).filter((member) => member.userId !== targetUserId);
      members.push({ userId: targetUserId, role, addedAt: new Date().toISOString() });
      const updated = { ...project, members };
      await this.store.write(this.#path(userId, projectId), updated);
      await this.#setMembership(targetUserId, projectId, { ownerId: userId, role });
      return members;
    });
  }

  async removeMember(userId, projectId, targetUserId) {
    if (!isUuid(targetUserId)) throw new HttpError(400, "Invalid member id", "invalid_member");
    const access = await this.#access(userId, projectId);
    if (!access) throw new HttpError(404, "Project not found", "not_found");
    if (access.role !== "owner") throw new HttpError(403, "Only the owner can manage members", "owner_required");
    return this.store.locked(`projects:${userId}`, async () => {
      const project = await this.store.read(this.#path(userId, projectId));
      await this.store.write(this.#path(userId, projectId), { ...project, members: (project.members ?? []).filter((member) => member.userId !== targetUserId) });
      await this.#removeMembership(targetUserId, projectId);
    });
  }

  async revisions(userId, projectId) {
    const access = await this.#access(userId, projectId);
    if (!access) throw new HttpError(404, "Project not found", "not_found");
    const files = await this.store.list(["revisions", access.ownerId, projectId]);
    const revisions = await Promise.all(files.map((file) => this.store.read(["revisions", access.ownerId, projectId, file])));
    return revisions.filter(Boolean).map(({ document, ...revision }) => ({ ...revision, title: document.metadata.title, ...documentTotals(document) })).sort((a, b) => b.revision - a.revision);
  }

  async restore(userId, projectId, revision, expectedRevision) {
    const access = await this.#access(userId, projectId);
    if (!access) throw new HttpError(404, "Project not found", "not_found");
    if (access.role === "viewer") throw new HttpError(403, "Viewers cannot restore revisions", "viewer_read_only");
    const snapshot = await this.store.read(this.#revisionPath(access.ownerId, projectId, revision));
    if (!snapshot) throw new HttpError(404, "Revision not found", "not_found");
    return this.put(userId, projectId, snapshot.document, expectedRevision);
  }

  async setRetention(userId, projectId, retentionLimit) {
    if (!Number.isInteger(retentionLimit) || retentionLimit < 5 || retentionLimit > 200) throw new HttpError(400, "Retention must be between 5 and 200 revisions", "invalid_retention");
    const access = await this.#access(userId, projectId);
    if (!access) throw new HttpError(404, "Project not found", "not_found");
    if (access.role !== "owner") throw new HttpError(403, "Only the owner can change retention", "owner_required");
    return this.store.locked(`projects:${userId}`, async () => {
      const project = await this.store.read(this.#path(userId, projectId));
      const updated = { ...project, retentionLimit };
      await this.store.write(this.#path(userId, projectId), updated);
      await this.#prune(userId, projectId, retentionLimit);
      return this.#decorated(updated, "owner");
    });
  }

  async #removeMembership(userId, projectId) {
    await this.store.locked(`memberships:${userId}`, async () => {
      const index = await this.store.read(this.#membershipPath(userId), { projects: {} });
      delete index.projects?.[projectId]; await this.store.write(this.#membershipPath(userId), index);
    });
  }
  async #setMembership(userId, projectId, membership) {
    await this.store.locked(`memberships:${userId}`, async () => {
      const index = await this.store.read(this.#membershipPath(userId), { projects: {} });
      index.projects ??= {}; index.projects[projectId] = membership;
      await this.store.write(this.#membershipPath(userId), index);
    });
  }
  async #prune(ownerId, projectId, limit) {
    const files = (await this.store.list(["revisions", ownerId, projectId])).map((file) => ({ file, revision: Number(file.replace(/\.json$/, "")) }))
      .filter((entry) => Number.isInteger(entry.revision)).sort((a, b) => b.revision - a.revision);
    for (const entry of files.slice(limit)) await this.store.remove(["revisions", ownerId, projectId, entry.file]);
  }
}
