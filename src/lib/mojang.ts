export type MinecraftProfile = {
  id: string;
  name: string;
};

type Fetcher = typeof fetch;

function isUndashedUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{32}$/i.test(value);
}

export async function lookupMinecraftProfile(username: string, fetcher: Fetcher = fetch): Promise<MinecraftProfile | null> {
  const cleanUsername = username.trim();
  if (!cleanUsername) {
    return null;
  }

  try {
    const response = await fetcher(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(cleanUsername)}`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
      },
    );

    if (!response.ok) {
      return null;
    }

    const body = (await response.json().catch(() => null)) as { id?: unknown; name?: unknown } | null;
    if (!body || !isUndashedUuid(body.id) || typeof body.name !== "string") {
      return null;
    }

    return { id: body.id, name: body.name };
  } catch {
    return null;
  }
}
