import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

// Load env
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function main() {
  console.log('Starting image migration from Base64 to local files...');
  
  // Dynamically import prisma so env vars are already loaded
  const { default: prisma } = await import('../lib/db');

  const users = await prisma.featuredUser.findMany();
  console.log(`Found ${users.length} total featured users in database.`);

  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });

  let migratedCount = 0;

  for (const u of users) {
    if (u.imageUrl && u.imageUrl.startsWith('data:')) {
      console.log(`Migrating image for user: ${u.name} (ID: ${u.id})...`);
      
      try {
        // Parse data URI: data:[<mediatype>][;base64],<data>
        const match = u.imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
          console.warn(`- Failed to parse data URI for ${u.name}`);
          continue;
        }

        const mimeType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');

        // Determine extension
        let ext = 'jpg';
        if (mimeType.includes('png')) ext = 'png';
        else if (mimeType.includes('webp')) ext = 'webp';
        else if (mimeType.includes('gif')) ext = 'gif';
        else if (mimeType.includes('heic')) ext = 'heic';
        else if (mimeType.includes('heif')) ext = 'heif';

        const filename = `${crypto.randomUUID()}.${ext}`;
        const filePath = path.join(uploadDir, filename);

        await fs.writeFile(filePath, buffer);
        const publicUrl = `/uploads/${filename}`;

        // Update database
        await prisma.featuredUser.update({
          where: { id: u.id },
          data: { imageUrl: publicUrl }
        });

        console.log(`- Successfully migrated! New URL: ${publicUrl} (Size: ${Math.round(buffer.length / 1024)} KB)`);
        migratedCount++;
      } catch (err: any) {
        console.error(`- Error migrating image for ${u.name}:`, err.message);
      }
    } else {
      console.log(`User ${u.name} already has standard URL: ${u.imageUrl?.substring(0, 60)}...`);
    }
  }

  console.log(`\nMigration completed. Migrated ${migratedCount} images.`);
  await prisma.$disconnect();
}

main().catch(console.error);
