import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "../src/parser/frontmatter.js";
import { extractMarkdownLinks } from "../src/parser/markdownLinks.js";
import { parseOkfBundle } from "../src/parser/okfParser.js";

const fixturePath = path.resolve("tests/fixtures/sample_bundle");

describe("OKF parser", () => {
  it("parses markdown files, frontmatter, reserved files, and concept IDs", async () => {
    const bundle = await parseOkfBundle(fixturePath, { sourceUrl: "fixture://sample" });

    expect(bundle.bundle_id).toBe("sample_bundle");
    expect(bundle.files.map((file) => file.concept_id)).toContain("systems/app");
    expect(bundle.files.find((file) => file.concept_id === "index")?.is_reserved).toBe(true);
    expect(bundle.files.find((file) => file.concept_id === "systems/app")?.frontmatter.owner).toBe("platform");
    expect(bundle.files.find((file) => file.concept_id === "systems/app")?.body_markdown).toContain("The app calls");
  });

  it("warns for invalid YAML and missing type without throwing", async () => {
    const bundle = await parseOkfBundle(fixturePath, { sourceUrl: "fixture://sample" });

    expect(bundle.warnings.some((warning) => warning.code === "INVALID_FRONTMATTER")).toBe(true);
    expect(bundle.warnings.some((warning) => warning.code === "MISSING_TYPE" && warning.path === "notes/missing_type.md")).toBe(true);
  });
});

describe("frontmatter parser", () => {
  it("preserves body when frontmatter is missing", () => {
    const result = parseFrontmatter("# Title", "no-frontmatter.md");

    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe("# Title");
    expect(result.warnings[0]?.code).toBe("MISSING_FRONTMATTER");
  });
});

describe("markdown link extraction", () => {
  it("extracts standard markdown links", () => {
    const links = extractMarkdownLinks("[App](./app.md), [External](https://example.com), and `not a [link](x)`");

    expect(links).toEqual([
      { href: "./app.md", label: "App" },
      { href: "https://example.com", label: "External" }
    ]);
  });
});
