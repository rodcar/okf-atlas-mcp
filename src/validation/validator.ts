import type { BundleGraph, ValidationReport } from "../models.js";

export function validateBundle(graph: BundleGraph): ValidationReport {
  const errors = graph.warnings.filter((issue) => issue.severity === "error");
  const warnings = graph.warnings.filter((issue) => issue.severity === "warning");
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
