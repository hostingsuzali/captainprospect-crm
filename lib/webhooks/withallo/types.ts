/**
 * WithAllo webhook payload types.
 * Supports both { topic, call } (legacy) and { topic, data } (docs) formats.
 */
export interface WithAlloCallPayload {
  id?: string;
  callId?: string;
  fromNumber?: string;
  from?: string;
  toNumber?: string;
  to?: string;
  duration?: number;
  lengthInMinutes?: number;
  direction?: string;
  type?: string;
  summary?: string;
  oneSentenceSummary?: string;
  recordingUrl?: string;
  recording_url?: string;
  startDate?: string;
  started_at?: string;
  startedAt?: string;
  ended_at?: string;
  endedAt?: string;
}

export interface WithAlloWebhookPayload {
  topic?: string;
  event?: string;
  call?: WithAlloCallPayload;
  data?: WithAlloCallPayload;
}

/** Parsed call event for CRM processing */
export interface ParsedCallEvent {
  externalCallId: string;
  fromNumber: string;
  toNumber: string;
  duration: number; // seconds
  direction: string; // INBOUND | OUTBOUND
  summary?: string;
  recordingUrl?: string;
  timestamp: Date;
}
