import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import type { MarkdownLink } from "../models.js";

const markdown = new MarkdownIt({ html: false, linkify: false });

export function extractMarkdownLinks(body: string): MarkdownLink[] {
  const env = {};
  const tokens = markdown.parse(body, env);
  const links: MarkdownLink[] = [];
  collectLinks(tokens, links);
  return links;
}

function collectLinks(tokens: Token[], links: MarkdownLink[]): void {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) {
      continue;
    }
    if (token.type === "inline" && token.children) {
      collectLinks(token.children, links);
      continue;
    }
    if (token.type !== "link_open") {
      continue;
    }

    const href = token.attrGet("href");
    if (!href) {
      continue;
    }

    const labelTokens: string[] = [];
    for (let childIndex = index + 1; childIndex < tokens.length; childIndex += 1) {
      const child = tokens[childIndex];
      if (!child || child.type === "link_close") {
        break;
      }
      if (child.type === "text" || child.type === "code_inline") {
        labelTokens.push(child.content);
      }
    }

    links.push({
      href,
      label: labelTokens.join("").trim() || null
    });
  }
}
