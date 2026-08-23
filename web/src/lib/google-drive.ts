import { serializeDiagram, type DiagramDocument } from "../domain/diagram";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const safeName = (title: string) => title.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Untitled diagram";

async function driveJson<T>(response: Response): Promise<T> {
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((value as { error?: { message?: string } }).error?.message ?? "Google Drive request failed");
  return value as T;
}

export async function uploadDiagramToDrive(token: string, document: DiagramDocument, existingFileId?: string) {
  const content = serializeDiagram(document);
  if (existingFileId) {
    await driveJson(await fetch(`${UPLOAD_API}/files/${encodeURIComponent(existingFileId)}?uploadType=media`, { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: content }));
    return existingFileId;
  }
  const boundary = `activity_studio_${crypto.randomUUID().replaceAll("-", "")}`;
  const metadata = { name: `${safeName(document.metadata.title)}.activity.json`, mimeType: "application/json", description: "FLOX activity diagram" };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
  const result = await driveJson<{ id: string }>(await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": `multipart/related; boundary=${boundary}` }, body }));
  return result.id;
}

export async function shareDriveFile(token: string, fileId: string, email: string, role: "reader" | "writer") {
  await driveJson(await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=true`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ type: "user", role, emailAddress: email }) }));
}

export async function driveFileLink(token: string, fileId: string) {
  const result = await driveJson<{ webViewLink: string }>(await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=webViewLink`, { headers: { authorization: `Bearer ${token}` } }));
  return result.webViewLink;
}
