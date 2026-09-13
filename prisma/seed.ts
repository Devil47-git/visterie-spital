import { prisma } from "../src/lib/prisma";

async function main() {
  // Creează Treasury dacă nu există
  const treasury = await prisma.treasury.findFirst();
  if (!treasury) {
    await prisma.treasury.create({ data: { totalAmount: 0 } });
  }

  const whitelistUsers = [
    { discordId: "702150314643554304", callsign: "M-001", rol: "admin", name: "Darrin Rodriguez" },
    { discordId: "285446821533188101", callsign: "M-002", rol: "user", name: "Antonio Shades" },
    { discordId: "793944399913680916", callsign: "M-003", rol: "user", name: "Marius Mark" },
    { discordId: "", callsign: "M-004", rol: "user", name: "N/A" },
    { discordId: "773586551325458473", callsign: "M-005", rol: "user", name: "Erwin Moretti" },
    { discordId: "", callsign: "M-006", rol: "user", name: "N/A" },
    { discordId: "556128906357374996", callsign: "M-007", rol: "user", name: "Mihail Parvu" },
    { discordId: "", callsign: "M-008", rol: "user", name: "N/A" },
    { discordId: "428576202920558602", callsign: "M-009", rol: "user", name: "Vlad Samson" },
    { discordId: "705769844750024716", callsign: "M-010", rol: "user", name: "Xender NDC" },
    { discordId: "779291003751759932", callsign: "M-011", rol: "user", name: "AlMajdi Tariq" },
    { discordId: "", callsign: "M-012", rol: "user", name: "N/A" },

  ];

  for (const user of whitelistUsers) {
    if (!user.discordId) continue; 
    await prisma.whitelist.upsert({
      where: { discordId: user.discordId },
      update: {},
      create: user,
    });
  }

  console.log("Seed complet.");
}

main()
  .catch(console.error)
  .finally(async () => prisma.$disconnect());