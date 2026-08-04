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

    // 2. Sync to local database cache (whatsapp_templates) if DB is active
    if (metaTemplates && Array.isArray(metaTemplates) && metaTemplates.length > 0) {
      try {
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
          }).catch(() => {});
        }

        const metaNames = metaTemplates.map(t => t.name);
        await prisma.whatsAppTemplate.deleteMany({
          where: {
            name: { notIn: metaNames }
          }
        }).catch(() => {});
      } catch (dbErr) {
        console.warn('[WhatsApp Templates] Database cache sync warning:', dbErr.message);
      }

      // Return live Meta templates directly to guarantee UI displays templates cleanly
      return NextResponse.json({ templates: metaTemplates });
    }

    // 3. Fallback to database query if Meta API returns empty
    const dbTemplates = await prisma.whatsAppTemplate.findMany({
      orderBy: { name: 'asc' }
    }).catch(() => []);

    return NextResponse.json({ templates: dbTemplates || [] });
  } catch (error) {
    console.error('[WhatsApp Templates CRUD] GET Error:', error);
    const cleanMsg = String(error.message || '').includes('ECIRCUITBREAKER') || String(error.message || '').includes('AUTHENTICATION FAILURES')
      ? 'WhatsApp template service temporarily updating, please retry.'
      : (error.message || 'Failed to fetch WhatsApp templates');
    return NextResponse.json({ error: cleanMsg }, { status: 500 });
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
    if (!/^[a-zA-Z0-9_]+$/.test(inner)) {
      throw new Error(`Invalid variable placeholder: ${brace}. Placeholders must contain alphanumeric characters or underscores.`);
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
        // Check for variables in header text
        const headerVars = headerComp.text.match(/\{\{\d+\}\}/g) || [];
        if (headerVars.length > 0) {
          headerComp.example = comp.example || {
            header_text: headerVars.map((_, i) => `Example ${i + 1}`)
          };
        }
      } else if (format === 'IMAGE' || format === 'VIDEO' || format === 'DOCUMENT') {
        // Media headers require example with header_handle or header_url for Meta approval
        if (comp.example?.header_handle) {
          headerComp.example = { header_handle: comp.example.header_handle };
        } else if (comp.example?.header_url) {
          headerComp.example = { header_url: comp.example.header_url };
        } else {
          const defaultUrls = {
            IMAGE: ['https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=400&auto=format&fit=crop'],
            VIDEO: ['https://www.w3schools.com/html/mov_bbb.mp4'],
            DOCUMENT: ['https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf']
          };
          headerComp.example = { header_url: defaultUrls[format] };
        }
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
      const footerText = String(comp.text).trim();
      if (footerText.length > 60) {
        throw new Error('FOOTER text must be 60 characters or fewer.');
      }
      cleanComponents.push({
        type: 'FOOTER',
        text: footerText
      });
    } else if (type === 'BUTTONS') {
      if (!Array.isArray(comp.buttons) || comp.buttons.length === 0) {
        throw new Error('BUTTONS component must contain at least one button.');
      }
      if (comp.buttons.length > 10) {
        throw new Error('BUTTONS component can have a maximum of 10 buttons.');
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
          const urlBtn = {
            type: 'URL',
            text: String(btn.text).trim(),
            url: String(btn.url).trim()
          };
          // Add URL example if URL contains dynamic suffix {{1}}
          if (urlBtn.url.includes('{{1}}')) {
            urlBtn.example = btn.example || ['example-path'];
          }
          return urlBtn;
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
        } else if (bType === 'COPY_CODE') {
          if (!btn.example) {
            throw new Error(`Copy Code Button at index ${idx} requires an example code.`);
          }
          return {
            type: 'COPY_CODE',
            example: String(btn.example).trim()
          };
        } else if (bType === 'CATALOG') {
          return {
            type: 'CATALOG'
          };
        } else {
          throw new Error(`Button type ${bType} is not supported. Allowed: URL, QUICK_REPLY, PHONE_NUMBER, COPY_CODE, CATALOG.`);
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
