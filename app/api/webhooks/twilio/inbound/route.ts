import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Twilio Webhook for Incoming Messages (Inbound SMS)
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    const from = data.From as string;
    const body = data.Body as string;
    const messageSid = data.SmsSid as string;

    console.log(`[Twilio Inbound] Message from ${from}: ${body}`);

    // Here you can implement logic to handle user replies
    // e.g., "STOP" to unsubscribe, or "YES" to confirm an order.
    
    // For now, we'll just log it. 
    // If you want to reply back via TwiML:
    // return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>Thank you for contacting Zica Bella.</Message></Response>`, {
    //   headers: { "Content-Type": "application/xml" }
    // });

    return new NextResponse("OK", { status: 200 });
  } catch (error: any) {
    console.error("Twilio inbound webhook error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
