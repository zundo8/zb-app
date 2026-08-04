/**
 * Formats order numbers cleanly, removing duplicate '#' prefixes.
 * Examples:
 *   formatDisplayOrderNumber("#ZB71901") -> "#ZB71901"
 *   formatDisplayOrderNumber("##ZB71901") -> "#ZB71901"
 *   formatDisplayOrderNumber("ZB-2605-00043") -> "#ZB-2605-00043"
 *   formatDisplayOrderNumber("7298666168601") -> "#7298666168601"
 */
export function formatDisplayOrderNumber(orderNum: string | null | undefined): string {
  if (!orderNum) return "#N/A";
  const trimmed = orderNum.trim();
  const cleaned = trimmed.replace(/^#+/, '');
  return `#${cleaned}`;
}
