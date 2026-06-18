import { promises as fs } from "node:fs";
import path from "node:path";
import type { ParsedBundle, ParsedMarkdownFile, ValidationIssue } from "../models.js";
import { bundleIdFromPath, isReservedMarkdownFile, normalizeConceptPath, toPosixPath } from "../utils/path.js";
import { normalizeStringField, normalizeTags, parseFrontmatter } from "./frontmatter.js";
import { extractMarkdownLinks } from "./markdownLinks.js";

export interface ParseOkfBundleOptions {
  sourceUrl: string;
  bundleId?: string;
}

export async function parseOkfBundle(bundlePath: string, options: ParseOkfBundleOptions): Promise<ParsedBundle> {
  const absoluteBundlePath = path.resolve(bundlePath);
  const markdownPaths = await findMarkdownFiles(absoluteBundlePath);
  const warnings: ValidationIssue[] = [];
  const files: ParsedMarkdownFile[] = [];

  for (const absolutePath of markdownPaths) {
    const relativePath = toPosixPath(path.relative(absoluteBundlePath, absolutePath));
    const content = await fs.readFile(absolutePath, "utf8");
    const frontmatterResult = parseFrontmatter(content, relativePath);
    const frontmatter = frontmatterResult.frontmatter;
    const fileWarnings = [...frontmatterResult.warnings];
    const conceptId = normalizeConceptPath(relativePath);
    const type = normalizeStringField(frontmatter.type);
    const title = normalizeStringField(frontmatter.title);
    const description = normalizeStringField(frontmatter.description);
    const tags = normalizeTags(frontmatter.tags);
    const is_reserved = isReservedMarkdownFile(relativePath);

    if (!is_reserved && !type) {
      fileWarnings.push({
        severity: "warning",
        code: "MISSING_TYPE",
        message: "Concept frontmatter is missing required OKF type.",
        path: relativePath
      });
    }

    if (content.trim().length === 0) {
      fileWarnings.push({
        severity: "warning",
        code: "EMPTY_CONCEPT",
        message: "Markdown file is empty.",
        path: relativePath
      });
    }

    warnings.push(...fileWarnings);
    files.push({
      concept_id: conceptId,
      path: relativePath,
      type,
      title,
      description,
      tags,
      frontmatter,
      body_markdown: frontmatterResult.body,
      is_reserved,
      links: extractMarkdownLinks(frontmatterResult.body),
      warnings: fileWarnings
    });
  }

  if (!markdownPaths.some((filePath) => path.basename(filePath).toLowerCase() === "index.md" && path.dirname(filePath) === absoluteBundlePath)) {
    warnings.push({
      severity: "warning",
      code: "MISSING_ROOT_INDEX",
      message: "Bundle does not contain a root index.md file.",
      path: "index.md"
    });
  }

  return {
    bundle_id: options.bundleId ?? bundleIdFromPath(absoluteBundlePath),
    source_url: options.sourceUrl,
    root_path: absoluteBundlePath,
    files,
    warnings
  };
}

async function findMarkdownFiles(root: string): Promise<string[]> {
  const results: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        results.push(fullPath);
      }
    }
  }

  await visit(root);
  return results.sort();
}
