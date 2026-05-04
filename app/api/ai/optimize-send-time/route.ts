import { NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import db from '@/lib/db';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { segment, channel } = await req.json();

    if (!segment || !channel) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // In a production scenario, you would fetch aggregated historical engagement data
    // for this segment from the CampaignAnalyticsEvent table.
    // For now, we'll simulate the data aggregation.
    
    const mockHistoricalData = {
      segmentSize: 15000,
      engagementByHour: {
        "08:00": 5, "09:00": 12, "10:00": 18, "11:00": 15,
        "12:00": 22, "13:00": 25, "14:00": 19, "15:00": 14,
        "16:00": 16, "17:00": 28, "18:00": 35, "19:00": 42,
        "20:00": 38, "21:00": 25, "22:00": 12, "23:00": 4
      },
      preferredDays: ["Thursday", "Friday", "Sunday"]
    };

    const prompt = `
      You are an expert marketing data analyst for Zica Bella.
      Analyze the following historical engagement data for the "${segment}" segment on the "${channel}" channel.
      
      Historical Data:
      ${JSON.stringify(mockHistoricalData, null, 2)}
      
      Determine the absolute best day of the week and time of day to send the next campaign to maximize open rates and conversions.
      
      Respond ONLY with a valid JSON object matching this schema:
      {
        "recommendedDay": "<Day of week>",
        "recommendedTime": "<HH:MM in 24hr format>",
        "reasoning": "<Short 1-sentence explanation of why this time is best based on the data>"
      }
    `;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 300,
      temperature: 0.1,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const aiText = response.content[0].type === 'text' ? response.content[0].text : '{}';
    let recommendation;
    
    try {
      const jsonStr = aiText.substring(aiText.indexOf('{'), aiText.lastIndexOf('}') + 1);
      recommendation = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse Claude JSON', aiText);
      throw new Error('AI produced invalid JSON');
    }

    return NextResponse.json({ success: true, recommendation });

  } catch (error: any) {
    console.error('AI send time optimization error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
