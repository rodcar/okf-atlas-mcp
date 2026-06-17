import type {
  BacklinkResult,
  BundleOverview,
  ConceptDetail,
  ConceptListResult,
  GetBacklinksOptions,
  GetConceptOptions,
  GetNeighborsOptions,
  LinkResolutionResult,
  ListConceptsOptions,
  NeighborhoodResult,
  ResolveLinkOptions,
  SearchConceptsOptions,
  SearchResult,
  ValidationReport
} from "../models.js";

export interface OkfGraphApi {
  getBundleOverview(): BundleOverview;
  listConcepts(options?: ListConceptsOptions): ConceptListResult;
  getConcept(options: GetConceptOptions): ConceptDetail;
  searchConcepts(options: SearchConceptsOptions): SearchResult;
  getNeighbors(options: GetNeighborsOptions): NeighborhoodResult;
  getBacklinks(options: GetBacklinksOptions): BacklinkResult;
  resolveLink(options: ResolveLinkOptions): LinkResolutionResult;
  validateBundle(): ValidationReport;
}
