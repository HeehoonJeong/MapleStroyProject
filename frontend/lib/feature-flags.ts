/** Shared at build/deploy time by the UI and both Edge Functions. */
export const TOOL_FLAGS: Readonly<Record<string, boolean>> = {
  estimate_boss_clear: false,
  analyze_auction_screenshot: false,
  search_maple_guide: false,
};
export function isToolEnabled(id: string): boolean {
  return TOOL_FLAGS[id] !== false;
}
