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
