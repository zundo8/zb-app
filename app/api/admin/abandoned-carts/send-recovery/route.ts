import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendAbandonedCart } from "@/lib/whatsapp/templates";
import { SmsService } from "@/lib/services/sms.service";
import { sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { cartId, channel, subject, messageBody } = await req.json();

    if (!cartId || !channel) {
      return NextResponse.json({ error: "Missing cartId or channel" }, { status: 400 });
    }

    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        customer: true,
        items: true
      }
    });

    if (!cart) {
      return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    }

    const phone = cart.phone || cart.customer?.phone;
    const email = cart.email || cart.customer?.email;
    const name = cart.customer?.name || "Customer";
    const checkoutUrl = `https://zicabella.com/checkout?recover=${cart.id}`;

    if (channel === "whatsapp") {
      if (!phone) return NextResponse.json({ error: "No phone number available for this cart" }, { status: 400 });
      
      const result = await sendAbandonedCart({
        phone,
        customerName: name,
        checkoutUrl
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || "WhatsApp recovery send failed" }, { status: 500 });
      }

      return NextResponse.json({ success: true, channel: "whatsapp" });

    } else if (channel === "sms") {
      if (!phone) return NextResponse.json({ error: "No phone number available for this cart" }, { status: 400 });

      const text = messageBody || `Hi ${name}, you left items in your cart. Complete your purchase here: ${checkoutUrl}`;
      const result = await SmsService.sendSms(phone, text);

      if (!result || !result.sid) {
        return NextResponse.json({ error: "SMS recovery send failed" }, { status: 500 });
      }

      return NextResponse.json({ success: true, channel: "sms" });

    } else if (channel === "email") {
      if (!email) return NextResponse.json({ error: "No email address available for this cart" }, { status: 400 });

      const subjectText = subject || "Complete your Zica Bella purchase";
      const htmlBody = messageBody || `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="font-family: 'Playfair Display', serif; color: #111; text-align: center;">ZICA BELLA</h2>
          <p>Hi ${name},</p>
          <p>You left some beautiful pieces in your shopping bag. Complete your checkout now and make them yours!</p>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${checkoutUrl}" style="background-color: #000; color: #fff; padding: 15px 30px; text-decoration: none; font-size: 13px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; border-radius: 5px; display: inline-block;">
              Complete Purchase
            </a>
          </div>
          
          <p style="font-size: 12px; color: #666; text-align: center; margin-top: 40px; border-t: 1px solid #eee; padding-top: 20px;">
            If you need any support, feel free to contact our team.
          </p>
        </div>
      `;

      await sendMail({
        to: email,
        subject: subjectText,
        html: htmlBody
      });

      return NextResponse.json({ success: true, channel: "email" });

    } else {
      return NextResponse.json({ error: "Unsupported channel type" }, { status: 400 });
    }

  } catch (error: any) {
    console.error("Send recovery message error:", error);
    return NextResponse.json({ error: error.message || "Failed to send recovery message" }, { status: 500 });
  }
}
