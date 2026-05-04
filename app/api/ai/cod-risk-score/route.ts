import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { 
        customer: {
          include: {
            orders: {
              select: { status: true, totalAmount: true }
            },
            returns: true
          }
        },
        items: true,
        shippingAddress: true,
      }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Prepare data for Claude
    const historicalOrders = order.customer.orders.length;
    const cancelledOrders = order.customer.orders.filter(o => o.status === 'cancelled').length;
    const rtoOrders = order.customer.orders.filter(o => o.status === 'rto').length;
    const returnsCount = order.customer.returns.length;
    
    const contextData = {
      orderValue: order.totalAmount,
      itemsCount: order.items.length,
      customerHistory: {
        totalOrders: historicalOrders,
        cancelled: cancelledOrders,
        rto: rtoOrders,
        returns: returnsCount,
        isNewCustomer: historicalOrders <= 1
      },
      shippingCity: order.shippingAddress?.city,
      shippingState: order.shippingAddress?.state,
    };

    const prompt = `
      You are an expert e-commerce fraud and risk analyst for Zica Bella, a premium fashion brand.
      Analyze the following Cash on Delivery (COD) order data and provide a risk assessment for Return to Origin (RTO).
      
      Order Data:
      ${JSON.stringify(contextData, null, 2)}
      
      Respond ONLY with a valid JSON object matching this schema:
      {
        "riskScore": <number from 0 to 100, where 100 is highest risk>,
        "riskFactors": [<array of strings describing key risk indicators>],
        "recommendation": "<string: 'approve', 'manual_review', or 'require_prepaid'>"
      }
    `;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      temperature: 0.1, // Low temperature for consistent JSON
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const aiText = response.content[0].type === 'text' ? response.content[0].text : '{}';
    let riskData;
    
    try {
      // Find JSON block in text if Claude wrapped it
      const jsonStr = aiText.substring(aiText.indexOf('{'), aiText.lastIndexOf('}') + 1);
      riskData = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse Claude JSON', aiText);
      throw new Error('AI produced invalid JSON');
    }

    // Save risk score to order
    await db.order.update({
      where: { id: order.id },
      data: {
        rtoRiskScore: riskData.riskScore,
        rtoRiskFactors: JSON.stringify(riskData.riskFactors),
        aiRiskRecommendation: riskData.recommendation
      }
    });

    return NextResponse.json({ success: true, riskData });

  } catch (error: any) {
    console.error('Risk scoring error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
