import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { AuthError } from "@/lib/auth";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function toApiError(error: unknown) {
  if (error instanceof AuthError) {
    return jsonError("Authentication required", 401);
  }

  if (error instanceof z.ZodError) {
    const first = error.issues[0];
    const path = first?.path.map(String).join(".");
    const message = first ? (path ? `${path}: ${first.message}` : first.message) : "Invalid request data";
    return jsonError(message, 400, error.issues);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return jsonError("A record with that unique value already exists", 409);
    if (error.code === "P2025") return jsonError("Record not found", 404);
    if (error.code === "P2003") return jsonError("A related record does not exist", 400);
  }

  if (error instanceof Error) {
    if (error.message.includes("Unique constraint")) {
      return jsonError("A record with that unique value already exists", 409);
    }
    return jsonError(error.message, 400);
  }

  return jsonError("Unexpected server error", 500);
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

