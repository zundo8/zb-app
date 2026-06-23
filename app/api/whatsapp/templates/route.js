/**
 * WhatsApp Template Management API Endpoint with Local DB Cache Synchronization
 * Location: app/api/whatsapp/templates/route.js
 */

import { NextResponse } from 'next/server';
import { listTemplates, createTemplate, deleteTemplate, getConfig } from '@/lib/whatsapp/client';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

async function checkConfig() {
  const config = await getConfig();
  return config.configured;
}

/**
 * GET — Sync templates from Meta and return cached list
 */
export async function GET(req) {
  const isConfigured = await checkConfig();
  if (!isConfigured) {
    return NextResponse.json(
      { error: 'WhatsApp not configured' },
      { status: 503 }
    );
  }

  try {
    // 1. Fetch from Meta API
    const metaTemplates = await listTemplates();

    // 2. Sync to local database cache (whatsapp_templates)
    if (metaTemplates && Array.isArray(metaTemplates)) {
      for (const t of metaTemplates) {
        await prisma.whatsAppTemplate.upsert({
          where: { name: t.name },
          update: {
            category: t.category,
            language: t.language,
            status: t.status,
            components: t.components || [],
            updatedAt: new Date()
          },
          create: {
            name: t.name,
            category: t.category,
            language: t.language,
            status: t.status,
            components: t.components || []
          }
        });
      }

      // Purge templates from DB that no longer exist on Meta
      const metaNames = metaTemplates.map(t => t.name);
      await prisma.whatsAppTemplate.deleteMany({
        where: {
          name: { notIn: metaNames }
        }
      });
    }

    // 3. Return the synced templates from database
    const dbTemplates = await prisma.whatsAppTemplate.findMany({
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ templates: dbTemplates });
  } catch (error) {
    console.error('[WhatsApp Templates CRUD] GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST — Create a template in Meta and update DB cache
 */
export async function POST(req) {
  const isConfigured = await checkConfig();
  if (!isConfigured) {
    return NextResponse.json(
      { error: 'WhatsApp not configured' },
      { status: 503 }
    );
  }

  try {
    const { name, category, language = 'en', components } = await req.json();

    if (!name || !category || !components) {
      return NextResponse.json(
        { error: 'Missing name, category, or components' },
        { status: 400 }
      );
    }

    // Validate name: lowercase with underscores only
    const nameRegex = /^[a-z0-9_]+$/;
    if (!nameRegex.test(name)) {
      return NextResponse.json(
        { error: 'Template name must be lowercase with underscores only (no spaces, special characters or capital letters).' },
        { status: 400 }
      );
    }

    if (name.length > 512) {
      return NextResponse.json(
        { error: 'Template name must be under 512 characters.' },
        { status: 400 }
      );
    }

    // Call Meta API to create the template
    const result = await createTemplate({ name, category, language, components });

    // Pre-cache template as PENDING (Meta will update it asynchronously via webhook or sync check)
    const localTemplate = await prisma.whatsAppTemplate.upsert({
      where: { name },
      update: {
        category,
        language,
        status: 'PENDING',
        components: components || [],
        updatedAt: new Date()
      },
      create: {
        name,
        category,
        language,
        status: 'PENDING',
        components: components || []
      }
    });

    return NextResponse.json({ success: true, template: localTemplate, metaResult: result });
  } catch (error) {
    console.error('[WhatsApp Templates CRUD] POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE — Delete a template from Meta and local DB cache
 */
export async function DELETE(req) {
  const isConfigured = await checkConfig();
  if (!isConfigured) {
    return NextResponse.json(
      { error: 'WhatsApp not configured' },
      { status: 503 }
    );
  }

  try {
    const { name } = await req.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Missing template name' },
        { status: 400 }
      );
    }

    // Delete from Meta API
    await deleteTemplate(name);

    // Delete from local DB cache
    await prisma.whatsAppTemplate.deleteMany({
      where: { name }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[WhatsApp Templates CRUD] DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
