import { NextRequest, NextResponse } from "next/server";
import { getAppAuthFromRequest } from "@/lib/appAuth";
import prisma from "@/lib/prisma";

// Basic keyword extraction for intents and entities (Module 3)
function extractIntents(text: string): string[] {
  const tags: string[] = [];
  const lowerText = text.toLowerCase();
  if (lowerText.includes("size") || lowerText.includes("fit") || lowerText.includes("measure")) tags.push("size_query");
  if (lowerText.includes("recommend") || lowerText.includes("style") || lowerText.includes("outfit") || lowerText.includes("trend")) tags.push("style_recommendation");
  if (lowerText.includes("price") || lowerText.includes("cost")) tags.push("price_query");
  if (lowerText.includes("return") || lowerText.includes("exchange")) tags.push("return_policy");
  return tags;
}

function extractSentiment(text: string): string {
  // Ultra simple naive sentiment
  const positive = ["love", "great", "awesome", "perfect", "thanks", "thank you", "good"];
  const negative = ["bad", "terrible", "hate", "issue", "problem", "wrong", "annoying"];
  
  const lowerText = text.toLowerCase();
  const isPos = positive.some(p => lowerText.includes(p));
  const isNeg = negative.some(p => lowerText.includes(p));
  
  if (isPos && !isNeg) return "positive";
  if (isNeg && !isPos) return "negative";
  return "neutral";
}

// Module 3: GET /api/zica-ai/cache - Retrieve last 10 turns for system prompt injection
export async function GET(req: NextRequest) {
  try {
    const auth = getAppAuthFromRequest(req);
    if (!auth?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let userId = searchParams.get("userId");
    
    // Fallback to auth.userId if the client didn't explicitly pass it or passed empty
    if (!userId) {
      userId = auth.userId;
    }
    
    // Strictly ensure users can only fetch their own data unless admin
    const isAdmin = auth.email?.endsWith('@zicabella.com') || false;
    if (userId !== auth.userId && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized access to user cache" }, { status: 403 });
    }

    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const history = await prisma.zicaAiCache.findMany({
      where: { userId },
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    // Profile fetching for Module 4 injection
    const profile = await prisma.zicaUserProfile.findUnique({
      where: { userId },
    });

    return NextResponse.json({ 
      history: history.reverse(), // return chronological
      profile
    });
  } catch (error) {
    console.error("[Zica AI] Failed to fetch cache:", error);
    return NextResponse.json({ history: [], profile: null }, { status: 200 }); // Silently handle error for client
  }
}

// Module 3: POST /api/zica-ai/cache - Store new turn
export async function POST(req: NextRequest) {
  try {
    const auth = getAppAuthFromRequest(req);
    if (!auth?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, turnIndex, userMessage, aiResponse, detectedProducts, detectedCollections, responseTokens } = body;

    const userId = auth.userId;

    if (!sessionId || turnIndex === undefined || !userMessage || !aiResponse) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Deduplication check: Check if a very similar message exists for this session
    // Simple text match instead of cosine similarity for this implementation
    const recentCache = await prisma.zicaAiCache.findFirst({
      where: {
        sessionId,
        userMessage: { equals: userMessage },
      }
    });

    if (recentCache) {
      return NextResponse.json({ success: true, message: "Skipped duplicate" });
    }

    const truncatedAiResponse = aiResponse.length > 2000 ? aiResponse.substring(0, 2000) : aiResponse;
    const intentTags = extractIntents(userMessage);
    const sentiment = extractSentiment(userMessage);

    const cacheEntry = await prisma.zicaAiCache.create({
      data: {
        userId,
        sessionId,
        turnIndex,
        userMessage,
        aiResponse: truncatedAiResponse,
        detectedProducts: detectedProducts || [],
        detectedCollections: detectedCollections || [],
        intentTags,
        sentiment,
        responseTokens: responseTokens || 0,
      }
    });

    // Module 4: Update User Profile (Async, fire-and-forget logic could be used but we do it quickly here)
    await updateUserProfile(userId, detectedProducts || [], intentTags);

    // Module 4: Run Background Global Insights Aggregation
    // In Next.js App Router, we can just fire this off without awaiting
    runBackgroundAggregation(detectedProducts || [], intentTags).catch(err => {
      console.error("[Zica AI] Background aggregation failed:", err);
    });

    return NextResponse.json({ success: true, id: cacheEntry.id });
  } catch (error) {
    console.error("[Zica AI] Failed to save cache:", error);
    // Silent failure requirement
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 200 });
  }
}

// Module 4: Helper to update user profile
async function updateUserProfile(userId: string, products: string[], intentTags: string[]) {
  try {
    const existing = await prisma.zicaUserProfile.findUnique({ where: { userId } });
    if (!existing) {
      await prisma.zicaUserProfile.create({
        data: {
          userId,
          totalSessions: 1,
          favouriteProducts: products,
          styleTags: intentTags,
        }
      });
    } else {
      // Very basic merge
      const newFavs = [...new Set([...existing.favouriteProducts, ...products])];
      const newStyles = [...new Set([...existing.styleTags, ...intentTags])];
      await prisma.zicaUserProfile.update({
        where: { userId },
        data: {
          totalSessions: existing.totalSessions + 1,
          lastActive: new Date(),
          favouriteProducts: newFavs.slice(0, 20), // keep bound
          styleTags: newStyles.slice(0, 10),
        }
      });
    }
  } catch (err) {
    console.error("[Zica AI] Failed to update user profile:", err);
  }
}

// Module 4: Helper for Global Insights
async function runBackgroundAggregation(products: string[], intentTags: string[]) {
  const updateInsight = async (type: string, key: string) => {
    if (!key) return;
    const existing = await prisma.zicaAiGlobalInsight.findUnique({
      where: { insightType_key: { insightType: type, key } }
    });
    
    if (existing) {
      await prisma.zicaAiGlobalInsight.update({
        where: { id: existing.id },
        data: {
          frequency: existing.frequency + 1,
          lastSeen: new Date(),
          confidenceScore: Math.min(1.0, (existing.frequency + 1) / 100), // simplistic confidence
        }
      });
    } else {
      await prisma.zicaAiGlobalInsight.create({
        data: {
          insightType: type,
          key,
          frequency: 1,
          confidenceScore: 0.01,
        }
      });
    }
  };

  for (const p of products) {
    await updateInsight("popular_product", p);
  }
  for (const i of intentTags) {
    await updateInsight("common_intent", i);
  }
}
