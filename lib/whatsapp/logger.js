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
    // 1. Create logs table if not exists
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS whatsapp_message_log (
        id SERIAL PRIMARY KEY,
        recipient_phone VARCHAR(50) NOT NULL,
        message_type VARCHAR(100) NOT NULL,
        template_name VARCHAR(255) NOT NULL,
        message_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'sent',
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        payload JSONB
      );
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
 * Logs a WhatsApp message transmission.
 */
export async function logMessage({
  recipient_phone,
  message_type,
  template_name,
  message_id = null,
  status = 'sent',
  payload = {}
}) {
  await ensureTablesExist();

  if (prisma._isMock) {
    console.log('[WhatsApp Mock Log]', { recipient_phone, message_type, template_name, message_id, status, payload });
    return true;
  }

  try {
    const payloadStr = JSON.stringify(payload || {});
    await prisma.$executeRaw`
      INSERT INTO whatsapp_message_log (recipient_phone, message_type, template_name, message_id, status, payload)
      VALUES (${recipient_phone}, ${message_type}, ${template_name}, ${message_id}, ${status}, CAST(${payloadStr} AS jsonb))
    `;
    return true;
  } catch (error) {
    console.error('[WhatsApp Logger] Failed to log message:', error);
    return false;
  }
}

/**
 * Retrieves paginated log entries, filtered optionally by type.
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
      logs = await prisma.$queryRaw`
        SELECT id, recipient_phone, message_type, template_name, message_id, status, sent_at, payload
        FROM whatsapp_message_log
        WHERE message_type = ${type}
        ORDER BY sent_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const countResult: any = await prisma.$queryRaw`
        SELECT COUNT(*)::integer as count FROM whatsapp_message_log WHERE message_type = ${type}
      `;
      totalCount = countResult[0]?.count || 0;
    } else {
      logs = await prisma.$queryRaw`
        SELECT id, recipient_phone, message_type, template_name, message_id, status, sent_at, payload
        FROM whatsapp_message_log
        ORDER BY sent_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const countResult: any = await prisma.$queryRaw`
        SELECT COUNT(*)::integer as count FROM whatsapp_message_log
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
    const result: any = await prisma.$queryRaw`
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
