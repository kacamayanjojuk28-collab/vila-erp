// Contract only. No provider implementation, credentials, transport, or live
// submission route is registered in Finance Core v1.
export type ExternalDocumentState="NOT_SUBMITTED"|"SUBMITTED"|"DELIVERED"|"REJECTED"|"CANCEL_REQUESTED"|"CANCELLED";
export type ProviderDocument={orgId:string;internalInvoiceId:string;externalDocumentId:string;providerRequestId:string;state:ExternalDocumentState};
export type SubmissionRequest={orgId:string;internalInvoiceId:string;snapshotSha256:string;envelopeId:string;idempotencyKey:string;schemaVersion:string;xml:Uint8Array};
export type AuthenticatedProviderEvent={provider:string;eventId:string;receivedAt:string;document:ProviderDocument;payloadSha256:string};
export interface EInvoiceProvider {
  readonly name:string;
  validate(request:SubmissionRequest):Promise<{valid:boolean;errors:string[]}>;
  submit(request:SubmissionRequest,credentialReference:string):Promise<ProviderDocument>;
  query(document:ProviderDocument,credentialReference:string):Promise<ProviderDocument>;
  authenticateWebhook(rawBody:Uint8Array,headers:Readonly<Record<string,string>>):Promise<AuthenticatedProviderEvent>;
}
