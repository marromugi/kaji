import { TokenType, Token, Attribute, StartTagToken, EndTagToken } from "../types.js";
import { decodeEntities } from "./entities.js";
import { RAW_TEXT_ELEMENTS, RCDATA_ELEMENTS } from "./nodes.js";

const State = {
  Data: 0,
  TagOpen: 1,
  EndTagOpen: 2,
  TagName: 3,
  BeforeAttrName: 4,
  AttrName: 5,
  AfterAttrName: 6,
  BeforeAttrValue: 7,
  AttrValueDoubleQuoted: 8,
  AttrValueSingleQuoted: 9,
  AttrValueUnquoted: 10,
  AfterAttrValueQuoted: 11,
  SelfClosingStartTag: 12,
  BogusComment: 13,
  MarkupDeclarationOpen: 14,
  CommentStart: 15,
  CommentStartDash: 16,
  Comment: 17,
  CommentEndDash: 18,
  CommentEnd: 19,
  Doctype: 20,
  RawText: 21,
  RCData: 22,
} as const;

type State = (typeof State)[keyof typeof State];

export class Tokenizer {
  private input: string;
  private pos = 0;
  private state: State = State.Data;
  private tokens: Token[] = [];
  private buffer = "";

  // Current tag being built
  private currentTagName = "";
  private currentTagIsEnd = false;
  private currentTagSelfClosing = false;
  private currentAttrs: Attribute[] = [];
  private currentAttrName = "";
  private currentAttrValue = "";

  // For raw text / rcdata: the tag name we're looking for to close
  private rawTextEndTag = "";

  constructor(html: string) {
    this.input = html;
  }

  tokenize(): Token[] {
    while (this.pos < this.input.length) {
      this.consume();
    }

    // Flush any remaining text buffer
    this.flushText();

    this.tokens.push({ type: TokenType.EOF });
    return this.tokens;
  }

  private peek(): string {
    return this.pos < this.input.length ? this.input[this.pos] : "";
  }

  private advance(): string {
    return this.input[this.pos++] ?? "";
  }

  private flushText(): void {
    if (this.buffer.length > 0) {
      this.tokens.push({ type: TokenType.Text, data: decodeEntities(this.buffer) });
      this.buffer = "";
    }
  }

  private emitStartTag(): void {
    this.tokens.push({
      type: TokenType.StartTag,
      tagName: this.currentTagName.toLowerCase(),
      attributes: this.currentAttrs,
      selfClosing: this.currentTagSelfClosing,
    } as StartTagToken);
  }

  private emitEndTag(): void {
    this.tokens.push({
      type: TokenType.EndTag,
      tagName: this.currentTagName.toLowerCase(),
    } as EndTagToken);
  }

  private resetTag(): void {
    this.currentTagName = "";
    this.currentTagIsEnd = false;
    this.currentTagSelfClosing = false;
    this.currentAttrs = [];
    this.currentAttrName = "";
    this.currentAttrValue = "";
  }

  private pushAttr(): void {
    if (this.currentAttrName) {
      this.currentAttrs.push({
        name: this.currentAttrName.toLowerCase(),
        value: decodeEntities(this.currentAttrValue),
      });
      this.currentAttrName = "";
      this.currentAttrValue = "";
    }
  }

  private consume(): void {
    const ch = this.advance();

    switch (this.state) {
      case State.Data:
        if (ch === "<") {
          this.flushText();
          this.state = State.TagOpen;
        } else {
          this.buffer += ch;
        }
        break;

      case State.TagOpen:
        if (ch === "!") {
          this.state = State.MarkupDeclarationOpen;
        } else if (ch === "/") {
          this.state = State.EndTagOpen;
        } else if (ch === "?") {
          // Processing instruction — treat as bogus comment
          this.buffer = "?";
          this.state = State.BogusComment;
        } else if (/[a-zA-Z]/.test(ch)) {
          this.resetTag();
          this.currentTagName = ch;
          this.state = State.TagName;
        } else {
          // Not a valid tag start, emit '<' as text
          this.buffer += "<" + ch;
          this.state = State.Data;
        }
        break;

      case State.EndTagOpen:
        if (/[a-zA-Z]/.test(ch)) {
          this.resetTag();
          this.currentTagIsEnd = true;
          this.currentTagName = ch;
          this.state = State.TagName;
        } else if (ch === ">") {
          // </> — ignore
          this.state = State.Data;
        } else {
          this.buffer = ch;
          this.state = State.BogusComment;
        }
        break;

      case State.TagName:
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f") {
          this.state = State.BeforeAttrName;
        } else if (ch === "/") {
          this.state = State.SelfClosingStartTag;
        } else if (ch === ">") {
          this.finishTag();
        } else {
          this.currentTagName += ch;
        }
        break;

      case State.SelfClosingStartTag:
        if (ch === ">") {
          this.currentTagSelfClosing = true;
          this.finishTag();
        } else {
          // Treat '/' as part of the tag (reconsume)
          this.state = State.BeforeAttrName;
          this.pos--; // reconsume
        }
        break;

      case State.BeforeAttrName:
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f") {
          // skip whitespace
        } else if (ch === "/") {
          this.state = State.SelfClosingStartTag;
        } else if (ch === ">") {
          this.finishTag();
        } else {
          this.currentAttrName = ch;
          this.currentAttrValue = "";
          this.state = State.AttrName;
        }
        break;

      case State.AttrName:
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f") {
          this.state = State.AfterAttrName;
        } else if (ch === "/") {
          this.pushAttr();
          this.state = State.SelfClosingStartTag;
        } else if (ch === "=") {
          this.state = State.BeforeAttrValue;
        } else if (ch === ">") {
          this.pushAttr();
          this.finishTag();
        } else {
          this.currentAttrName += ch;
        }
        break;

      case State.AfterAttrName:
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f") {
          // skip whitespace
        } else if (ch === "/") {
          this.pushAttr();
          this.state = State.SelfClosingStartTag;
        } else if (ch === "=") {
          this.state = State.BeforeAttrValue;
        } else if (ch === ">") {
          this.pushAttr();
          this.finishTag();
        } else {
          // Start a new attribute (previous one is value-less)
          this.pushAttr();
          this.currentAttrName = ch;
          this.currentAttrValue = "";
          this.state = State.AttrName;
        }
        break;

      case State.BeforeAttrValue:
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f") {
          // skip whitespace
        } else if (ch === '"') {
          this.state = State.AttrValueDoubleQuoted;
        } else if (ch === "'") {
          this.state = State.AttrValueSingleQuoted;
        } else if (ch === ">") {
          this.pushAttr();
          this.finishTag();
        } else {
          this.currentAttrValue = ch;
          this.state = State.AttrValueUnquoted;
        }
        break;

      case State.AttrValueDoubleQuoted:
        if (ch === '"') {
          this.pushAttr();
          this.state = State.AfterAttrValueQuoted;
        } else {
          this.currentAttrValue += ch;
        }
        break;

      case State.AttrValueSingleQuoted:
        if (ch === "'") {
          this.pushAttr();
          this.state = State.AfterAttrValueQuoted;
        } else {
          this.currentAttrValue += ch;
        }
        break;

      case State.AttrValueUnquoted:
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f") {
          this.pushAttr();
          this.state = State.BeforeAttrName;
        } else if (ch === ">") {
          this.pushAttr();
          this.finishTag();
        } else {
          this.currentAttrValue += ch;
        }
        break;

      case State.AfterAttrValueQuoted:
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f") {
          this.state = State.BeforeAttrName;
        } else if (ch === "/") {
          this.state = State.SelfClosingStartTag;
        } else if (ch === ">") {
          this.finishTag();
        } else {
          // Missing whitespace between attrs — reconsume
          this.state = State.BeforeAttrName;
          this.pos--;
        }
        break;

      case State.MarkupDeclarationOpen:
        if (this.input.startsWith("--", this.pos - 1)) {
          // <!-- comment
          this.pos++; // skip second '-'
          this.buffer = "";
          this.state = State.CommentStart;
        } else if (this.input.slice(this.pos - 1, this.pos + 6).toUpperCase() === "DOCTYPE") {
          this.pos += 6; // skip 'OCTYPE'
          this.state = State.Doctype;
        } else if (this.input.startsWith("[CDATA[", this.pos - 1)) {
          // CDATA section — consume until ]]>
          this.pos += 6; // skip 'CDATA['
          const endIdx = this.input.indexOf("]]>", this.pos);
          if (endIdx !== -1) {
            this.buffer = this.input.slice(this.pos, endIdx);
            this.flushText();
            this.pos = endIdx + 3;
          }
          this.state = State.Data;
        } else {
          // Bogus comment
          this.buffer = ch;
          this.state = State.BogusComment;
        }
        break;

      case State.CommentStart:
        if (ch === "-") {
          this.state = State.CommentStartDash;
        } else if (ch === ">") {
          // Abrupt: <!--> — emit empty comment
          this.tokens.push({ type: TokenType.Comment, data: "" });
          this.state = State.Data;
        } else {
          this.buffer = ch;
          this.state = State.Comment;
        }
        break;

      case State.CommentStartDash:
        if (ch === "-") {
          this.state = State.CommentEnd;
        } else if (ch === ">") {
          // <!---> — emit empty comment
          this.tokens.push({ type: TokenType.Comment, data: "" });
          this.state = State.Data;
        } else {
          this.buffer = "-" + ch;
          this.state = State.Comment;
        }
        break;

      case State.Comment:
        if (ch === "-") {
          this.state = State.CommentEndDash;
        } else {
          this.buffer += ch;
        }
        break;

      case State.CommentEndDash:
        if (ch === "-") {
          this.state = State.CommentEnd;
        } else {
          this.buffer += "-" + ch;
          this.state = State.Comment;
        }
        break;

      case State.CommentEnd:
        if (ch === ">") {
          this.tokens.push({ type: TokenType.Comment, data: this.buffer });
          this.buffer = "";
          this.state = State.Data;
        } else if (ch === "-") {
          this.buffer += "-";
        } else {
          this.buffer += "--" + ch;
          this.state = State.Comment;
        }
        break;

      case State.Doctype:
        // Simplified: consume until '>'
        if (ch === ">") {
          this.tokens.push({ type: TokenType.Doctype, name: "html" });
          this.state = State.Data;
        }
        break;

      case State.BogusComment:
        if (ch === ">") {
          this.tokens.push({ type: TokenType.Comment, data: this.buffer });
          this.buffer = "";
          this.state = State.Data;
        } else {
          this.buffer += ch;
        }
        break;

      case State.RawText:
        this.consumeRawText(ch, false);
        break;

      case State.RCData:
        this.consumeRawText(ch, true);
        break;
    }
  }

  private finishTag(): void {
    const tagName = this.currentTagName.toLowerCase();

    if (this.currentTagIsEnd) {
      this.emitEndTag();
    } else {
      this.emitStartTag();

      // Switch to raw text / rcdata mode if needed
      if (RAW_TEXT_ELEMENTS.has(tagName)) {
        this.rawTextEndTag = tagName;
        this.buffer = "";
        this.state = State.RawText;
        return;
      }
      if (RCDATA_ELEMENTS.has(tagName)) {
        this.rawTextEndTag = tagName;
        this.buffer = "";
        this.state = State.RCData;
        return;
      }
    }

    this.state = State.Data;
  }

  private consumeRawText(ch: string, decodeEntityRefs: boolean): void {
    // Look for the end tag: </tagname>
    if (ch === "<") {
      const remaining = this.input.slice(this.pos);
      const pattern = new RegExp(`^\\/${this.rawTextEndTag}\\s*>`, "i");
      const match = remaining.match(pattern);
      if (match) {
        // Emit accumulated content as text
        const text = decodeEntityRefs ? decodeEntities(this.buffer) : this.buffer;
        if (text.length > 0) {
          this.tokens.push({ type: TokenType.Text, data: text });
        }
        this.buffer = "";

        // Emit the end tag
        this.pos += match[0].length;
        this.tokens.push({
          type: TokenType.EndTag,
          tagName: this.rawTextEndTag,
        });
        this.state = State.Data;
        return;
      }
    }

    this.buffer += ch;
  }
}
