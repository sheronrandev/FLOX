import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { HttpError } from "./errors.mjs";

const scrypt = promisify(scryptCallback);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL.test(email)) throw new HttpError(400, "Enter a valid email address", "invalid_email");
  return email;
}

export function validatePassword(value) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128) {
    throw new HttpError(400, "Password must be between 12 and 128 characters", "invalid_password");
  }
  return value;
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return { algorithm: "scrypt", salt: salt.toString("base64url"), hash: Buffer.from(derived).toString("base64url") };
}

export async function verifyPassword(password, stored) {
  if (!stored || stored.algorithm !== "scrypt") return false;
  const expected = Buffer.from(stored.hash, "base64url");
  const actual = Buffer.from(await scrypt(password, Buffer.from(stored.salt, "base64url"), expected.length, { N: 16384, r: 8, p: 1 }));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const token = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const tokenHash = (value) => createHash("sha256").update(value).digest("base64url");
export const id = () => randomUUID();
export const isUuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function equalToken(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
