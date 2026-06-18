import { createHash } from "node:crypto";
import { generateKeyPairSync } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearGitHubAppTokenCache } from "../src/auth/githubApp.js";
import { loadBundleFromGithubUrl, loadBundleFromGithubTreeUrl, normalizeGitHubBundleUrl, parseGitHubTreeUrl } from "../src/loaders/githubLoader.js";

const url = "https://github.com/owner/repo/tree/main/okf/bundles/sample";
const privateKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({
  type: "pkcs1",
  format: "pem"
});

afterEach(() => {
  clearGitHubAppTokenCache();
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

  it("normalizes raw repository root URLs", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ default_branch: "main" })));

    await expect(normalizeGitHubBundleUrl("https://github.com/owner/repo")).resolves.toEqual({
      owner: "owner",
      repo: "repo",
      branch: "main",
      bundlePath: "",
      canonicalUrl: "https://github.com/owner/repo/tree/main",
      isRepositoryRoot: true
    });
  });

  it("normalizes Markdown links wrapping repository root URLs", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ default_branch: "trunk" })));

    await expect(normalizeGitHubBundleUrl("[owner/repo](https://github.com/owner/repo)")).resolves.toMatchObject({
      owner: "owner",
      repo: "repo",
      branch: "trunk",
      bundlePath: "",
      canonicalUrl: "https://github.com/owner/repo/tree/trunk",
      isRepositoryRoot: true
    });
  });

  it("normalizes explicit GitHub tree root URLs", async () => {
    await expect(normalizeGitHubBundleUrl("https://github.com/owner/repo/tree/main")).resolves.toEqual({
      owner: "owner",
      repo: "repo",
      branch: "main",
      bundlePath: "",
      canonicalUrl: "https://github.com/owner/repo/tree/main",
      isRepositoryRoot: true
    });
  });

  it("rejects invalid Markdown or missing GitHub URLs", async () => {
    await expect(normalizeGitHubBundleUrl("[owner/repo]")).rejects.toThrow("Expected bundle_url to be a GitHub URL");
  });

  it("rejects unsupported hosts", async () => {
    await expect(normalizeGitHubBundleUrl("https://gitlab.com/owner/repo")).rejects.toThrow("Unsupported bundle URL host: gitlab.com");
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

  it("downloads and extracts repository root bundles", async () => {
    const cacheDir = path.resolve("tests/.tmp/cache-root-download");
    await fs.rm(cacheDir, { recursive: true, force: true });
    const zip = new AdmZip();
    zip.addFile("repo-main/index.md", Buffer.from("# Root Bundle"));
    const buffer = zip.toBuffer();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ default_branch: "main" })).mockResolvedValueOnce(binaryResponse(buffer)));

    const result = await loadBundleFromGithubUrl("https://github.com/owner/repo", cacheDir, false);

    expect(result.reference).toMatchObject({
      owner: "owner",
      repo: "repo",
      branch: "main",
      bundlePath: "",
      canonicalUrl: "https://github.com/owner/repo/tree/main",
      isRepositoryRoot: true
    });
    expect(result.bundlePath.endsWith(path.join("repo-main"))).toBe(true);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://api.github.com/repos/owner/repo",
      expect.objectContaining({
        headers: expect.objectContaining({
          "user-agent": "okf-atlas-mcp"
        })
      })
    );
    await fs.rm(cacheDir, { recursive: true, force: true });
  });

  it("uses GitHub App API zipball endpoint when app env is configured", async () => {
    const cacheDir = path.resolve("tests/.tmp/cache-auth-download");
    await fs.rm(cacheDir, { recursive: true, force: true });
    const zip = new AdmZip();
    zip.addFile("repo-main/okf/bundles/sample/index.md", Buffer.from("# Sample"));
    const buffer = zip.toBuffer();

    vi.stubEnv("GITHUB_APP_ID", "123");
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", privateKey);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ id: 42 }))
        .mockResolvedValueOnce(jsonResponse({ token: "installation-token", expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }))
        .mockResolvedValueOnce(binaryResponse(buffer))
    );

    const result = await loadBundleFromGithubTreeUrl(url, cacheDir, false);

    expect(result.endsWith(path.join("repo-main", "okf", "bundles", "sample"))).toBe(true);
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "https://api.github.com/repos/owner/repo/zipball/main",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer installation-token"
        }),
        redirect: "follow"
      })
    );
    await fs.rm(cacheDir, { recursive: true, force: true });
  });
});

function jsonResponse(value: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => value
  } as Response;
}

function binaryResponse(buffer: Buffer): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  } as Response;
}
