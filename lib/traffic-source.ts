/**
 * Client-side utility to detect and categorize traffic source / conversion place
 * based on UTM parameters, ref parameters, or document.referrer.
 */
export function getTrafficSource(): string {
  if (typeof window === "undefined") return "webstore";

  // 1. Check if we already cached it in sessionStorage for this session
  try {
    const cached = sessionStorage.getItem("zb_traffic_source");
    if (cached) return cached;
  } catch (e) {}

  // 2. Check UTM parameters or ref
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get("utm_source")?.toLowerCase();
    const ref = urlParams.get("ref")?.toLowerCase();
    const sourceParam = utmSource || ref;

    if (sourceParam) {
      let mappedSource = "webstore";
      if (sourceParam.includes("instagram")) mappedSource = "Instagram";
      else if (sourceParam.includes("facebook") || sourceParam.includes("fb")) mappedSource = "Facebook";
      else if (sourceParam.includes("google") || sourceParam.includes("gclid")) mappedSource = "Google Search";
      else if (sourceParam.includes("snapchat")) mappedSource = "Snapchat";
      else if (sourceParam.includes("tiktok")) mappedSource = "TikTok";
      else if (sourceParam.includes("perplexity")) mappedSource = "Perplexity AI";
      else if (sourceParam.includes("gemini")) mappedSource = "Gemini AI";
      else if (sourceParam.includes("chatgpt") || sourceParam.includes("openai")) mappedSource = "ChatGPT";
      else if (sourceParam.includes("whatsapp")) mappedSource = "WhatsApp";
      else mappedSource = sourceParam.toUpperCase();

      try {
        sessionStorage.setItem("zb_traffic_source", mappedSource);
      } catch (e) {}
      return mappedSource;
    }
  } catch (e) {}

  // 3. Fallback to document.referrer
  try {
    const referrer = document.referrer?.toLowerCase() || "";
    if (referrer) {
      let mappedSource = "webstore";
      if (referrer.includes("instagram.com")) mappedSource = "Instagram";
      else if (referrer.includes("facebook.com")) mappedSource = "Facebook";
      else if (referrer.includes("google.com")) mappedSource = "Google Search";
      else if (referrer.includes("snapchat.com")) mappedSource = "Snapchat";
      else if (referrer.includes("t.co") || referrer.includes("twitter.com") || referrer.includes("x.com")) mappedSource = "Twitter/X";
      else if (referrer.includes("tiktok.com")) mappedSource = "TikTok";
      else if (referrer.includes("perplexity.ai")) mappedSource = "Perplexity AI";
      else if (referrer.includes("google.com/search") || referrer.includes("bing.com")) mappedSource = "Search Engine";
      else if (referrer.includes("android-app://com.google.android.googlequicksearchbox")) mappedSource = "Google App";
      else if (referrer.includes("whatsapp.com")) mappedSource = "WhatsApp";
      
      if (mappedSource !== "webstore") {
        try {
          sessionStorage.setItem("zb_traffic_source", mappedSource);
        } catch (e) {}
        return mappedSource;
      }
    }
  } catch (e) {}

  return "webstore";
}
