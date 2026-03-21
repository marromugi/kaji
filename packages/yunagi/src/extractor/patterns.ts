/** Matches class/id names suggesting main content */
export const POSITIVE_PATTERN =
  /article|body|content|entry|hentry|h-entry|main|page|pagination|post|text|blog|story/i;

/** Matches class/id names suggesting non-content */
export const NEGATIVE_PATTERN =
  /-ad-|hidden|^hid$| hid$| hid |^hid |banner|combx|comment|com-|contact|footer|gdpr|masthead|media|meta|outbrain|promo|related|scroll|share|shoutbox|sidebar|skyscraper|sponsor|shopping|tags|widget/i;

/** Matches likely byline patterns */
export const BYLINE_PATTERN = /byline|author|dateline|writtenby|p-author/i;

/** Elements unlikely to contain content */
export const UNLIKELY_CANDIDATES =
  /banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|footer|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-resolve/i;

/** Elements that MIGHT contain content despite matching unlikely */
export const MAYBE_CANDIDATES = /and|article|body|column|content|main|shadow/i;

/** Tags to strip from extracted content */
export const STRIP_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "iframe",
  "form",
  "button",
  "input",
  "select",
  "textarea",
  "nav",
  "footer",
  "header",
]);

/** Block-level elements that might contain article content as direct children */
export const CONTENT_TAGS = new Set(["p", "pre", "td"]);

/** Tags that indicate a div should be treated as a paragraph (if it has no block children) */
export const DIV_TO_P_BLOCK_TAGS = new Set([
  "blockquote",
  "dl",
  "div",
  "img",
  "ol",
  "p",
  "pre",
  "table",
  "ul",
]);
