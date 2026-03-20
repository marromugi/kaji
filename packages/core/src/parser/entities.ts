const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00A0",
  iexcl: "\u00A1",
  cent: "\u00A2",
  pound: "\u00A3",
  yen: "\u00A5",
  sect: "\u00A7",
  copy: "\u00A9",
  laquo: "\u00AB",
  raquo: "\u00BB",
  reg: "\u00AE",
  deg: "\u00B0",
  plusmn: "\u00B1",
  sup2: "\u00B2",
  sup3: "\u00B3",
  micro: "\u00B5",
  para: "\u00B6",
  middot: "\u00B7",
  frac14: "\u00BC",
  frac12: "\u00BD",
  frac34: "\u00BE",
  iquest: "\u00BF",
  times: "\u00D7",
  divide: "\u00F7",
  ndash: "\u2013",
  mdash: "\u2014",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201C",
  rdquo: "\u201D",
  bull: "\u2022",
  hellip: "\u2026",
  prime: "\u2032",
  Prime: "\u2033",
  lsaquo: "\u2039",
  rsaquo: "\u203A",
  trade: "\u2122",
  larr: "\u2190",
  uarr: "\u2191",
  rarr: "\u2192",
  darr: "\u2193",
  harr: "\u2194",
  minus: "\u2212",
  lowast: "\u2217",
  le: "\u2264",
  ge: "\u2265",
  lang: "\u27E8",
  rang: "\u27E9",
  ensp: "\u2002",
  emsp: "\u2003",
  thinsp: "\u2009",
  zwnj: "\u200C",
  zwj: "\u200D",
  lrm: "\u200E",
  rlm: "\u200F",
};

export interface DecodedEntity {
  char: string;
  length: number; // how many chars consumed after '&' (including ';' if present)
}

/**
 * Decode a single character reference starting at the position after '&'.
 * Returns the decoded character and how many input characters were consumed.
 */
export function decodeEntity(input: string, pos: number): DecodedEntity {
  if (pos >= input.length) {
    return { char: "&", length: 0 };
  }

  // Numeric reference: &#123; or &#x7B;
  if (input[pos] === "#") {
    return decodeNumericEntity(input, pos + 1);
  }

  // Named reference: &amp; etc.
  return decodeNamedEntity(input, pos);
}

function decodeNumericEntity(input: string, pos: number): DecodedEntity {
  const isHex = pos < input.length && (input[pos] === "x" || input[pos] === "X");
  const start = isHex ? pos + 1 : pos;
  let end = start;

  if (isHex) {
    while (end < input.length && /[0-9a-fA-F]/.test(input[end])) end++;
  } else {
    while (end < input.length && /[0-9]/.test(input[end])) end++;
  }

  if (end === start) {
    // No digits found
    return { char: "&", length: 0 };
  }

  const digits = input.slice(start, end);
  const codePoint = parseInt(digits, isHex ? 16 : 10);

  // Consume trailing semicolon if present
  const hasSemicolon = end < input.length && input[end] === ";";
  // +1 for '#', +1 for 'x' if hex, +digits length, +1 for ';' if present
  const length = 1 + (isHex ? 1 : 0) + digits.length + (hasSemicolon ? 1 : 0);

  if (codePoint === 0 || codePoint > 0x10ffff) {
    return { char: "\uFFFD", length };
  }

  return { char: String.fromCodePoint(codePoint), length };
}

function decodeNamedEntity(input: string, pos: number): DecodedEntity {
  // Collect alphanumeric chars for entity name
  let end = pos;
  while (end < input.length && /[a-zA-Z0-9]/.test(input[end]) && end - pos < 32) {
    end++;
  }

  const name = input.slice(pos, end);
  const hasSemicolon = end < input.length && input[end] === ";";

  if (name in NAMED_ENTITIES) {
    return {
      char: NAMED_ENTITIES[name],
      length: name.length + (hasSemicolon ? 1 : 0),
    };
  }

  // Unknown entity — return '&' literally
  return { char: "&", length: 0 };
}

/**
 * Decode all character references in a string.
 */
export function decodeEntities(text: string): string {
  let result = "";
  let i = 0;

  while (i < text.length) {
    if (text[i] === "&") {
      const decoded = decodeEntity(text, i + 1);
      if (decoded.length > 0) {
        result += decoded.char;
        i += 1 + decoded.length; // skip '&' + consumed chars
      } else {
        result += "&";
        i++;
      }
    } else {
      result += text[i];
      i++;
    }
  }

  return result;
}
