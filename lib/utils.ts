// Suzalink CRM Utility Functions
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Date formatting utilities
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Completeness status helpers
export type CompletenessStatus = "INCOMPLETE" | "PARTIAL" | "ACTIONABLE";

export function getStatusColor(status: CompletenessStatus): string {
  const colors = {
    INCOMPLETE: "text-red-500",
    PARTIAL: "text-orange-500",
    ACTIONABLE: "text-green-500",
  };
  return colors[status];
}

export function getStatusEmoji(status: CompletenessStatus): string {
  const emojis = {
    INCOMPLETE: "🔴",
    PARTIAL: "🟠",
    ACTIONABLE: "🟢",
  };
  return emojis[status];
}
