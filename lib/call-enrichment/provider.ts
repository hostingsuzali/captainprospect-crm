import { AlloProvider } from './allo-provider';

export interface CallRecord {
  summary?: string;
  transcription?: string;
  recordingUrl?: string;
}

export interface CallProviderInput {
  phones: string[];
  alloNumbers: string[];
  sdrId: string;
  windowStart: Date;
  windowEnd: Date;
}

export interface CallProvider {
  fetchMatchingCallRecord(input: CallProviderInput): Promise<CallRecord | null>;
}

function buildProvider(): CallProvider {
  const apiKey = process.env.ALLO_API_KEY;

  if (apiKey) {
    console.log('[call-enrichment] provider=Allo (API key found)');
    return new AlloProvider(apiKey);
  }

  console.warn('[call-enrichment] provider=NOOP — ALLO_API_KEY is not set, enrichment disabled');
  // No-op until env vars are set
  return {
    fetchMatchingCallRecord: async () => {
      console.warn('[call-enrichment] fetchMatchingCallRecord: NOOP (set ALLO_API_KEY to call WithAllo)');
      return null;
    },
  };
}

export const callProvider: CallProvider = buildProvider();
