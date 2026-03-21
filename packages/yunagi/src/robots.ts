/**
 * Minimal robots.txt parser and checker.
 * Follows the Google robots.txt specification (RFC 9309 subset).
 */

// ─── Types ───

export interface RobotsTxtRule {
  type: "allow" | "disallow";
  path: string;
}

export interface RobotsTxtGroup {
  userAgents: string[];
  rules: RobotsTxtRule[];
}

export interface RobotsTxtRules {
  groups: RobotsTxtGroup[];
}

// ─── Parser ───

export function parseRobotsTxt(body: string): RobotsTxtRules {
  const groups: RobotsTxtGroup[] = [];
  let currentGroup: RobotsTxtGroup | null = null;

  for (const raw of body.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (line === "") continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const field = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (field === "user-agent") {
      if (currentGroup && currentGroup.rules.length > 0) {
        // Previous group already has rules — start a new group
        groups.push(currentGroup);
        currentGroup = { userAgents: [value.toLowerCase()], rules: [] };
      } else if (currentGroup) {
        // Still collecting user-agents for the current group
        currentGroup.userAgents.push(value.toLowerCase());
      } else {
        currentGroup = { userAgents: [value.toLowerCase()], rules: [] };
      }
    } else if (field === "allow" || field === "disallow") {
      if (!currentGroup) {
        currentGroup = { userAgents: ["*"], rules: [] };
      }
      if (value !== "") {
        currentGroup.rules.push({ type: field, path: value });
      }
    }
    // Ignore other directives (Sitemap, Crawl-delay, etc.)
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return { groups };
}

// ─── Matcher ───

/**
 * Find the most specific matching group for the given user-agent.
 * Exact substring match on the UA string takes priority over wildcard (*).
 */
function findGroup(rules: RobotsTxtRules, userAgent: string): RobotsTxtGroup | null {
  const ua = userAgent.toLowerCase();
  let wildcardGroup: RobotsTxtGroup | null = null;

  for (const group of rules.groups) {
    for (const groupUa of group.userAgents) {
      if (groupUa === "*") {
        wildcardGroup = group;
      } else if (ua.includes(groupUa) || groupUa.includes(ua)) {
        return group;
      }
    }
  }

  return wildcardGroup;
}

/**
 * Check whether the given path matches a robots.txt path pattern.
 * Supports prefix matching and `*` / `$` wildcards.
 */
function pathMatches(pattern: string, path: string): boolean {
  // Convert robots.txt pattern to regex
  let regex = "^";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "*") {
      regex += ".*";
    } else if (ch === "$" && i === pattern.length - 1) {
      regex += "$";
    } else {
      regex += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  // If pattern doesn't end with $, it's a prefix match
  if (!pattern.endsWith("$")) {
    // regex already handles prefix matching since we don't add $
  }
  return new RegExp(regex).test(path);
}

/**
 * Check if a user-agent is allowed to access the given path.
 * Returns `true` if access is allowed, `false` if disallowed.
 *
 * When no matching group exists, access is allowed (permissive default).
 * When multiple rules match, the most specific (longest path) wins.
 * If specificity is equal, Allow takes precedence.
 */
export function isAllowed(rules: RobotsTxtRules, userAgent: string, path: string): boolean {
  const group = findGroup(rules, userAgent);
  if (!group) return true;

  let bestMatch: RobotsTxtRule | null = null;
  let bestLen = -1;

  for (const rule of group.rules) {
    if (pathMatches(rule.path, path)) {
      const specificity = rule.path.replace(/[*$]/g, "").length;
      if (specificity > bestLen || (specificity === bestLen && rule.type === "allow")) {
        bestMatch = rule;
        bestLen = specificity;
      }
    }
  }

  if (!bestMatch) return true;
  return bestMatch.type === "allow";
}

// ─── Fetcher ───

const USER_AGENT = "yunagi/0.1";

/**
 * Fetch and parse robots.txt for the given origin.
 * Returns parsed rules. On any network error or non-200 status, returns
 * empty rules (= everything allowed).
 */
export async function fetchRobotsTxt(origin: string): Promise<RobotsTxtRules> {
  try {
    const url = `${origin.replace(/\/$/, "")}/robots.txt`;
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) {
      return { groups: [] };
    }
    const body = await response.text();
    return parseRobotsTxt(body);
  } catch {
    return { groups: [] };
  }
}

/**
 * Check if the given URL is allowed by robots.txt.
 */
export async function checkRobotsTxt(url: string): Promise<boolean> {
  const parsed = new URL(url);
  const rules = await fetchRobotsTxt(parsed.origin);
  return isAllowed(rules, USER_AGENT, parsed.pathname + parsed.search);
}
