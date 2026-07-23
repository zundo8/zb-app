import { NextResponse } from 'next/server';
import { callClaude } from '@/lib/ai/claudeClient';
import { getFastModel } from '@/lib/ai/models';

export async function POST(req: Request) {
  try {
    const { productContext, campaignGoal, channel, tone = 'premium, urgent' } = await req.json();

    if (!campaignGoal || !channel) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const channelGuidelines = {
      email: 'Write an attention-grabbing subject line, a short preview text, and 2 paragraphs of highly converting HTML body copy.',
      whatsapp: 'Write a short, engaging message under 300 characters. Use emojis sparingly but effectively. Format with *bold* for emphasis.',
      sms: 'Write a strict maximum of 160 characters. Must include a clear call to action and a placeholder for a URL [URL].',
      push: 'Write a catchy title (max 40 chars) and a compelling body (max 100 chars).'
    };

    const prompt = `
      You are an expert copywriter for Zica Bella, a premium fashion brand known for "Apple Liquid Glass" aesthetics and high-end archival quality.
      
      Generate copy for a marketing campaign.
      Channel: ${channel}
      Goal: ${campaignGoal}
      Tone: ${tone}
      Context/Products: ${JSON.stringify(productContext || {})}
      
      Guidelines for this channel:
      ${channelGuidelines[channel as keyof typeof channelGuidelines] || 'Be engaging.'}
      
      Respond ONLY with a JSON object. Do not include any conversational text.
      For Email: { "subject": "...", "preview": "...", "bodyHtml": "..." }
      For WhatsApp/SMS: { "messageBody": "..." }
      For Push: { "title": "...", "body": "..." }
    `;

    const fastModel = getFastModel();
    const result = await callClaude({
      systemPrompt: 'You are an expert copywriter. Respond only with valid JSON.',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 500,
      modelChain: [fastModel],
    });

    const aiText = result.response.content[0].type === 'text' ? result.response.content[0].text : '{}';
    let content;
    
    try {
      const jsonStr = aiText.substring(aiText.indexOf('{'), aiText.lastIndexOf('}') + 1);
      content = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse Claude JSON', aiText);
      throw new Error('AI produced invalid JSON');
    }

    return NextResponse.json({ success: true, content });

  } catch (error: any) {
    console.error('AI content generation error:', error);
    return NextResponse.json({ error: 'Failed to generate campaign content' }, { status: 500 });
  }
}
