import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { SmsService } from "@/lib/services/sms.service";

export const dynamic = "force-dynamic";

// Simple in-memory rate limiter (per phone number, resets on server restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_REQUESTS = 5; // Max 5 OTP requests per phone per 10 mins

function checkRateLimit(phone: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(phone);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(phone, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_OTP_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    // Normalize the phone number
    const normalizedPhone = phone.trim().replace(/[\s\-\(\)]/g, '');
    const digits = normalizedPhone.replace(/\D/g, '');
    
    if (digits.length < 10) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    // Rate limit check
    if (!checkRateLimit(digits.slice(-10))) {
      return NextResponse.json(
        { error: "Too many OTP requests. Please try again in a few minutes." }, 
        { status: 429 }
      );
    }

    // Special case: Demo User Bypass
    if (digits.slice(-10) === '9999999999') {
      return NextResponse.json({ 
        success: true, 
        message: "OTP sent successfully (Demo Mode)",
        provider: "demo",
        phone: "+91******9999"
      });
    }

    // 1. Try Twilio Verify first
    try {
      const verifyResult = await SmsService.sendVerification(normalizedPhone);
      if (verifyResult) {
        return NextResponse.json({ 
          success: true, 
          message: "Verification code sent via Twilio Verify",
          provider: "verify",
          phone: normalizedPhone.slice(0, 4) + "****" + normalizedPhone.slice(-4)
        });
      }
    } catch (verifyError: any) {
      console.error("Twilio Verify send failed, falling back to manual SMS:", verifyError.message);
    }

    // 2. Fallback to manual SMS if Verify is not available or failed
    // Generate cryptographically-influenced 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiry to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Clean up old expired codes for this phone to prevent DB bloat
    await prisma.verificationCode.deleteMany({
      where: {
        phone: { contains: digits.slice(-10) },
        expiresAt: { lt: new Date() }
      }
    }).catch(() => {}); // Non-critical — don't block OTP send

    // Save to DB
    await prisma.verificationCode.create({
      data: {
        phone: normalizedPhone,
        code: otp,
        expiresAt
      }
    });

    // Send via SMS
    try {
      const message = `Your Zica Bella verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
      await SmsService.sendSms(normalizedPhone, message);
    } catch (smsError: any) {
      console.error("Failed to send SMS:", smsError);
      // Clean up the OTP since we couldn't send it
      await prisma.verificationCode.deleteMany({
        where: { phone: normalizedPhone, code: otp }
      }).catch(() => {});
      
      return NextResponse.json(
        { error: "Failed to send verification code. Please check your phone number and try again." }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: "OTP sent successfully",
      provider: "sms",
      // Mask the phone number in the response
      phone: normalizedPhone.slice(0, 4) + "****" + normalizedPhone.slice(-4)
    });
  } catch (error: any) {
    console.error("Send OTP error:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
