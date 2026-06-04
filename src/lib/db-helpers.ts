import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify, uniqueNonEmpty } from "@/lib/names";

const palette = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#ca8a04",
  "#7c3aed",
  "#0891b2",
  "#ea580c",
  "#4f46e5",
];

function colorFor(value: string) {
  const index = [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
  return palette[index];
}

export async function getOrCreateCategory(name?: string | null, tx: Prisma.TransactionClient = prisma) {
  const cleanName = name?.trim();
  if (!cleanName) return null;
  const slug = slugify(cleanName);
  return tx.category.upsert({
    where: { slug },
    update: {},
    create: { slug, name: cleanName, color: colorFor(cleanName) },
  });
}

export async function getOrCreateSource(name?: string | null, tx: Prisma.TransactionClient = prisma) {
  const cleanName = name?.trim() || "Manual Import";
  return tx.source.upsert({
    where: { name: cleanName },
    update: {},
    create: { name: cleanName, type: "manual" },
  });
}

export async function getOrCreateTags(names: string[] = [], tx: Prisma.TransactionClient = prisma) {
  const cleanNames = uniqueNonEmpty(names);
  const tags = [];

  for (const name of cleanNames) {
    tags.push(
      await tx.tag.upsert({
        where: { slug: slugify(name) },
        update: {},
        create: { slug: slugify(name), name, color: colorFor(name) },
      }),
    );
  }

  return tags;
}

export async function getOrCreateLabels(names: string[] = [], tx: Prisma.TransactionClient = prisma) {
  const cleanNames = uniqueNonEmpty(names);
  const labels = [];

  for (const name of cleanNames) {
    labels.push(
      await tx.label.upsert({
        where: { slug: slugify(name) },
        update: {},
        create: { slug: slugify(name), name, color: colorFor(name) },
      }),
    );
  }

  return labels;
}

