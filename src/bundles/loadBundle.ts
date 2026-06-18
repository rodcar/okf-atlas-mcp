import { buildGraph } from "../graph/builder.js";
import { InMemoryOkfGraphApi } from "../graph/memoryGraph.js";
import { loadBundleFromGithubUrl } from "../loaders/githubLoader.js";
import { parseOkfBundle } from "../parser/okfParser.js";
import type { BundleRegistryEntry } from "./registry.js";

export interface LoadBundleFromUrlOptions {
  bundleUrl: string;
  cacheDir: string;
  refresh?: boolean;
}

export async function loadBundleFromUrl(options: LoadBundleFromUrlOptions): Promise<BundleRegistryEntry> {
  const { bundlePath, reference } = await loadBundleFromGithubUrl(options.bundleUrl, options.cacheDir, options.refresh ?? false);
  const parsedBundle = await parseOkfBundle(bundlePath, {
    sourceUrl: reference.canonicalUrl,
    bundleId: reference.isRepositoryRoot ? reference.repo : undefined
  });
  const graph = buildGraph(parsedBundle);
  const api = new InMemoryOkfGraphApi(graph);
  const overview = api.getBundleOverview();

  if (api.validateBundle().errors.length > 0) {
    throw new Error(`Bundle has fatal validation errors: ${overview.bundle_id}`);
  }

  return {
    bundle_id: overview.bundle_id,
    source_url: reference.canonicalUrl,
    api
  };
}
