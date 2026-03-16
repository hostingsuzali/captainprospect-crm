"use client";

import { useCallback, useRef } from "react";

export interface UseMeetingActionsReturn {
  updateMeeting: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteMeetings: (ids: string[]) => Promise<void>;
}

export function useMeetingActions(
  onSuccess: () => void
): UseMeetingActionsReturn {
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const updateMeeting = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/manager/rdv/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (res.ok) onSuccessRef.current();
      } catch (e) {
        console.error("Update failed:", e);
      }
    },
    []
  );

  const deleteMeetings = useCallback(async (ids: string[]) => {
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/manager/rdv/${id}`, { method: "DELETE" })
      )
    );
    onSuccessRef.current();
  }, []);

  return { updateMeeting, deleteMeetings };
}
