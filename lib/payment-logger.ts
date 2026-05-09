/**
 * Structured payment logger. Never logs sensitive fields.
 * Format is compatible with Vercel / Railway log drains.
 */

type LogLevel = 'info' | 'warn' | 'error';

interface PaymentLogEntry {
  timestamp: string;
  route: string;
  level: LogLevel;
  orderId?: string;
  paymentId?: string;
  status?: string;
  message?: string;
  error?: string;
  ip?: string;
}

export function paymentLog(
  level: LogLevel,
  route: string,
  data: Omit<PaymentLogEntry, 'timestamp' | 'route' | 'level'>,
): void {
  const entry: PaymentLogEntry = {
    timestamp: new Date().toISOString(),
    route,
    level,
    ...data,
  };

  const prefix = `[Payment:${route}]`;

  if (level === 'error') {
    console.error(prefix, JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(prefix, JSON.stringify(entry));
  } else {
    console.log(prefix, JSON.stringify(entry));
  }
}
