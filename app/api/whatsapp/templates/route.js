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

function normalizeCategory(cat) {
  if (!cat || typeof cat !== 'string') return 'MARKETING';
  const clean = cat.trim().toUpperCase();
  if (clean === 'MARKETING' || clean === 'UTILITY' || clean === 'AUTHENTICATION') {
    return clean;
  }
  if (clean.includes('MARKET')) return 'MARKETING';
  if (clean.includes('UTIL')) return 'UTILITY';
  if (clean.includes('AUTH')) return 'AUTHENTICATION';
  return 'MARKETING';
}

function normalizeLanguage(lang) {
  if (!lang || typeof lang !== 'string') return 'en_US';
  const match = lang.match(/\(([^)]+)\)/);
  let code = match ? match[1] : lang;
  code = code.trim();
  const nameMap = {
    'english': 'en_US',
    'hindi': 'hi',
    'spanish': 'es',
    'french': 'fr'
  };
  if (nameMap[code.toLowerCase()]) {
    return nameMap[code.toLowerCase()];
  }
  return code;
}

function validateVariables(text) {
  if (/\{\{\s*\}\}/.test(text)) {
    throw new Error('Template text contains empty variables: {{}}.');
  }
  const allBraces = text.match(/\{\{([^}]+)\}\}/g) || [];
  for (const brace of allBraces) {
    const inner = brace.slice(2, -2).trim();
    if (!/^\d+$/.test(inner)) {
      throw new Error(`Invalid variable placeholder: ${brace}. Placeholders must contain digits only, e.g., {{1}}.`);
    }
    const val = parseInt(inner, 10);
    if (val === 0) {
      throw new Error(`Invalid variable placeholder: ${brace}. Variables must start from {{1}} (no {{0}}).`);
    }
  }
  const numericVars = allBraces.map(brace => parseInt(brace.slice(2, -2).trim(), 10));
  if (numericVars.length > 0) {
    const uniqueSorted = Array.from(new Set(numericVars)).sort((a, b) => a - b);
    for (let i = 0; i < uniqueSorted.length; i++) {
      if (uniqueSorted[i] !== i + 1) {
        throw new Error(`Variable placeholders must be sequential and start at {{1}}. Missing {{${i + 1}}}.`);
      }
    }
  }
}

function auditAndRebuildComponents(components) {
  if (!Array.isArray(components)) {
    throw new Error('Components must be an array.');
  }
  const hasBody = components.some(c => c && c.type === 'BODY');
  if (!hasBody) {
    throw new Error('Template must contain a BODY component.');
  }
  const cleanComponents = [];
  for (const comp of components) {
    if (!comp || typeof comp !== 'object') continue;
    const type = String(comp.type).toUpperCase();
    if (type === 'HEADER') {
      const format = comp.format ? String(comp.format).toUpperCase() : 'TEXT';
      const headerComp = {
        type: 'HEADER',
        format
      };
      if (format === 'TEXT') {
        if (!comp.text || String(comp.text).trim() === '') {
          throw new Error('Header text is required when HEADER type is TEXT.');
        }
        headerComp.text = String(comp.text).trim();
      }
      cleanComponents.push(headerComp);
    } else if (type === 'BODY') {
      if (!comp.text || String(comp.text).trim() === '') {
        throw new Error('BODY component must contain a non-empty text field.');
      }
      const bodyText = String(comp.text).trim();
      validateVariables(bodyText);
      const variables = bodyText.match(/\{\{\d+\}\}/g) || [];
      const bodyComp = {
        type: 'BODY',
        text: bodyText
      };
      if (variables.length > 0) {
        if (comp.example?.body_text) {
          bodyComp.example = comp.example;
        } else {
          bodyComp.example = {
            body_text: [
              variables.map((_, index) => `Value ${index + 1}`)
            ]
          };
        }
      }
      cleanComponents.push(bodyComp);
    } else if (type === 'FOOTER') {
      if (!comp.text || String(comp.text).trim() === '') {
        throw new Error('FOOTER component must contain a non-empty text field.');
      }
      cleanComponents.push({
        type: 'FOOTER',
        text: String(comp.text).trim()
      });
    } else if (type === 'BUTTONS') {
      if (!Array.isArray(comp.buttons) || comp.buttons.length === 0) {
        throw new Error('BUTTONS component must contain at least one button.');
      }
      const cleanButtons = comp.buttons.map((btn, idx) => {
        if (!btn || typeof btn !== 'object') {
          throw new Error(`Button at index ${idx} is invalid.`);
        }
        const bType = String(btn.type).toUpperCase();
        if (bType === 'URL') {
          if (!btn.text || String(btn.text).trim() === '') {
            throw new Error(`URL Button at index ${idx} is missing text.`);
          }
          if (!btn.url || String(btn.url).trim() === '') {
            throw new Error(`URL Button at index ${idx} is missing URL.`);
          }
          return {
            type: 'URL',
            text: String(btn.text).trim(),
            url: String(btn.url).trim()
          };
        } else if (bType === 'QUICK_REPLY') {
          if (!btn.text || String(btn.text).trim() === '') {
            throw new Error(`Quick Reply Button at index ${idx} is missing text.`);
          }
          return {
            type: 'QUICK_REPLY',
            text: String(btn.text).trim()
          };
        } else if (bType === 'PHONE_NUMBER') {
          if (!btn.text || String(btn.text).trim() === '') {
            throw new Error(`Phone Button at index ${idx} is missing text.`);
          }
          if (!btn.phone_number || String(btn.phone_number).trim() === '') {
            throw new Error(`Phone Button at index ${idx} is missing phone number.`);
          }
          return {
            type: 'PHONE_NUMBER',
            text: String(btn.text).trim(),
            phone_number: String(btn.phone_number).trim()
          };
        } else {
          throw new Error(`Button type ${bType} is not supported.`);
        }
      });
      cleanComponents.push({
        type: 'BUTTONS',
        buttons: cleanButtons
      });
    }
  }
  return cleanComponents;
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

    // Normalize category & language
    const normalizedCategory = normalizeCategory(category);
    const normalizedLanguage = normalizeLanguage(language);

    // Audit, validate variables, and rebuild components array
    let auditedComponents;
    try {
      auditedComponents = auditAndRebuildComponents(components);
    } catch (auditError) {
      return NextResponse.json(
        { error: auditError.message },
        { status: 400 }
      );
    }

    // Call Meta API to create the template
    const result = await createTemplate({
      name,
      category: normalizedCategory,
      language: normalizedLanguage,
      components: auditedComponents
    });

    // Pre-cache template as PENDING (Meta will update it asynchronously via webhook or sync check)
    const localTemplate = await prisma.whatsAppTemplate.upsert({
      where: { name },
      update: {
        category: normalizedCategory,
        language: normalizedLanguage,
        status: 'PENDING',
        components: auditedComponents || [],
        updatedAt: new Date()
      },
      create: {
        name,
        category: normalizedCategory,
        language: normalizedLanguage,
        status: 'PENDING',
        components: auditedComponents || []
      }
    });

    return NextResponse.json({ success: true, template: localTemplate, metaResult: result });
  } catch (error) {
    console.error('[WhatsApp Templates CRUD] POST Error:', error);
    return NextResponse.json({
      error: error.message,
      code: error.code || null,
      subcode: error.subcode || null,
      fbtrace_id: error.fbtrace_id || null
    }, { status: 400 });
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
