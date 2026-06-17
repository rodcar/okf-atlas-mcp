import path from "node:path";
import type { LinkResolutionResult } from "../models.js";
import { normalizeConceptPath } from "../utils/path.js";

const EXTERNAL_SCHEMES = /^[a-z][a-z0-9+.-]*:/i;

export function isExternalHref(href: string): boolean {
  return EXTERNAL_SCHEMES.test(href) || href.startsWith("//");
}

export function removeHrefFragmentAndQuery(href: string): string {
  return href.split("#")[0]?.split("?")[0] ?? href;
}

export function resolveLink(fromConceptId: string, href: string, knownConceptIds: Set<string>): LinkResolutionResult {
  if (isExternalHref(href)) {
    return {
      from_concept_id: fromConceptId,
      href,
      target_id: null,
      resolved: false,
      external: true
    };
  }

  const cleanHref = removeHrefFragmentAndQuery(href);
  if (!cleanHref || cleanHref.startsWith("#")) {
    return {
      from_concept_id: fromConceptId,
      href,
      target_id: fromConceptId,
      resolved: true,
      external: false
    };
  }

  const rawTarget = cleanHref.startsWith("/")
    ? cleanHref
    : path.posix.join(path.posix.dirname(fromConceptId), cleanHref);
  const candidate = normalizeConceptPath(rawTarget);

  return {
    from_concept_id: fromConceptId,
    href,
    target_id: knownConceptIds.has(candidate) ? candidate : null,
    resolved: knownConceptIds.has(candidate),
    external: false
  };
}
