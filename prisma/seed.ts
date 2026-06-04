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

const tags = [
  "Jujutsu Kaisen",
  "Naruto",
  "One Piece",
  "Pokemon",
  "Nintendo",
  "Marvel",
  "Greek Mythology",
  "Short",
  "Clean",
  "Hype",
  "Seasonal",
  "Trending",
  "Character",
  "Villain",
  "Main Character",
];

const labels = [
  ["high-value", "High Value", "#dc2626"],
  ["needs-review", "Needs Review", "#ca8a04"],
  ["pending-check", "Pending Check", "#2563eb"],
  ["checked", "Checked", "#16a34a"],
  ["available", "Available", "#059669"],
  ["unavailable", "Unavailable", "#71717a"],
  ["sniped", "Sniped", "#7c3aed"],
  ["ignore", "Ignore", "#52525b"],
  ["duplicate-warning", "Duplicate Warning", "#ea580c"],
  ["manual-pick", "Manual Pick", "#0891b2"],
  ["imported", "Imported", "#4f46e5"],
] as const;

async function main() {
  await prisma.user.upsert({
    where: { email: accessUserEmail },
    update: { passwordHash: accessUserPasswordHash, role: "admin" },
    create: { email: accessUserEmail, passwordHash: accessUserPasswordHash, role: "admin" },
  });

  await prisma.source.upsert({
    where: { name: "Manual Import" },
    update: {},
    create: { name: "Manual Import", type: "manual" },
  });

  for (const [slug, name, color] of categories) {
    await prisma.category.upsert({
      where: { slug },
      update: { name, color },
      create: { slug, name, color },
    });
  }

  for (const name of tags) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await prisma.tag.upsert({
      where: { slug },
      update: { name },
      create: { slug, name },
    });
  }

  for (const [slug, name, color] of labels) {
    await prisma.label.upsert({
      where: { slug },
      update: { name, color },
      create: { slug, name, color },
    });
  }
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
