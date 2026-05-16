const ZICA_AI_ENDPOINT = "https://app.zicabella.com/api/zica-ai";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function sendZicaAIMessage(
  messages: ChatMessage[]
): Promise<string> {
  const response = await fetch(ZICA_AI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to reach Zica AI");
  }

  const data = await response.json();
  return data.message as string;
}
