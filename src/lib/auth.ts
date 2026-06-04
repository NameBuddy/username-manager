import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "namedb_session";

export type SessionPayload = {
  userId: string;
  email: string;
  role: "admin";
  expiresAt?: number;
};

const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret(): string {
  return process.env.SESSION_SECRET ?? "test-session-secret-with-at-least-32-chars";
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

export async function createSessionCookie(user: { id: string; email: string; role: string }) {
  const cookieStore = await cookies();
  const value = await signSessionValue({
    userId: user.id,
    email: user.email,
    role: "admin",
    expiresAt: Date.now() + DEFAULT_MAX_AGE_SECONDS * 1000,
  });

  cookieStore.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: DEFAULT_MAX_AGE_SECONDS,
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

export async function verifyPasswordLogin(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || user.role !== "admin") {
    return null;
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  return matches ? user : null;
}

