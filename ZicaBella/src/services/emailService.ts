const ADMIN_API_BASE = 'https://app.zicabella.com/api/email';
const SERVICE_TOKEN = process.env.EXPO_PUBLIC_SERVICE_TOKEN;

export async function triggerEmail(endpoint: string, payload: object) {
  try {
    const response = await fetch(`${ADMIN_API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    
    return await response.json();
  } catch (error) {
    console.error(`Failed to trigger email at ${endpoint}:`, error);
    return { success: false, error };
  }
}

// Convenience methods
export const sendWelcomeEmail = (data: { customerEmail: string; customerName: string; appDownloadUrl?: string }) => 
  triggerEmail('welcome', data);

export const sendPasswordResetEmail = (data: { customerEmail: string; customerName: string; resetUrl: string; expiresIn?: string }) => 
  triggerEmail('password-reset', data);

export const sendReturnUpdateEmail = (data: { customerEmail: string; customerName: string; orderId: string; returnStatus: string; message: string }) => 
  triggerEmail('return-update', data);
