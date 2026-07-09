import prisma from '../lib/db';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    const filePath = path.join(process.cwd(), 'lib', 'email-templates', 'order-confirmation.html');
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const htmlBody = fs.readFileSync(filePath, 'utf8');
    
    // Find the active template with trigger ORDER_CONFIRMATION
    const template = await prisma.emailTemplate.findFirst({
      where: { automationTrigger: 'ORDER_CONFIRMATION' }
    });

    if (template) {
      console.log(`Found template: ${template.name} (ID: ${template.id}). Updating htmlBody...`);
      await prisma.emailTemplate.update({
        where: { id: template.id },
        data: { htmlBody }
      });
      console.log('Successfully updated order confirmation template in the database!');
    } else {
      console.log('No order confirmation template found in database to update.');
    }
  } catch (error) {
    console.error('Error updating database template:', error);
  }
}

main();
