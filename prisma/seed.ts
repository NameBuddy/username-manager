import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const accessUserEmail = "access@namedb.local";
const accessUserPasswordHash = "access-password-login-disabled";

const categories = [
  ["anime-manga", "Anime & Manga", "#ef4444"],
  ["game-characters", "Game Characters", "#22c55e"],
  ["movies-tv", "Movie & TV Characters", "#3b82f6"],
  ["mythology", "Mythology", "#a855f7"],
  ["brands", "Brands", "#f97316"],
  ["english-words", "English Words", "#14b8a6"],
  ["minecraft-terms", "Minecraft Terms", "#84cc16"],
  ["names", "Names", "#64748b"],
  ["aesthetic-words", "Aesthetic Gamer Words", "#ec4899"],
  ["places", "Places", "#06b6d4"],
  ["music", "Music", "#8b5cf6"],
  ["sports", "Sports", "#f59e0b"],
  ["internet-culture", "Internet Culture", "#0f766e"],
  ["tech-ai-crypto", "Tech / AI / Crypto", "#111827"],
] as const;

const oldDefaultTagSlugs = [
  "jujutsu-kaisen",
  "naruto",
  "one-piece",
  "pokemon",
  "nintendo",
  "marvel",
  "greek-mythology",
  "short",
  "clean",
  "hype",
  "seasonal",
  "trending",
  "character",
  "villain",
  "main-character",
];

const oldDefaultLabelSlugs = [
  "high-value",
  "needs-review",
  "pending-check",
  "checked",
  "available",
  "unavailable",
  "sniped",
  "ignore",
  "duplicate-warning",
  "manual-pick",
  "imported",
];

async function main() {
  await prisma.user.upsert({
    where: { email: accessUserEmail },
    update: { passwordHash: accessUserPasswordHash, role: "admin" },
    create: { email: accessUserEmail, passwordHash: accessUserPasswordHash, role: "admin" },
  });

  for (const [slug, name, color] of categories) {
    await prisma.category.upsert({
      where: { slug },
      update: { name, color },
      create: { slug, name, color },
    });
  }

  await prisma.candidateTag.deleteMany({ where: { tag: { slug: { in: oldDefaultTagSlugs } } } });
  await prisma.tag.deleteMany({ where: { slug: { in: oldDefaultTagSlugs } } });
  await prisma.candidateLabel.deleteMany({ where: { label: { slug: { in: oldDefaultLabelSlugs } } } });
  await prisma.label.deleteMany({ where: { slug: { in: oldDefaultLabelSlugs } } });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
