import { generateKeyPairSync } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearGitHubAppTokenCache,
  createGitHubAppJwt,
  detectGitHubAppEnv,
  getInstallationAccessToken,
  loadGitHubAppConfigFromEnv
} from "../src/auth/githubApp.js";

const privateKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({
  type: "pkcs1",
  format: "pem"
});

afterEach(() => {
  clearGitHubAppTokenCache();
  vi.unstubAllGlobals();
});

describe("GitHub App auth", () => {
  it("detects complete app configuration from environment", () => {
    expect(detectGitHubAppEnv({ GITHUB_APP_ID: "123", GITHUB_APP_PRIVATE_KEY: privateKey })).toBe(true);
    expect(detectGitHubAppEnv({ GITHUB_APP_ID: "123" })).toBe(false);
  });

  it("loads private key from path or inline env", async () => {
    const keyPath = path.resolve("tests/.tmp/github-app-key.pem");
    await fs.mkdir(path.dirname(keyPath), { recursive: true });
    await fs.writeFile(keyPath, privateKey, "utf8");

    await expect(loadGitHubAppConfigFromEnv({ GITHUB_APP_ID: "123", GITHUB_APP_PRIVATE_KEY_PATH: keyPath })).resolves.toEqual({
      appId: "123",
      privateKey
    });
    await expect(
      loadGitHubAppConfigFromEnv({ GITHUB_APP_ID: "123", GITHUB_APP_PRIVATE_KEY: privateKey.replace(/\n/g, "\\n") })
    ).resolves.toEqual({
      appId: "123",
      privateKey
    });

    await fs.rm(path.dirname(keyPath), { recursive: true, force: true });
  });

  it("fails clearly when GitHub App env is partially configured", async () => {
    await expect(loadGitHubAppConfigFromEnv({ GITHUB_APP_ID: "123" })).rejects.toThrow("GITHUB_APP_PRIVATE_KEY");
    await expect(loadGitHubAppConfigFromEnv({ GITHUB_APP_PRIVATE_KEY: privateKey })).rejects.toThrow("GITHUB_APP_ID");
  });

  it("creates a signed JWT with expected claims", () => {
    const jwt = createGitHubAppJwt({ appId: "123", privateKey }, 1_700_000_000);
    const [encodedHeader, encodedPayload, encodedSignature] = jwt.split(".");

    expect(JSON.parse(Buffer.from(encodedHeader ?? "", "base64url").toString("utf8"))).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(encodedPayload ?? "", "base64url").toString("utf8"))).toEqual({
      iat: 1_699_999_940,
      exp: 1_700_000_540,
      iss: "123"
    });
    expect(encodedSignature?.length).toBeGreaterThan(100);
  });

  it("discovers installation, creates token, and reuses cache", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 42 }))
      .mockResolvedValueOnce(jsonResponse({ token: "installation-token", expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }));

    const parts = { owner: "owner", repo: "repo", branch: "main", bundlePath: "okf/bundles/sample" };
    await expect(getInstallationAccessToken(parts, { appId: "123", privateKey }, fetchMock)).resolves.toBe("installation-token");
    await expect(getInstallationAccessToken(parts, { appId: "123", privateKey }, fetchMock)).resolves.toBe("installation-token");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.github.com/repos/owner/repo/installation",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: expect.stringMatching(/^Bearer /)
        })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.github.com/app/installations/42/access_tokens",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("surfaces app installation and permission errors", async () => {
    const parts = { owner: "owner", repo: "repo", branch: "main", bundlePath: "okf/bundles/sample" };

    await expect(
      getInstallationAccessToken(parts, { appId: "123", privateKey }, vi.fn().mockResolvedValue(response(404, "Not Found")))
    ).rejects.toThrow("GitHub App is not installed on repository");

    await expect(
      getInstallationAccessToken(
        parts,
        { appId: "123", privateKey },
        vi.fn().mockResolvedValueOnce(jsonResponse({ id: 42 })).mockResolvedValueOnce(response(403, "Forbidden"))
      )
    ).rejects.toThrow("Contents: Read-only");
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

function response(status: number, statusText: string): Response {
  return {
    ok: false,
    status,
    statusText,
    json: async () => ({})
  } as Response;
}
