const CURRENT_STORAGE_VERSION = 2;

export async function runStorageMigrations(store) {
  const metadata = await store.read(["storage.json"], { version: 1 });
  if (!Number.isInteger(metadata.version) || metadata.version < 1 || metadata.version > CURRENT_STORAGE_VERSION) {
    throw new Error(`Unsupported storage version: ${metadata.version}`);
  }
  if (metadata.version < 2) {
    for (const ownerId of await store.directories(["projects"])) {
      for (const file of await store.list(["projects", ownerId])) {
        if (file === "_index.json") continue;
        const project = await store.read(["projects", ownerId, file]);
        if (!project?.id || !project.document) continue;
        const migrated = { ...project, members: Array.isArray(project.members) ? project.members : [], retentionLimit: project.retentionLimit ?? 50 };
        await store.write(["projects", ownerId, file], migrated);
        await store.writeIfMissing(["revisions", ownerId, project.id, `${project.revision}.json`], {
          revision: project.revision, createdAt: project.updatedAt, actorId: ownerId, document: project.document,
        });
      }
    }
    metadata.version = 2;
  }
  metadata.updatedAt = new Date().toISOString();
  await store.write(["storage.json"], metadata);
  return metadata;
}

export { CURRENT_STORAGE_VERSION };
