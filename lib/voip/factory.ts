// ============================================
// VOIP FACTORY — Single entry point for adapters
// ============================================

import { prisma } from "@/lib/prisma";
import { AlloAdapter } from "./providers/allo/adapter";
import { AircallAdapter } from "./providers/aircall/adapter";
import { RingoverAdapter } from "./providers/ringover/adapter";
import type { VoipAdapter, VoipProvider } from "./types";

const adapters: Record<VoipProvider, VoipAdapter> = {
  allo: new AlloAdapter(),
  aircall: new AircallAdapter(),
  ringover: new RingoverAdapter(),
};

export function getVoipAdapter(provider: VoipProvider): VoipAdapter {
  const adapter = adapters[provider];
  if (!adapter) throw new Error(`Provider inconnu: ${provider}`);
  return adapter;
}

export async function getAdapterForUser(userId: string): Promise<VoipAdapter> {
  const config = await prisma.userVoipConfig.findUnique({
    where: { userId, active: true },
  });
  if (!config?.provider)
    throw new Error("Ce SDR n'a pas de provider VOIP configuré");
  const provider = config.provider as VoipProvider;
  if (!["allo", "aircall", "ringover"].includes(provider))
    throw new Error(`Provider invalide: ${provider}`);
  return getVoipAdapter(provider);
}
