import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Emergency Sync Route to update Twilio Credentials in DB from Environment Variables
 */
export async function GET(req: Request) {
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const phone = process.env.TWILIO_PHONE_NUMBER;

    if (!sid || !token) {
      return NextResponse.json({ 
        error: "TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not found in environment variables.",
        tip: "Ensure these are set in .env.local or Vercel Environment Variables."
      }, { status: 400 });
    }

    const shop = await prisma.shop.findFirst();
    if (!shop) {
      return NextResponse.json({ error: "No shop record found in database." }, { status: 404 });
    }

    const updatedShop = await prisma.shop.update({
      where: { id: shop.id },
      data: {
        twilioAccountSid: sid,
        twilioAuthToken: token,
        twilioPhoneNumber: phone || shop.twilioPhoneNumber
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: "Twilio credentials synced from ENV to DB successfully.",
      shop: updatedShop.domain
    });
  } catch (error: any) {
    console.error("Sync Twilio error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
