/**
 * WhatsApp Database Logging and Settings Subsystem
 * Location: lib/whatsapp/logger.js
 */

import prisma from '@/lib/db';

/**
 * Ensures the whatsapp_message_log and whatsapp_settings tables exist in the database.
 * This runs dynamically to prevent schema locks or migration issues in development and build time.
 */
async function ensureTablesExist() {
  // If the database client is a mock client, skip database creation
  if (prisma._isMock) {
    return;
  }

  try {
    // 1. Create logs table if not exists (using UUID and matching Step 3 spec)
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        to_number TEXT NOT NULL,
        from_number TEXT DEFAULT '+918130773789',
        template_name TEXT,
        message_body TEXT,
        status TEXT DEFAULT 'sent',
        message_id TEXT UNIQUE,
        error_details JSONB,
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Create index for performance
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS whatsapp_message_logs_sent_at_idx ON whatsapp_message_logs (sent_at DESC);
    `;

    // 2. Create settings table if not exists
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS whatsapp_settings (
        key VARCHAR(255) PRIMARY KEY,
        value VARCHAR(255) NOT NULL
      );
    `;
  } catch (error) {
    console.error('[WhatsApp Logger] Failed to verify/create database tables:', error);
  }
}

/**
 * Logs a WhatsApp message transmission. Supports both old and new signatures.
 */
export async function logMessage(params) {
  await ensureTablesExist();

  if (prisma._isMock) {
    console.log('[WhatsApp Mock Log]', params);
    return true;
  }

  try {
    const to_number = params.to_number || params.recipient_phone;
    const from_number = params.from_number || '+918130773789';
    const template_name = params.template_name;
    const status = params.status || 'sent';
    const message_id = params.message_id;

    let message_body = params.message_body || null;
    if (!message_body && params.payload) {
      message_body = JSON.stringify(params.payload);
    }
    if (!message_body && params.message_type) {
      message_body = `Type: ${params.message_type}`;
    }

    let error_details = params.error_details || null;
    if (!error_details && params.payload?.error) {
      error_details = { error: params.payload.error };
    }
    const errorDetailsStr = error_details ? JSON.stringify(error_details) : null;

    await prisma.$executeRaw`
      INSERT INTO whatsapp_message_logs (to_number, from_number, template_name, message_body, status, message_id, error_details)
      VALUES (${to_number}, ${from_number}, ${template_name}, ${message_body}, ${status}, ${message_id}, ${errorDetailsStr}::jsonb)
    `;
    return true;
  } catch (error) {
    console.error('[WhatsApp Logger] Failed to log message:', error);
    return false;
  }
}

/**
 * Updates status of a WhatsApp message from a webhook callback.
 */
export async function updateMessageStatus(messageId, status, errorDetails = null) {
  await ensureTablesExist();

  if (prisma._isMock) {
    console.log('[WhatsApp Mock Update]', { messageId, status, errorDetails });
    return true;
  }

  try {
    const errorDetailsStr = errorDetails ? JSON.stringify(errorDetails) : null;
    await prisma.$executeRaw`
      UPDATE whatsapp_message_logs
      SET status = ${status},
          error_details = COALESCE(${errorDetailsStr}::jsonb, error_details),
          updated_at = NOW()
      WHERE message_id = ${messageId}
    `;
    return true;
  } catch (error) {
    console.error('[WhatsApp Logger] Failed to update message status:', error);
    return false;
  }
}

/**
 * Retrieves paginated log entries, filtered optionally by type/template.
 */
export async function getLogs({ page = 1, limit = 10, type = '' }) {
  await ensureTablesExist();

  if (prisma._isMock) {
    return { logs: [], totalCount: 0 };
  }

  try {
    const offset = (page - 1) * limit;
    let logs;
    let totalCount = 0;

    if (type) {
      const filter = `%${type}%`;
      logs = await prisma.$queryRaw`
        SELECT 
          id, 
          to_number as recipient_phone, 
          to_number,
          from_number,
          template_name, 
          message_body,
          message_id, 
          status, 
          sent_at, 
          error_details as payload
        FROM whatsapp_message_logs
        WHERE template_name LIKE ${filter}
        ORDER BY sent_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const countResult = await prisma.$queryRaw`
        SELECT COUNT(*)::integer as count 
        FROM whatsapp_message_logs 
        WHERE template_name LIKE ${filter}
      `;
      totalCount = countResult[0]?.count || 0;
    } else {
      logs = await prisma.$queryRaw`
        SELECT 
          id, 
          to_number as recipient_phone, 
          to_number,
          from_number,
          template_name, 
          message_body,
          message_id, 
          status, 
          sent_at, 
          error_details as payload
        FROM whatsapp_message_logs
        ORDER BY sent_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const countResult = await prisma.$queryRaw`
        SELECT COUNT(*)::integer as count 
        FROM whatsapp_message_logs
      `;
      totalCount = countResult[0]?.count || 0;
    }

    return { logs, totalCount };
  } catch (error) {
    console.error('[WhatsApp Logger] Failed to fetch logs:', error);
    return { logs: [], totalCount: 0 };
  }
}

/**
 * Gets a WhatsApp configuration toggle value.
 */
export async function getWhatsAppSetting(key, defaultValue = 'true') {
  await ensureTablesExist();

  if (prisma._isMock) {
    return defaultValue;
  }

  try {
    const result = await prisma.$queryRaw`
      SELECT value FROM whatsapp_settings WHERE key = ${key}
    `;
    if (result && result.length > 0) {
      return result[0].value;
    }
  } catch (error) {
    console.warn(`[WhatsApp Settings] Failed to read key ${key}:`, error);
  }
  return defaultValue;
}

/**
 * Sets a WhatsApp configuration toggle value.
 */
export async function setWhatsAppSetting(key, value) {
  await ensureTablesExist();

  if (prisma._isMock) {
    return true;
  }

  try {
    const valueStr = String(value);
    await prisma.$executeRaw`
      INSERT INTO whatsapp_settings (key, value) 
      VALUES (${key}, ${valueStr})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
    return true;
  } catch (error) {
    console.error(`[WhatsApp Settings] Failed to save key ${key}:`, error);
    return false;
  }
}
