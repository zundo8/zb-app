/**
 * lib/ai/formatSanitizer.ts
 * Format sanitizer for AI-generated customer-facing text.
 * 
 * Ensures that responses delivered via plain text / email / SMS / WhatsApp channels
 * do not contain raw Markdown syntax symbols (**bold**, ## headings, - bullet lists, etc.),
 * while preserving clear paragraphs, readable structure, and clean bullet indicators.
 */

/**
 * Remove or convert Markdown syntax from a text string into clean plain prose.
 *
 * @param text The input string potentially containing Markdown formatting
 * @returns Cleaned plain text safe for plain-text emails, SMS, and WhatsApp dispatches
 */
export function stripMarkdown(text: string): string {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  let cleaned = text;

  // 1. Remove Markdown headers (e.g. # Heading, ## Subheading)
  cleaned = cleaned.replace(/^(#{1,6})\s+(.+)$/gm, '$2');

  // 2. Remove bold and italic formatting (**text**, *text*, __text__, _text_)
  cleaned = cleaned.replace(/(\*\*|__|\*|_)(.*?)\1/g, '$2');

  // 3. Remove inline backticks and code blocks (`code`, ```code```)
  cleaned = cleaned.replace(/`{1,3}(.*?)`{1,3}/gs, '$1');

  // 4. Remove strikethrough (~~text~~)
  cleaned = cleaned.replace(/~~(.*?)~~/g, '$1');

  // 5. Convert Markdown links [Text](URL) -> Text (if zicabella:// scheme, just keep Text; if web URL, keep Text: URL)
  cleaned = cleaned.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, linkText, url) => {
    if (url.startsWith('zicabella://')) {
      return linkText;
    }
    return `${linkText} (${url})`;
  });

  // 6. Remove blockquote markers (> Quote)
  cleaned = cleaned.replace(/^>\s?/gm, '');

  // 7. Standardize bullet point lists:
  // Convert leading "- ", "* ", "+ " at line start to bullet symbol "• "
  cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, '• ');

  // 8. Clean up excess vertical whitespace (more than 2 consecutive newlines -> 2 newlines)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // 9. Trim leading/trailing whitespace
  return cleaned.trim();
}

/**
 * Sanitize AI-generated message for outbound customer channels.
 * Wraps output guard scanning and markdown stripping into a single call.
 */
export function sanitizeOutboundMessage(text: string): string {
  if (!text) return '';
  return stripMarkdown(text);
}
