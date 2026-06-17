import { promises as fs } from "node:fs";
import path from "node:path";

export async function loadBundleFromLocalPath(bundlePath: string): Promise<string> {
  const absolutePath = path.resolve(bundlePath);
  const stat = await fs.stat(absolutePath);
  if (!stat.isDirectory()) {
    throw new Error(`Local bundle path is not a directory: ${absolutePath}`);
  }
  return absolutePath;
}
