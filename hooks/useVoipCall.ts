"use client";

import { useState, useCallback } from "react";

export type VoipCallState = "idle" | "initiating" | "ringing" | "in_call";

export interface VoipInitiateResponse {
  actionId: string;
  callMethod: "api" | "callback" | "tel_link";
  telLink?: string;
  provider: string;
}

const NO_VOIP_CONFIG_MESSAGE = "Configurez votre provider VOIP dans les paramètres";

export interface UseVoipCallOptions {
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
  /** When no VoIP config: still open tel: link so SDR can call manually */
  onFallbackToTel?: (phone: string) => void;
}

export function useVoipCall(options: UseVoipCallOptions = {}) {
  const [state, setState] = useState<VoipCallState>("idle");
  const [currentActionId, setCurrentActionId] = useState<string | null>(null);
  const { onError, onSuccess, onFallbackToTel } = options;

  const initiateCall = useCallback(
    async (params: {
      contactId?: string;
      companyId?: string;
      phone: string;
      campaignId?: string;
      missionId?: string;
    }) => {
      if (!params.phone?.trim()) {
        onError?.("Numéro requis");
        return;
      }
      setState("initiating");
      setCurrentActionId(null);
      try {
        const res = await fetch("/api/voip/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: params.contactId,
            companyId: params.companyId,
            phone: params.phone.trim(),
            campaignId: params.campaignId,
            missionId: params.missionId,
          }),
        });
        const json = await res.json();

        if (!json.success) {
          setState("idle");
          const message = json.error ?? "Erreur lors de l'initiation de l'appel";
          onError?.(message);
          if (
            onFallbackToTel &&
            (message.includes("provider VOIP") || message === NO_VOIP_CONFIG_MESSAGE)
          ) {
            onFallbackToTel(params.phone.trim());
          }
          return;
        }

        const data = json.data as VoipInitiateResponse;
        setCurrentActionId(data.actionId || null);
        setState("ringing");

        if (data.callMethod === "tel_link" && data.telLink) {
          window.open(data.telLink, "_self");
          onSuccess?.(
            `Appelez depuis ${data.provider} — le résumé arrivera automatiquement`
          );
        } else if (data.callMethod === "callback") {
          onSuccess?.(
            "Votre téléphone va sonner — décrochez pour être mis en relation"
          );
        } else {
          onSuccess?.("Décrochez votre softphone...");
        }
      } catch {
        setState("idle");
        onError?.("Impossible de lancer l'appel");
      }
    },
    [onError, onSuccess, onFallbackToTel]
  );

  const reset = useCallback(() => {
    setState("idle");
    setCurrentActionId(null);
  }, []);

  return {
    state,
    initiateCall,
    currentActionId,
    reset,
  };
}
