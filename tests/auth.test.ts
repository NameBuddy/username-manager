import { afterEach, describe, expect, it } from "vitest";
import {
  SESSION_MAX_AGE_SECONDS,
  isAccessPasswordConfigured,
  signSessionValue,
  verifyAccessPassword,
  verifySessionValue,
} from "@/lib/auth";

describe("session signing", () => {
  it("round-trips a signed session payload", async () => {
    const signed = await signSessionValue({ userId: "user-1", role: "admin" });

    await expect(verifySessionValue(signed)).resolves.toMatchObject({
      userId: "user-1",
      role: "admin",
    });
  });

  it("rejects tampered session values", async () => {
    const signed = await signSessionValue({ userId: "user-1", role: "admin" });
    const tampered = signed.replace(/\.[^.]+$/, ".bad");

    await expect(verifySessionValue(tampered)).resolves.toBeNull();
  });

  it("uses a long-lived local session cookie duration", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBeGreaterThanOrEqual(60 * 60 * 24 * 180);
  });
});

describe("access password", () => {
  const originalAccessPassword = process.env.ACCESS_PASSWORD;

  afterEach(() => {
    if (originalAccessPassword === undefined) {
      delete process.env.ACCESS_PASSWORD;
    } else {
      process.env.ACCESS_PASSWORD = originalAccessPassword;
    }
  });

  it("accepts only the configured ACCESS_PASSWORD", () => {
    process.env.ACCESS_PASSWORD = "open-sesame";

    expect(isAccessPasswordConfigured()).toBe(true);
    expect(verifyAccessPassword("open-sesame")).toBe(true);
    expect(verifyAccessPassword("wrong-password")).toBe(false);
  });

  it("rejects login when ACCESS_PASSWORD is missing", () => {
    delete process.env.ACCESS_PASSWORD;

    expect(isAccessPasswordConfigured()).toBe(false);
    expect(verifyAccessPassword("open-sesame")).toBe(false);
  });
});
