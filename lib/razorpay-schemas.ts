/**
 * Zod validation schemas for all Razorpay API routes.
 * Used server-side only — never import in the React Native app.
 */
import { z } from 'zod';

export const CreateOrderSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3).default('INR'),
  receipt: z.string().max(40).optional(),
  notes: z.record(z.string(), z.string()).optional(),
});

export const VerifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, 'Missing razorpay_order_id'),
  razorpay_payment_id: z.string().min(1, 'Missing razorpay_payment_id'),
  razorpay_signature: z.string().min(1, 'Missing razorpay_signature'),
});

export const CapturePaymentSchema = z.object({
  paymentId: z.string().min(1, 'Missing paymentId'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3).default('INR'),
});

export const RefundSchema = z.object({
  paymentId: z.string().min(1, 'Missing paymentId'),
  amount: z.number().positive().optional(),
  notes: z.record(z.string(), z.string()).optional(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof VerifyPaymentSchema>;
export type CapturePaymentInput = z.infer<typeof CapturePaymentSchema>;
export type RefundInput = z.infer<typeof RefundSchema>;
