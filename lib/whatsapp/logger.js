/**
 * WhatsApp Database Logging and Settings Subsystem via Prisma ORM
 * Location: lib/whatsapp/logger.js
 */

import prisma from '@/lib/db';
import { formatPhone } from './client';

/**
 * Logs a WhatsApp message transmission.
 */
export async function logMessage(params) {
  if (prisma._isMock) {
    console.log('[WhatsApp Mock Log]', params);
    return true;
  }

  try {
    const phone = params.to_number || params.recipient_phone;
    if (!phone) return false;

    const formatted = formatPhone(phone);
    const status = params.status || 'sent';
    const messageId = params.message_id;
    const templateName = params.template_name;

    let body = params.message_body || null;
    if (!body && params.payload) {
      body = JSON.stringify(params.payload);
    }
    if (!body && params.message_type) {
      body = `Type: ${params.message_type}`;
    }

    let errorMsg = null;
    let errorCode = null;
    if (params.error_details) {
      errorMsg = params.error_details.error || JSON.stringify(params.error_details);
      errorCode = params.error_details.code?.toString() || null;
    }

    // Find customer if exists
    let userId = null;
    try {
      const customer = await prisma.customer.findFirst({
        where: {
          phone: {
            endsWith: formatted.slice(-10)
          }
        }
      });
      if (customer) userId = customer.id;
    } catch (e) {}

    // Create message log using Prisma
    await prisma.whatsAppMessage.create({
      data: {
        direction: 'outbound',
        waMessageId: messageId,
        phoneNumber: formatted,
        userId,
        templateName,
        body,
        status,
        errorCode,
        errorMessage: errorMsg,
        sentAt: new Date(),
      }
    });

    // Update delivery status table
    if (messageId) {
      await prisma.whatsAppDeliveryStatus.upsert({
        where: { messageId },
        update: {
          status,
          errorCode,
          errorText: errorMsg,
          updatedAt: new Date()
        },
        create: {
          messageId,
          phoneNumber: formatted,
          status,
          errorCode,
          errorText: errorMsg
        }
      });
    }

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
  if (prisma._isMock) {
    console.log('[WhatsApp Mock Update]', { messageId, status, errorDetails });
    return true;
  }

  try {
    let errorMsg = null;
    let errorCode = null;
    if (errorDetails) {
      errorCode = errorDetails.code?.toString();
      errorMsg = errorDetails.title || errorDetails.message || JSON.stringify(errorDetails);
    }

    const updateData = {
      status,
      updatedAt: new Date()
    };

    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
    } else if (status === 'read') {
      updateData.readAt = new Date();
    }

    if (errorMsg) {
      updateData.errorMessage = errorMsg;
    }
    if (errorCode) {
      updateData.errorCode = errorCode;
    }

    // Update message log
    await prisma.whatsAppMessage.updateMany({
      where: { waMessageId: messageId },
      data: updateData
    });

    // Update delivery status table
    const deliveryUpdate = {
      status,
      updatedAt: new Date()
    };
    if (status === 'delivered') deliveryUpdate.deliveredAt = new Date();
    if (status === 'read') deliveryUpdate.readAt = new Date();
    if (errorMsg) deliveryUpdate.errorText = errorMsg;
    if (errorCode) deliveryUpdate.errorCode = errorCode;

    await prisma.whatsAppDeliveryStatus.upsert({
      where: { messageId },
      update: deliveryUpdate,
      create: {
        messageId,
        phoneNumber: '', // Will remain empty if not set on creation, but update covers it
        status,
        errorCode,
        errorText: errorMsg,
        deliveredAt: status === 'delivered' ? new Date() : null,
        readAt: status === 'read' ? new Date() : null
      }
    });

    // Retrieve full message to update related campaigns
    const msg = await prisma.whatsAppMessage.findFirst({
      where: { waMessageId: messageId }
    });

    if (msg) {
      // Update campaign metrics if linked
      if (msg.campaignId) {
        const fieldMap = {
          sent: 'statsSent',
          delivered: 'statsDelivered',
          read: 'statsRead',
          failed: 'statsFailed'
        };
        const field = fieldMap[status];
        if (field) {
          await prisma.whatsAppCampaign.update({
            where: { id: msg.campaignId },
            data: { [field]: { increment: 1 } }
          });
        }

        // Also update the WhatsAppCampaignRecipient record
        await prisma.whatsAppCampaignRecipient.updateMany({
          where: {
            campaignId: msg.campaignId,
            phone: msg.phoneNumber
          },
          data: {
            status,
            deliveredAt: status === 'delivered' ? new Date() : undefined,
            readAt: status === 'read' ? new Date() : undefined,
            errorMessage: errorMsg
          }
        });
      }
    }

    return true;
  } catch (error) {
    console.error('[WhatsApp Logger] Failed to update message status:', error);
    return false;
  }
}

/**
 * Retrieves paginated log entries, filtered optionally by template name search.
 */
export async function getLogs({ page = 1, limit = 10, type = '' }) {
  if (prisma._isMock) {
    return { logs: [], totalCount: 0 };
  }

  try {
    const offset = (page - 1) * limit;
    const where = {};
    if (type) {
      where.templateName = { contains: type, mode: 'insensitive' };
    }

    const totalCount = await prisma.whatsAppMessage.count({ where });
    const list = await prisma.whatsAppMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    });

    // Map database models to standard frontend logging format
    const logs = list.map(m => ({
      id: m.id,
      recipient_phone: m.phoneNumber,
      to_number: m.phoneNumber,
      message_type: m.templateName ? 'template' : 'text',
      template_name: m.templateName || 'N/A',
      message_body: m.body,
      message_id: m.waMessageId,
      status: m.status,
      sent_at: m.sentAt || m.createdAt,
      payload: m.errorMessage ? { error: m.errorMessage } : null
    }));

    return { logs, totalCount };
  } catch (error) {
    console.error('[WhatsApp Logger] Failed to fetch logs:', error);
    return { logs: [], totalCount: 0 };
  }
}

/**
 * Gets a WhatsApp configuration toggle/setting value.
 */
export async function getWhatsAppSetting(key, defaultValue = 'true') {
  if (prisma._isMock) {
    return defaultValue;
  }

  try {
    const record = await prisma.whatsAppSetting.findUnique({
      where: { key }
    });
    return record ? record.value : defaultValue;
  } catch (error) {
    console.warn(`[WhatsApp Settings] Failed to read key ${key}:`, error);
    return defaultValue;
  }
}

/**
 * Sets a WhatsApp configuration toggle/setting value.
 */
export async function setWhatsAppSetting(key, value) {
  if (prisma._isMock) {
    return true;
  }

  try {
    await prisma.whatsAppSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) }
    });
    return true;
  } catch (error) {
    console.error(`[WhatsApp Settings] Failed to save key ${key}:`, error);
    return false;
  }
}
