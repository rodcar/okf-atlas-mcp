import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { getInstallationAccessToken, githubApiHeaders, loadGitHubAppConfigFromEnv } from "../auth/githubApp.js";

export interface GitHubTreeUrlParts {
  owner: string;
  repo: string;
  branch: string;
  bundlePath: string;
}

export function parseGitHubTreeUrl(url: string): GitHubTreeUrlParts {
  const parsed = new URL(url);
  if (parsed.hostname !== "github.com") {
    throw new Error(`Unsupported bundle URL host: ${parsed.hostname}`);
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  const treeIndex = segments.indexOf("tree");
  if (segments.length < 5 || treeIndex !== 2) {
    throw new Error("Expected GitHub tree URL format: https://github.com/{owner}/{repo}/tree/{branch}/{path_to_bundle}");
  }

  const [owner, repo] = segments;
  const branch = segments[treeIndex + 1];
  const bundlePath = segments.slice(treeIndex + 2).join("/");

  if (!owner || !repo || !branch || !bundlePath) {
    throw new Error("GitHub tree URL must include owner, repo, branch, and bundle path.");
  }

  return {
    owner,
    repo,
    branch,
    bundlePath
  };
}

export async function loadBundleFromGithubTreeUrl(url: string, cacheDir: string, refresh: boolean): Promise<string> {
  const parts = parseGitHubTreeUrl(url);
  const cacheKey = createHash("sha256").update(url).digest("hex").slice(0, 16);
  const rootCacheDir = path.resolve(cacheDir, `${parts.owner}-${parts.repo}-${parts.branch}-${cacheKey}`);
  const archivePath = path.join(rootCacheDir, "archive.zip");
  const extractDir = path.join(rootCacheDir, "extract");

  if (refresh) {
    await fs.rm(rootCacheDir, { recursive: true, force: true });
  }

  const cachedBundlePath = await findCachedBundlePath(extractDir, parts.bundlePath);
  if (cachedBundlePath) {
    return cachedBundlePath;
  }

  await fs.mkdir(rootCacheDir, { recursive: true });
  await downloadArchive(parts, archivePath);
  await fs.rm(extractDir, { recursive: true, force: true });
  await fs.mkdir(extractDir, { recursive: true });

  const zip = new AdmZip(archivePath);
  zip.extractAllTo(extractDir, true);

  const bundlePath = await findCachedBundlePath(extractDir, parts.bundlePath);
  if (!bundlePath) {
    throw new Error(`Downloaded archive does not contain bundle path: ${parts.bundlePath}`);
  }
  return bundlePath;
}

async function downloadArchive(parts: GitHubTreeUrlParts, archivePath: string): Promise<void> {
  const githubAppConfig = await loadGitHubAppConfigFromEnv();
  if (githubAppConfig) {
    await downloadAuthenticatedArchive(parts, archivePath, githubAppConfig);
    return;
  }

  const branchPath = parts.branch.split("/").map(encodeURIComponent).join("/");
  const archiveUrl = `https://github.com/${parts.owner}/${parts.repo}/archive/refs/heads/${branchPath}.zip`;
  const response = await fetch(archiveUrl, {
    headers: {
      "user-agent": "okf-atlas-mcp"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download GitHub archive (${response.status} ${response.statusText}): ${archiveUrl}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  await fs.writeFile(archivePath, bytes);
}

async function downloadAuthenticatedArchive(
  parts: GitHubTreeUrlParts,
  archivePath: string,
  githubAppConfig: NonNullable<Awaited<ReturnType<typeof loadGitHubAppConfigFromEnv>>>
): Promise<void> {
  const branchPath = parts.branch.split("/").map(encodeURIComponent).join("/");
  const archiveUrl = `https://api.github.com/repos/${parts.owner}/${parts.repo}/zipball/${branchPath}`;
  const token = await getInstallationAccessToken(parts, githubAppConfig);
  const response = await fetch(archiveUrl, {
    headers: githubApiHeaders(token),
    redirect: "follow"
  });

  if (response.status === 403) {
    throw new Error(`GitHub App installation lacks required repository Contents: Read-only permission: ${parts.owner}/${parts.repo}`);
  }
  if (response.status === 404) {
    throw new Error(`GitHub repository, branch, or archive was not found: ${parts.owner}/${parts.repo}@${parts.branch}`);
  }
  if (!response.ok) {
    throw new Error(`Failed to download GitHub archive (${response.status} ${response.statusText}): ${archiveUrl}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  await fs.writeFile(archivePath, bytes);
}

async function findCachedBundlePath(extractDir: string, bundlePath: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(extractDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const candidate = path.join(extractDir, entry.name, ...bundlePath.split("/"));
      try {
        const stat = await fs.stat(candidate);
        if (stat.isDirectory()) {
          return candidate;
        }
      } catch {
        // Try the next archive root.
      }
    }
  } catch {
    return null;
  }
  return null;
}
