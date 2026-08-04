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

/**
 * Formats a date string or Date object to an exact, human-readable date AND time.
 * Example: "Aug 04, 2026 at 04:35:02 AM" or "04 Aug 2026, 04:35 AM"
 */
export function formatExactDateTime(dateInput: string | Date | null | undefined, includeSeconds = false): string {
  if (!dateInput) return "N/A";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "N/A";

  const options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  };

  if (includeSeconds) {
    options.second = "2-digit";
  }

  return date.toLocaleString("en-IN", options);
}

/**
 * Robustly extracts size and variant information from product titles, SKUs, and variant properties.
 */
export function extractItemVariantAndSize(
  title?: string | null,
  sku?: string | null,
  variantTitle?: string | null,
  explicitSize?: string | null
): { size: string | null; variant: string | null; formattedLabel: string | null } {
  let size: string | null = explicitSize ? explicitSize.trim().toUpperCase() : null;
  let variant: string | null = null;

  const validSizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', 'XXL', 'XXXL', '26', '28', '30', '32', '34', '36', '38', '40', '42'];

  // 1. Explicit variant title provided (e.g. "Size: M", "32", "XL", "Black / L")
  if (!size && variantTitle && variantTitle !== "Default Title" && variantTitle !== "Default") {
    variant = variantTitle.trim();
    const vMatch = variant.match(/(?:Size:\s*|\b)(XS|S|M|L|XL|2XL|3XL|4XL|XXL|XXXL|26|28|30|32|34|36|38|40|42)(?:\b|$)/i);
    if (vMatch) {
      size = vMatch[1].toUpperCase();
    }
  }

  // 2. Extract size from product title (e.g. "OFFSET RUSTFORM UTILITY DENIM - 32" or "Double Loopback Hoodie (Size: M)")
  if (!size && title) {
    const titleMatch = title.match(/(?:-\s*|\/\s*|Size:\s*|Size\s+|\(\s*)(XS|S|M|L|XL|2XL|3XL|4XL|XXL|XXXL|26|28|30|32|34|36|38|40|42)(?:\s*\)|\b|$)/i);
    if (titleMatch) {
      size = titleMatch[1].toUpperCase();
    }
  }

  // 3. Extract size from SKU (e.g. "ZB22TS01M", "ZB01AB02CDM1234", "HOODIE-BLK-XL", "DENIM-32", etc.)
  if (!size && sku) {
    const sUpper = sku.trim().toUpperCase();

    // A. Standard hyphen/underscore/slash/space suffix: e.g. -M, -32, _XL
    const suffixMatch = sUpper.match(/(?:[-_/\s])(XS|S|M|L|XL|2XL|3XL|4XL|XXL|XXXL|26|28|30|32|34|36|38|40|42)$/i);
    if (suffixMatch) {
      size = suffixMatch[1];
    } else {
      // B. Custom ZB SKU format with embedded size code (e.g. ZB01AB02CDM1234 or ZB22TS01M or ZB2608UT013201)
      const customZbMatch = sUpper.match(/ZB\d+[A-Z]+\d+([A-Z]{1,4}|\d{2})/);
      if (customZbMatch) {
        const potentialSize = customZbMatch[1];
        if (validSizes.includes(potentialSize)) {
          size = potentialSize;
        }
      }
    }

    if (!size) {
      // C. General embedded token match
      const embeddedMatch = sUpper.match(/(?:^|[-_/\s])(XS|S|M|L|XL|2XL|3XL|4XL|XXL|XXXL|26|28|30|32|34|36|38|40|42)(?:[-_/\s]|$)/i);
      if (embeddedMatch) {
        size = embeddedMatch[1];
      }
    }
  }

  // 4. Extract variant name from title if title contains separator
  if (!variant && title && title.includes("-")) {
    const parts = title.split("-").map(p => p.trim());
    if (parts.length > 1) {
      variant = parts.slice(1).join(" - ");
    }
  }

  const formattedLabel = size ? `Size: ${size}` : (variant || (sku ? `SKU: ${sku}` : null));

  return {
    size,
    variant: variant || size,
    formattedLabel,
  };
}



