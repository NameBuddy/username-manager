export type UsernameValidation = { valid: true } | { valid: false; reason: string };

const MINECRAFT_USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;

export function normalizeUsername(value: string): string {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_]/g, "")
    .toLowerCase();
}

export function validateMinecraftUsername(value: string): UsernameValidation {
  const trimmed = value.trim();

  if (!trimmed) {
    return { valid: false, reason: "Name is blank" };
  }

  if (trimmed.length < 3) {
    return { valid: false, reason: "Too short" };
  }

  if (trimmed.length > 16) {
    return { valid: false, reason: "Too long" };
  }

  if (!MINECRAFT_USERNAME_PATTERN.test(trimmed)) {
    return { valid: false, reason: "Contains unsupported character" };
  }

  return { valid: true };
}

export function buildFuzzyKey(value: string): string {
  return normalizeUsername(value).replace(/_/g, "");
}

export function slugify(value: string): string {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

