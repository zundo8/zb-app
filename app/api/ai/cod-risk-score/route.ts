import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { callClaude } from '@/lib/ai/claudeClient';
import { getFastModel } from '@/lib/ai/models';

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
              select: { status: true, totalPrice: true }
            },
            returns: true
          }
        },
        items: true,
      }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Prepare data for Claude
    const o = order as any;
    const historicalOrders = o.customer?.orders?.length || 0;
    const cancelledOrders = (o.customer?.orders || []).filter((x: any) => x.status === 'cancelled').length;
    const rtoOrders = (o.customer?.orders || []).filter((x: any) => x.status === 'rto').length;
    const returnsCount = o.customer?.returns?.length || 0;
    
    let parsedAddress: any = {};
    if (o.shippingAddress) {
      try {
        parsedAddress = JSON.parse(o.shippingAddress);
      } catch {
        parsedAddress = { raw: o.shippingAddress };
      }
    }
    
    const contextData = {
      orderValue: o.totalAmount || o.totalPrice,
      itemsCount: o.items?.length || 0,
      customerHistory: {
        totalOrders: historicalOrders,
        cancelled: cancelledOrders,
        rto: rtoOrders,
        returns: returnsCount,
        isNewCustomer: historicalOrders <= 1
      },
      shippingCity: parsedAddress.city || parsedAddress.raw || '',
      shippingState: parsedAddress.state || '',
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

    const fastModel = getFastModel();
    const result = await callClaude({
      systemPrompt: 'You are an e-commerce risk analyst. Respond only with valid JSON.',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 500,
      modelChain: [fastModel],
    });

    const aiText = result.response.content[0].type === 'text' ? result.response.content[0].text : '{}';
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
    return NextResponse.json({ error: 'Risk scoring temporarily unavailable' }, { status: 500 });
  }
}
