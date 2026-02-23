// ============================================
// VOIP REGISTRY — Resolve provider per user / from path
// ============================================

import { prisma } from "@/lib/prisma";
import type { VoipProvider } from "./types";

export async function getSdrProvider(
  userId: string
): Promise<VoipProvider | null> {
  const config = await prisma.userVoipConfig.findUnique({
    where: { userId, active: true },
  });
  if (!config?.provider) return null;
  const p = config.provider as string;
  if (p === "allo" || p === "aircall" || p === "ringover") return p;
  return null;
}

export function extractProviderFromPath(pathname: string): VoipProvider | null {
  const match = pathname.match(/\/webhook\/(allo|aircall|ringover)/);
  return match ? (match[1] as VoipProvider) : null;
}
