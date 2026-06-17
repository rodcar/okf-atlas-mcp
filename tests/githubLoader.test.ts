import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadBundleFromGithubTreeUrl, parseGitHubTreeUrl } from "../src/loaders/githubLoader.js";

const url = "https://github.com/owner/repo/tree/main/okf/bundles/sample";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitHub loader", () => {
  it("parses GitHub tree URLs", () => {
    expect(parseGitHubTreeUrl(url)).toEqual({
      owner: "owner",
      repo: "repo",
      branch: "main",
      bundlePath: "okf/bundles/sample"
    });
  });

  it("reuses cached extraction when refresh is false", async () => {
    const cacheDir = path.resolve("tests/.tmp/cache-reuse");
    await fs.rm(cacheDir, { recursive: true, force: true });
    const cacheKey = createHash("sha256").update(url).digest("hex").slice(0, 16);
    const bundlePath = path.join(cacheDir, `owner-repo-main-${cacheKey}`, "extract", "repo-main", "okf", "bundles", "sample");
    await fs.mkdir(bundlePath, { recursive: true });

    const result = await loadBundleFromGithubTreeUrl(url, cacheDir, false);

    expect(result).toBe(bundlePath);
    await fs.rm(cacheDir, { recursive: true, force: true });
  });

  it("downloads and extracts archive when cache is missing", async () => {
    const cacheDir = path.resolve("tests/.tmp/cache-download");
    await fs.rm(cacheDir, { recursive: true, force: true });
    const zip = new AdmZip();
    zip.addFile("repo-main/okf/bundles/sample/index.md", Buffer.from("# Sample"));
    const buffer = zip.toBuffer();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      }))
    );

    const result = await loadBundleFromGithubTreeUrl(url, cacheDir, false);

    expect(result.endsWith(path.join("repo-main", "okf", "bundles", "sample"))).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
    await fs.rm(cacheDir, { recursive: true, force: true });
  });
});
