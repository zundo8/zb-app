/**
 * scripts/seed-kb.ts
 * Seed default Knowledge Base entries into PostgreSQL.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import prisma from '../lib/db';
import { DEFAULT_KB_ENTRIES } from '../lib/ai/knowledgeBase';


async function main() {
  console.log('Seeding Support Knowledge Base entries...');

  for (const entry of DEFAULT_KB_ENTRIES) {
    const existing = await prisma.supportKnowledgeBase.findFirst({
      where: { title: entry.title },
    });

    if (existing) {
      await prisma.supportKnowledgeBase.update({
        where: { id: existing.id },
        data: {
          category: entry.category,
          content: entry.content,
          keywords: entry.keywords,
          priority: entry.priority,
          isActive: true,
        },
      });
      console.log(`Updated existing KB entry: "${entry.title}"`);
    } else {
      await prisma.supportKnowledgeBase.create({
        data: {
          category: entry.category,
          title: entry.title,
          content: entry.content,
          keywords: entry.keywords,
          priority: entry.priority,
          isActive: true,
        },
      });
      console.log(`Created new KB entry: "${entry.title}"`);
    }
  }

  console.log('Knowledge Base seeding complete ✓');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
