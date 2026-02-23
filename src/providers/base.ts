import type {
  CanonicalEntity,
  OntologyEntityMapping,
  OntologyEntityType,
  OntologyQueryRequest,
} from "../types.js";

export interface ProviderOperationContext {
  workspaceName: string;
  mapping: OntologyEntityMapping;
}

export interface OntologyProviderAdapter {
  readonly providerId: string;
  list(entityType: OntologyEntityType, request: OntologyQueryRequest, context: ProviderOperationContext): Promise<CanonicalEntity[]>;
  get(entityType: OntologyEntityType, request: OntologyQueryRequest, context: ProviderOperationContext): Promise<CanonicalEntity[]>;
  create(entityType: OntologyEntityType, request: OntologyQueryRequest, context: ProviderOperationContext): Promise<CanonicalEntity[]>;
  update(entityType: OntologyEntityType, request: OntologyQueryRequest, context: ProviderOperationContext): Promise<CanonicalEntity[]>;
  search(entityType: OntologyEntityType, request: OntologyQueryRequest, context: ProviderOperationContext): Promise<CanonicalEntity[]>;
}
