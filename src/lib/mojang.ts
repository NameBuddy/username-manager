export type MinecraftProfile = {
  id: string;
  name: string;
};

type Fetcher = typeof fetch;

type LookupOptions = {
  timeoutMs?: number;
};

const DEFAULT_LOOKUP_TIMEOUT_MS = 8000;

function isUndashedUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{32}$/i.test(value);
}

export async function lookupMinecraftProfile(
  username: string,
  fetcher: Fetcher = fetch,
  options: LookupOptions = {},
): Promise<MinecraftProfile | null> {
  const cleanUsername = username.trim();
  if (!cleanUsername) {
    return null;
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_LOOKUP_TIMEOUT_MS);
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const response = await Promise.race(
      [
        fetcher(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(cleanUsername)}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        }),
        new Promise<null>((resolve) => {
          timeout = setTimeout(() => {
            controller.abort();
            resolve(null);
          }, timeoutMs);
        }),
      ],
    );

    if (!response?.ok) {
      return null;
    }

    const body = (await response.json().catch(() => null)) as { id?: unknown; name?: unknown } | null;
    if (!body || !isUndashedUuid(body.id) || typeof body.name !== "string") {
      return null;
    }

    return { id: body.id, name: body.name };
  } catch {
    return null;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
