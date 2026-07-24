/**
 * Basic Shopify Rich Text (JSON) to HTML Parser.
 */
export function parseShopifyRichText(jsonStr: string | null | undefined): string {
  if (!jsonStr) return "";
  try {
    const data = JSON.parse(jsonStr);
    if (!data || data.type !== 'root') return jsonStr;

    const renderNodes = (nodes: any[]): string => {
      if (!nodes) return "";
      return nodes.map(node => {
        if (node.type === 'text') {
          let text = node.value || "";
          if (node.bold) text = `<strong>${text}</strong>`;
          if (node.italic) text = `<em>${text}</em>`;
          return text;
        }
        if (node.type === 'paragraph') {
          return `<p>${renderNodes(node.children)}</p>`;
        }
        if (node.type === 'list') {
          const tag = node.listType === 'ordered' ? 'ol' : 'ul';
          return `<${tag} class="list-disc pl-4 my-2">${renderNodes(node.children)}</${tag}>`;
        }
        if (node.type === 'list-item') {
          return `<li class="mb-1">${renderNodes(node.children)}</li>`;
        }
        return renderNodes(node.children || []);
      }).join('');
    };

    return renderNodes(data.children);
  } catch (e) {
    return jsonStr;
  }
}

/**
 * Robust helper to match keys.
 */
export function matchKey(key: string, target: string): boolean {
  const normKey = key.toLowerCase().replace(/[\s_-]/g, '');
  const normTarget = target.toLowerCase().replace(/[\s_-]/g, '');
  return normKey === normTarget;
}

/**
 * Extracts a numeric ID from a Shopify GID or returns the string if it's already a number.
 * Example: "gid://shopify/ProductVariant/44585324544212" -> "44585324544212"
 */
export function extractNumericId(id: string | number | null | undefined): string | null {
  if (id === null || id === undefined) return null;
  const s = String(id);
  if (/^\d+$/.test(s)) return s;
  if (s.includes('/')) {
    const parts = s.split('/');
    const last = parts[parts.length - 1];
    if (/^\d+$/.test(last)) return last;
  }
  return s;
}

/**
 * Safely strips HTML tags and decodes common entities to plain text.
 */
export function stripHtmlTags(str: string | null | undefined): string {
  if (!str) return "";
  let text = str;
  // If it's a JSON string, try parsing Shopify Rich Text first
  if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
    text = parseShopifyRichText(text);
  }
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Formats product description content into clean HTML.
 * Handles HTML markup, Shopify Rich Text JSON, or raw plain text with newlines.
 */
export function formatProductDescription(content: string | null | undefined): string {
  if (!content) return "";
  let trimmed = content.trim();
  if (!trimmed) return "";

  // 1. Handle Shopify Rich Text JSON
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const parsed = parseShopifyRichText(trimmed);
    if (parsed !== trimmed) return parsed;
  }

  // 2. If it already contains HTML tags (<p>, <br>, <div>, <ul>, etc.)
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }

  // 3. Plain text: wrap double newlines or single newlines in <p> tags
  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  if (paragraphs.length > 0) {
    return paragraphs
      .map(p => `<p>${p.replace(/\n/g, '<br />')}</p>`)
      .join('');
  }

  return `<p>${trimmed}</p>`;
}

