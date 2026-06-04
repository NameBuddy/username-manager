import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "namedb_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
export const ACCESS_USER_EMAIL = "access@namedb.local";
const ACCESS_USER_PASSWORD_HASH = "access-password-login-disabled";

export type SessionPayload = {
  userId: string;
  role: "admin";
  expiresAt?: number;
};

function getSessionSecret(): string {
  return process.env.SESSION_SECRET ?? "test-session-secret-with-at-least-32-chars";
}

export function isAccessPasswordConfigured(): boolean {
  return Boolean(process.env.ACCESS_PASSWORD);
}

export function verifyAccessPassword(password: string): boolean {
  const configuredPassword = process.env.ACCESS_PASSWORD;
  if (!configuredPassword || !password) {
    return false;
  }

  const expected = Buffer.from(configuredPassword, "utf8");
  const actual = Buffer.from(password, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function base64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function unbase64url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string): string {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

export async function signSessionValue(payload: SessionPayload): Promise<string> {
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export async function verifySessionValue(value?: string | null): Promise<SessionPayload | null> {
  if (!value) {
    return null;
  }

  const [body, signature] = value.split(".");
  if (!body || !signature) {
    return null;
  }

  const expected = sign(body);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(unbase64url(body)) as SessionPayload;
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
      return null;
    }
    if (parsed.role !== "admin") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function createSessionCookie(user: { id: string; role: string }) {
  const cookieStore = await cookies();
  const value = await signSessionValue({
    userId: user.id,
    role: "admin",
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });

  cookieStore.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function deleteSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return verifySessionValue(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireAdminApi(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new AuthError();
  }
  return session;
}

export class AuthError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthError";
  }
}

export async function getAccessUser() {
  return prisma.user.upsert({
    where: { email: ACCESS_USER_EMAIL },
    update: { passwordHash: ACCESS_USER_PASSWORD_HASH, role: "admin" },
    create: { email: ACCESS_USER_EMAIL, passwordHash: ACCESS_USER_PASSWORD_HASH, role: "admin" },
  });
}
