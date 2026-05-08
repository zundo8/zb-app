import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Twilio Webhook for Message Status Callbacks
 * 
 * Configured in Twilio Console under Delivery Status Callback URL
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    const messageSid = data.MessageSid as string;
    const messageStatus = data.MessageStatus as string;
    const to = data.To as string;
    const errorCode = data.ErrorCode as string;
    const errorMessage = data.ErrorMessage as string;

    console.log(`[Twilio Webhook] Message ${messageSid} to ${to} status: ${messageStatus}`);

    // If there's an error, log it more prominently
    if (errorCode) {
      console.error(`[Twilio Error] Message ${messageSid} failed with code ${errorCode}: ${errorMessage}`);
    }

    // You could update a table here if you want to track delivery status per message
    // For now, we'll just log it and return 200 OK
    
    // Example: Update SMS Campaign stats if relevant
    // await prisma.smsCampaign.updateMany(...)

    return new NextResponse("OK", { status: 200 });
  } catch (error: any) {
    console.error("Twilio webhook error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
