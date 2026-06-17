import type { OkfGraphApi } from "../graph/api.js";
import type { BundleOverview } from "../models.js";

export interface BundleRegistryEntry {
  bundle_id: string;
  source_url: string;
  api: OkfGraphApi;
}

export interface BundleListItem extends BundleOverview {
  source_url: string;
}

export class OkfBundleRegistry {
  private readonly entries = new Map<string, BundleRegistryEntry>();

  listBundles(): BundleListItem[] {
    return [...this.entries.values()]
      .map((entry) => entry.api.getBundleOverview())
      .sort((a, b) => a.bundle_id.localeCompare(b.bundle_id));
  }

  hasBundle(bundleId: string): boolean {
    return this.entries.has(bundleId);
  }

  addBundle(entry: BundleRegistryEntry): void {
    if (this.entries.has(entry.bundle_id)) {
      throw new Error(`Bundle is already loaded: ${entry.bundle_id}`);
    }
    this.entries.set(entry.bundle_id, entry);
  }

  requireApi(bundleId: string): OkfGraphApi {
    const entry = this.entries.get(bundleId);
    if (!entry) {
      throw new Error(`Bundle does not exist: ${bundleId}`);
    }
    return entry.api;
  }
}
