import { NextRequest, NextResponse } from 'next/server';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';

export const dynamic = 'force-dynamic';

// Simple in-memory cache to prevent hammering IMAP server
let inboxCache: { data: any[]; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 60 seconds

function hasAttachments(struct: any): boolean {
  if (Array.isArray(struct)) {
    return struct.some(part => hasAttachments(part));
  }
  if (struct && typeof struct === 'object') {
    if (struct.disposition && struct.disposition.type && struct.disposition.type.toLowerCase() === 'attachment') {
      return true;
    }
    if (struct.parts) {
      return hasAttachments(struct.parts);
    }
  }
  return false;
}

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    if (inboxCache && now - inboxCache.timestamp < CACHE_TTL) {
      console.log('[IMAP Inbox] Returning cached inbox list');
      return NextResponse.json({ success: true, emails: inboxCache.data });
    }

    const user = process.env.ZOHO_SMTP_USER || 'admin@zicabella.com';
    const password = process.env.ZOHO_SMTP_PASS || 'L6YHDRkF1zti';
    const host = process.env.ZOHO_IMAP_HOST || 'imap.zoho.in';
    const port = Number(process.env.ZOHO_IMAP_PORT || '993');

    if (!user || !password) {
      return NextResponse.json(
        { success: false, error: 'IMAP credentials are not configured in environment variables' },
        { status: 500 }
      );
    }

    const config = {
      imap: {
        user,
        password,
        host,
        port,
        tls: true,
        authTimeout: 10000,
      },
    };

    console.log(`[IMAP Inbox] Connecting to ${host}:${port}...`);
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    // Search for all messages. We'll slice the latest 50.
    const searchCriteria = ['ALL'];
    const fetchOptions = {
      bodies: ['HEADER', ''],
      struct: true,
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    const total = messages.length;
    console.log(`[IMAP Inbox] Connected. Total messages in inbox: ${total}`);

    // Take the last 50 messages, newest first
    const startIdx = Math.max(0, total - 50);
    const latestMessages = messages.slice(startIdx).reverse();

    const parsedEmails = await Promise.all(
      latestMessages.map(async (msg) => {
        const id = msg.attributes.uid;
        const isRead = msg.attributes.flags.includes('\\Seen');
        const date = msg.attributes.date;
        const struct = msg.attributes.struct;
        const hasAttachment = struct ? hasAttachments(struct) : false;

        const allPart = msg.parts.find((part) => part.which === '');
        if (allPart && allPart.body) {
          try {
            const parsed = await simpleParser(allPart.body);
            const from = parsed.from?.text || parsed.headers.get('from')?.toString() || 'Unknown';
            const subject = parsed.subject || '(No Subject)';
            const textBody = parsed.text || '';
            const preview = textBody.substring(0, 150).replace(/\s+/g, ' ').trim() || '(No content preview)';

            return {
              id: id.toString(),
              from,
              subject,
              date: date ? date.toISOString() : new Date().toISOString(),
              preview,
              isRead,
              hasAttachment,
            };
          } catch (parseErr) {
            console.error(`[IMAP Inbox] Failed to parse message body for UID ${id}:`, parseErr);
          }
        }

        // Fallback if raw parsing failed
        const headerPart = msg.parts.find((part) => part.which === 'HEADER');
        const subject = headerPart?.body?.subject?.[0] || '(No Subject)';
        const from = headerPart?.body?.from?.[0] || 'Unknown';

        return {
          id: id.toString(),
          from,
          subject,
          date: date ? date.toISOString() : new Date().toISOString(),
          preview: '(Raw email failed to parse)',
          isRead,
          hasAttachment,
        };
      })
    );

    // Close IMAP connection
    connection.end();

    // Cache the result
    inboxCache = {
      data: parsedEmails,
      timestamp: now,
    };

    return NextResponse.json({ success: true, emails: parsedEmails });
  } catch (error: any) {
    console.error('[IMAP Inbox Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to connect or fetch emails' },
      { status: 500 }
    );
  }
}
