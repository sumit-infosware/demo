import { prisma } from "../config/clients.js";
import { ColourCategory } from "../enums/status.enum.js";
import type { AvailableColour } from "../types/tags.types.js";

// 6 Base Colours (Standard factory visibility colours)
const BASE_COLOURS = ["RED", "BLUE", "GREEN", "YELLOW", "ORANGE", "PURPLE"];

function generateAllCombinations(): AvailableColour[] {
  const list: AvailableColour[] = [];

  // 1. Generate SINGLE Colours (6)
  BASE_COLOURS.forEach((c) => {
    list.push({ code: c, displayName: c, colours: [c], category: ColourCategory.SINGLE });
  });

  // 2. Generate DUAL Colours (15 combinations using nested loop)
  for (let i = 0; i < BASE_COLOURS.length; i++) {
    for (let j = i + 1; j < BASE_COLOURS.length; j++) {
      const combo = `${BASE_COLOURS[i]}+${BASE_COLOURS[j]}`;
      list.push({
        code: combo,
        displayName: `${BASE_COLOURS[i]} + ${BASE_COLOURS[j]}`,
        colours: [BASE_COLOURS[i]!, BASE_COLOURS[j]!],
        category: ColourCategory.DUAL,
      });
    }
  }

  // 3. Generate TRIPLE Colours (20 combinations using 3 nested loops)
  for (let i = 0; i < BASE_COLOURS.length; i++) {
    for (let j = i + 1; j < BASE_COLOURS.length; j++) {
      for (let k = j + 1; k < BASE_COLOURS.length; k++) {
        const combo = `${BASE_COLOURS[i]}+${BASE_COLOURS[j]}+${BASE_COLOURS[k]}`;
        list.push({
          code: combo,
          displayName: `${BASE_COLOURS[i]} + ${BASE_COLOURS[j]} + ${BASE_COLOURS[k]}`,
          colours: [BASE_COLOURS[i]!, BASE_COLOURS[j]!, BASE_COLOURS[k]!],
          category: ColourCategory.TRIPLE,
        });
      }
    }
  }
  return list;
}

// Generate once in memory when server starts (Singleton pattern)
const ALL_COLOURS = generateAllCombinations();

export const colourList = {
  /** Return all 41 colours (Used by Frontend to show dropdown) */
  getAll(): AvailableColour[] {
    return [...ALL_COLOURS];
  },

  /** Check if a colour code exists (Used by Zod/Service for validation) */
  isValid(code: string): boolean {
    return ALL_COLOURS.some((c) => c.code === code);
  },

  /** NEW: Get category (SINGLE/DUAL/TRIPLE) for a colour code to save in DB */
  getCategory(code: string): string | null {
    const match = ALL_COLOURS.find((c) => c.code === code);
    return match ? match.category : null;
  },

  /** Smart Suggestion: Give a colour that hasn't been used in the last 48 hours */
  async getSuggestion(): Promise<string> {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago

    // Fetch distinct colours used in the last 48 hours from PacketTag table
    const recentTags = await prisma.packetTag.findMany({
      where: { taggedAt: { gte: since }, colour: { not: null } },
      select: { colour: true },
      distinct: ["colour"],
    });

    const used = new Set(recentTags.map((t: { colour: string | null }) => t.colour));

    // Find the first colour that is NOT in the 'used' set
    for (const c of ALL_COLOURS) {
      if (!used.has(c.code)) return c.code;
    }

    // If all 41 colours were used in 48 hours, default back to RED
    return ALL_COLOURS[0]!.code;
  },
};
