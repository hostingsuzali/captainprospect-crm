import { Client } from "@upstash/qstash";

export interface VoipEventJobData {
  provider: string;
  rawPayload: unknown;
  receivedAt: string;
}

let qstashClient: Client | null = null;

function getQStashClient(): Client {
  if (!qstashClient) {
    const token = process.env.QSTASH_TOKEN;
    if (!token) throw new Error("QSTASH_TOKEN is not set");
    qstashClient = new Client({
      baseUrl: process.env.QSTASH_URL ?? "https://qstash-eu-central-1.upstash.io",
      token,
    });
  }
  return qstashClient;
}

/**
 * Publish a VoIP event to QStash.
 * QStash will call POST /api/voip/process with the payload,
 * with automatic retries and deduplication.
 */
export async function scheduleVoipEvent(
  data: VoipEventJobData,
): Promise<{ messageId: string }> {
  const client = getQStashClient();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL or VERCEL_URL is not set");

  const baseUrl = appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;

  const result = await client.publishJSON({
    url: `${baseUrl}/api/voip/process`,
    body: data,
    retries: 3,
  });

  return { messageId: result.messageId };
}
