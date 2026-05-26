/**
 * WhatsApp Template Management API Endpoint
 * Location: app/api/whatsapp/templates/route.js
 */

import { NextResponse } from 'next/server';
import { listTemplates, createTemplate, deleteTemplate } from '@/lib/whatsapp/client';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

async function checkConfig() {
  let isConfigured = !!process.env.WHATSAPP_ACCESS_TOKEN;
  if (!isConfigured) {
    try {
      const shop = await prisma.shop.findFirst();
      if (shop?.whatsappToken) {
        isConfigured = true;
      }
    } catch (e) {}
  }
  return isConfigured;
}

/**
 * GET — List all templates
 */
export async function GET() {
  const isConfigured = await checkConfig();
  if (!isConfigured) {
    return NextResponse.json(
      { error: 'WhatsApp not configured' },
      { status: 503 }
    );
  }

  try {
    const templates = await listTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('[WhatsApp Templates CRUD] GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST — Create a new template
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

    const result = await createTemplate({ name, category, language, components });
    return NextResponse.json({ success: true, template: result });
  } catch (error) {
    console.error('[WhatsApp Templates CRUD] POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE — Delete a template
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

    await deleteTemplate(name);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[WhatsApp Templates CRUD] DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
