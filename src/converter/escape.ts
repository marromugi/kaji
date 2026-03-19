/**
 * Escape characters that have special meaning in Markdown.
 * Only escapes in positions where Markdown would interpret them as syntax.
 */
export function escapeMarkdown(text: string): string {
  return (
    text
      .replace(/([\\*_`[\]#>~])/g, "\\$1")
      // Escape leading dash/plus/digit-dot that would create lists
      .replace(/^(\s*)([-+]|\d+\.) /gm, "$1\\$2 ")
  );
}
