import { describe, expect, it } from "vitest";
import { signSessionValue, verifySessionValue } from "@/lib/auth";

describe("session signing", () => {
  it("round-trips a signed session payload", async () => {
    const signed = await signSessionValue({ userId: "user-1", email: "admin@example.com", role: "admin" });

    await expect(verifySessionValue(signed)).resolves.toMatchObject({
      userId: "user-1",
      email: "admin@example.com",
      role: "admin",
    });
  });

  it("rejects tampered session values", async () => {
    const signed = await signSessionValue({ userId: "user-1", email: "admin@example.com", role: "admin" });
    const tampered = signed.replace(/\.[^.]+$/, ".bad");

    await expect(verifySessionValue(tampered)).resolves.toBeNull();
  });
});
