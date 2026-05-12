import { NextRequest, NextResponse } from 'next/server';
import { transporter } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  try {
    // Verify transporter configuration
    await transporter.verify();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Zoho Mail SMTP Connection Successful' 
    });
  } catch (error: any) {
    console.error('SMTP Verification Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
