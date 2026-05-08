import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { SmsService } from "@/lib/services/sms.service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiry to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Save to DB
    await prisma.verificationCode.create({
      data: {
        phone,
        code: otp,
        expiresAt
      }
    });

    // Send via SMS
    try {
      const message = `Your Zica Bella verification code is: ${otp}. Valid for 10 minutes.`;
      await SmsService.sendSms(phone, message);
    } catch (smsError) {
      console.error("Failed to send SMS:", smsError);
      // In development, we might want to return the OTP if SMS fails (optional)
      // return NextResponse.json({ otp, warning: "SMS delivery failed" });
      return NextResponse.json({ error: "Failed to send verification code. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "OTP sent successfully" });
  } catch (error: any) {
    console.error("Send OTP error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
