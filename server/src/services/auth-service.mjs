import { HttpError } from "../lib/errors.mjs";
import { equalToken, hashPassword, id, isUuid, normalizeEmail, token, tokenHash, validatePassword, verifyPassword } from "../lib/security.mjs";

export class AuthService {
  constructor(store, config) { this.store = store; this.config = config; }

  async register({ email: emailValue, password: passwordValue, displayName: nameValue }) {
    const email = normalizeEmail(emailValue); const password = validatePassword(passwordValue);
    const displayName = typeof nameValue === "string" ? nameValue.trim().slice(0, 80) : "";
    if (!displayName) throw new HttpError(400, "Display name is required", "invalid_display_name");
    return this.store.locked("accounts", async () => {
      const index = await this.store.read(["accounts.json"], { byEmail: {} });
      if (index.byEmail[email]) throw new HttpError(409, "An account already exists for this email", "email_exists");
      const user = { id: id(), email, displayName, password: await hashPassword(password), createdAt: new Date().toISOString() };
      await this.store.write(["users", `${user.id}.json`], user);
      index.byEmail[email] = user.id;
      await this.store.write(["accounts.json"], index);
      return this.publicUser(user);
    });
  }

  async login({ email: emailValue, password }) {
    const email = normalizeEmail(emailValue);
    const index = await this.store.read(["accounts.json"], { byEmail: {} });
    const userId = index.byEmail[email];
    const user = isUuid(userId) ? await this.store.read(["users", `${userId}.json`]) : null;
    if (!user || !await verifyPassword(typeof password === "string" ? password : "", user.password)) throw new HttpError(401, "Email or password is incorrect", "invalid_credentials");
    return this.publicUser(user);
  }

  async createSession(userId) {
    const sessionId = id(); const secret = token(); const csrfToken = token();
    const session = { id: sessionId, userId, secretHash: tokenHash(secret), csrfToken, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + this.config.sessionHours * 3_600_000).toISOString() };
    await this.store.write(["sessions", `${sessionId}.json`], session);
    return { cookieValue: `${sessionId}.${secret}`, csrfToken };
  }

  async authenticate(cookieValue) {
    const [sessionId, secret] = typeof cookieValue === "string" ? cookieValue.split(".") : [];
    if (!isUuid(sessionId) || !secret) return null;
    const session = await this.store.read(["sessions", `${sessionId}.json`]);
    if (!session || !equalToken(tokenHash(secret), session.secretHash)) return null;
    if (Date.parse(session.expiresAt) <= Date.now()) { await this.store.remove(["sessions", `${sessionId}.json`]); return null; }
    const user = await this.store.read(["users", session.userId + ".json"]);
    return user ? { session, user: this.publicUser(user) } : null;
  }

  verifyCsrf(session, supplied) {
    if (!equalToken(session.csrfToken, supplied)) throw new HttpError(403, "CSRF validation failed", "invalid_csrf");
  }

  async logout(sessionId) { if (isUuid(sessionId)) await this.store.remove(["sessions", `${sessionId}.json`]); }
  async findPublicUserByEmail(emailValue) {
    const email = normalizeEmail(emailValue);
    const index = await this.store.read(["accounts.json"], { byEmail: {} });
    const userId = index.byEmail[email];
    const user = isUuid(userId) ? await this.store.read(["users", `${userId}.json`]) : null;
    return user ? this.publicUser(user) : null;
  }
  async publicUsers(userIds) {
    const users = await Promise.all([...new Set(userIds)].filter(isUuid).map((userId) => this.store.read(["users", `${userId}.json`])));
    return users.filter(Boolean).map((user) => this.publicUser(user));
  }
  publicUser(user) { return { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt }; }
}
