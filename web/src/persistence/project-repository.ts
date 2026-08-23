import { importDiagram, parseDiagram, type DiagramDocument } from "../domain/diagram";

const DATABASE_NAME = "activity-studio";
const DATABASE_VERSION = 1;
const STORE_NAME = "projects";
const FALLBACK_KEY = "activity-studio.projects.v1";
const ACCOUNT_PREFIX = "account-";

export interface ProjectRecord {
  id: string;
  title: string;
  document: DiagramDocument;
  createdAt: string;
  updatedAt: string;
  serverRevision?: number;
  accessRole?: "owner" | "editor" | "viewer";
  retentionLimit?: number;
}

export interface ProjectSummary {
  id: string;
  title: string;
  nodeCount: number;
  edgeCount: number;
  updatedAt: string;
  accessRole?: "owner" | "editor" | "viewer";
  ownerId?: string;
}

export interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  get(id: string): Promise<ProjectRecord | null>;
  put(record: ProjectRecord): Promise<ProjectRecord>;
  delete(id: string): Promise<void>;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function validateRecord(value: unknown): ProjectRecord {
  if (!value || typeof value !== "object") throw new Error("Invalid local project record");
  const raw = value as Partial<ProjectRecord>;
  if (typeof raw.id !== "string" || !raw.id) throw new Error("Project id is missing");
  const document = importDiagram(raw.document);
  return {
    id: raw.id,
    title: document.metadata.title,
    document,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : document.metadata.createdAt,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : document.metadata.updatedAt,
    serverRevision: typeof raw.serverRevision === "number" ? raw.serverRevision : undefined,
    accessRole: raw.accessRole === "owner" || raw.accessRole === "editor" || raw.accessRole === "viewer" ? raw.accessRole : undefined,
    retentionLimit: typeof raw.retentionLimit === "number" ? raw.retentionLimit : undefined,
  };
}

function summary(record: ProjectRecord): ProjectSummary {
  return {
    id: record.id,
    title: record.document.metadata.title,
    nodeCount: record.document.processes.reduce((sum, process) => sum + process.nodes.length, 0),
    edgeCount: record.document.processes.reduce((sum, process) => sum + process.edges.length, 0),
    updatedAt: record.updatedAt,
  };
}

export function createLocalStorageRepository(storage: KeyValueStorage): ProjectRepository {
  function readAll(): ProjectRecord[] {
    try {
      const value = JSON.parse(storage.getItem(FALLBACK_KEY) ?? "[]") as unknown;
      if (!Array.isArray(value)) return [];
      return value.map(validateRecord);
    } catch {
      return [];
    }
  }

  function writeAll(records: ProjectRecord[]) {
    storage.setItem(FALLBACK_KEY, JSON.stringify(records.map((record) => ({
      ...record,
      document: parseDiagram(record.document),
    }))));
  }

  return {
    async list() { return readAll().map(summary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async get(id) { return readAll().find((record) => record.id === id) ?? null; },
    async put(record) {
      const valid = validateRecord(record);
      const records = readAll().filter((entry) => entry.id !== valid.id);
      records.push(valid);
      writeAll(records);
      return valid;
    },
    async delete(id) { writeAll(readAll().filter((record) => record.id !== id)); },
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB"));
  });
}

export function createIndexedDbRepository(factory: IDBFactory): ProjectRepository {
  async function store(mode: IDBTransactionMode) {
    const database = await openDatabase(factory);
    const transaction = database.transaction(STORE_NAME, mode);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
    return transaction.objectStore(STORE_NAME);
  }

  return {
    async list() {
      const records = (await requestResult((await store("readonly")).getAll())).map(validateRecord);
      return records.map(summary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async get(id) {
      const record = await requestResult((await store("readonly")).get(id)) as unknown;
      return record ? validateRecord(record) : null;
    },
    async put(record) {
      const valid = validateRecord(record);
      await requestResult((await store("readwrite")).put(valid));
      return valid;
    },
    async delete(id) {
      await requestResult((await store("readwrite")).delete(id));
    },
  };
}

export function createProjectRepository(): ProjectRepository {
  let storage: KeyValueStorage = serverSafeStorage;
  let factory: IDBFactory | null = null;
  try { storage = window.localStorage; } catch { /* storage can be blocked */ }
  try { factory = window.indexedDB ?? null; } catch { /* IndexedDB can be blocked */ }
  const fallback = createLocalStorageRepository(storage);
  if (!factory) return fallback;
  const indexed = createIndexedDbRepository(factory);
  return {
    async list() { try { return await indexed.list(); } catch { return fallback.list(); } },
    async get(id) { try { return await indexed.get(id); } catch { return fallback.get(id); } },
    async put(record) { try { return await indexed.put(record); } catch { return fallback.put(record); } },
    async delete(id) { try { await indexed.delete(id); } catch { await fallback.delete(id); } },
  };
}

export function createNamespacedRepository(base: ProjectRepository, namespace: string): ProjectRepository {
  const prefix = `${ACCOUNT_PREFIX}${namespace}:`;
  const externalId = (id: string) => id.slice(prefix.length);
  return {
    async list() {
      return (await base.list()).filter((project) => project.id.startsWith(prefix)).map((project) => ({ ...project, id: externalId(project.id) }));
    },
    async get(id) {
      const value = await base.get(`${prefix}${id}`);
      return value ? { ...value, id } : null;
    },
    async put(record) {
      const saved = await base.put({ ...record, id: `${prefix}${record.id}` });
      return { ...saved, id: record.id };
    },
    async delete(id) { await base.delete(`${prefix}${id}`); },
  };
}

export function createAnonymousRepository(base: ProjectRepository): ProjectRepository {
  const isAccountCache = (id: string) => id.startsWith(ACCOUNT_PREFIX) && id.includes(":");
  return {
    async list() { return (await base.list()).filter((project) => !isAccountCache(project.id)); },
    async get(id) { return isAccountCache(id) ? null : base.get(id); },
    async put(record) {
      if (isAccountCache(record.id)) throw new Error("Account cache ids cannot be stored in the local workspace");
      return base.put(record);
    },
    async delete(id) { if (!isAccountCache(id)) await base.delete(id); },
  };
}

const serverSafeStorage: KeyValueStorage = {
  getItem: () => null,
  setItem: () => undefined,
};

export const projectCacheRepository = typeof window === "undefined"
  ? createLocalStorageRepository(serverSafeStorage)
  : createProjectRepository();
export const projectRepository = createAnonymousRepository(projectCacheRepository);

export function recordFor(id: string, document: DiagramDocument, createdAt?: string, serverRevision?: number, accessRole?: ProjectRecord["accessRole"]): ProjectRecord {
  return {
    id,
    title: document.metadata.title,
    document: parseDiagram(document),
    createdAt: createdAt ?? document.metadata.createdAt,
    updatedAt: document.metadata.updatedAt,
    serverRevision,
    accessRole,
  };
}
