// ============================================
// UNIFIED VOIP LAYER — Normalized types
// Provider-agnostic; used by all adapters and processor.
// ============================================

export type VoipProvider = "allo" | "aircall" | "ringover";

/** What the CRM sends to initiate a call */
export interface InitiateCallParams {
  provider: VoipProvider;
  userId: string;
  contactId?: string;
  companyId?: string;
  phone: string;
  missionId?: string;
  campaignId?: string;
}

/** What initiation returns (normalized) */
export interface InitiateCallResult {
  providerCallId: string;
  actionId: string;
  callMethod: "api" | "callback" | "tel_link";
  telLink?: string;
}

/** Normalized call from any provider webhook */
export interface NormalizedCall {
  provider: VoipProvider;
  providerCallId: string;
  direction: "inbound" | "outbound";
  status: "completed" | "missed" | "voicemail" | "failed";
  fromNumber: string;
  toNumber: string;
  durationSeconds: number;
  startedAt: Date;
  endedAt: Date;
  recordingUrl?: string;
  aiSummary?: string;
  aiTranscript?: TranscriptSegment[];
  aiSentiment?: "positive" | "neutral" | "negative";
  aiTopics?: string[];
  aiActionItems?: string[];
  enrichmentPending: boolean;
  providerUserId?: string;
}

export interface TranscriptSegment {
  speaker: "agent" | "prospect";
  text: string;
  startSeconds: number;
  endSeconds?: number;
}

/** Contract every provider adapter must implement */
export interface VoipAdapter {
  provider: VoipProvider;
  initiateCall(params: InitiateCallParams): Promise<InitiateCallResult>;
  parseWebhook(rawBody: unknown): NormalizedCall | null;
  fetchEnrichment?(callId: string): Promise<Partial<NormalizedCall>>;
  matchSdr(normalizedCall: NormalizedCall): Promise<string | null>;
}
