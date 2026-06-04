import { describe, expect, it, vi } from "vitest";
import { lookupMinecraftProfile } from "@/lib/mojang";

describe("lookupMinecraftProfile", () => {
  it("returns a profile only when Mojang responds with a UUID", async () => {
    const fetcher = vi.fn(async () => Response.json({ id: "d8d5a9237b2043d8883b1150148d6955", name: "Test" }));

    await expect(lookupMinecraftProfile("Test", fetcher)).resolves.toEqual({
      id: "d8d5a9237b2043d8883b1150148d6955",
      name: "Test",
    });
    expect(fetcher).toHaveBeenCalledWith("https://api.mojang.com/users/profiles/minecraft/Test", {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: expect.any(AbortSignal),
    });
  });

  it("returns null when Mojang does not return a UUID profile", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        {
          path: "/users/profiles/minecraft/penis",
          errorMessage: "Couldn't find any profile with name penis",
        },
        { status: 404 },
      ),
    );

    await expect(lookupMinecraftProfile("penis", fetcher)).resolves.toBeNull();
  });

  it("returns null when the Mojang request times out", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(() => new Promise<Response>(() => undefined));

    const lookup = lookupMinecraftProfile("Stalled", fetcher, { timeoutMs: 10 });
    await vi.advanceTimersByTimeAsync(10);

    await expect(lookup).resolves.toBeNull();
    vi.useRealTimers();
  });
});
