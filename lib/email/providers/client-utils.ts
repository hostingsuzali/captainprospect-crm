// ============================================
// EMAIL PROVIDER CLIENT UTILITIES
// Client-safe utilities (no server dependencies)
// ============================================

import type { EmailProvider } from '@prisma/client';

/**
 * Get display name for provider
 */
export function getProviderDisplayName(provider: EmailProvider): string {
    switch (provider) {
        case 'GMAIL':
            return 'Gmail';
        case 'OUTLOOK':
            return 'Outlook';
        case 'CUSTOM':
            return 'Custom IMAP/SMTP';
        default:
            return 'Unknown';
    }
}

/**
 * Get icon/logo path for provider
 */
export function getProviderIcon(provider: EmailProvider): string {
    switch (provider) {
        case 'GMAIL':
            return '/icons/gmail.svg';
        case 'OUTLOOK':
            return '/icons/outlook.svg';
        case 'CUSTOM':
            return '/icons/email.svg';
        default:
            return '/icons/email.svg';
    }
}

/**
 * Get brand color for provider
 */
export function getProviderColor(provider: EmailProvider): string {
    switch (provider) {
        case 'GMAIL':
            return '#EA4335'; // Google red
        case 'OUTLOOK':
            return '#0078D4'; // Microsoft blue
        case 'CUSTOM':
            return '#6366F1'; // Indigo (default)
        default:
            return '#6366F1';
    }
}

/**
 * Check if a provider is supported
 */
export function isProviderSupported(provider: EmailProvider): boolean {
    return provider === 'GMAIL' || provider === 'OUTLOOK';
}

/**
 * All supported providers info (client-safe)
 */
export const SUPPORTED_PROVIDERS: { 
    value: EmailProvider; 
    label: string; 
    icon: string;
    color: string;
    supported: boolean;
}[] = [
    {
        value: 'GMAIL',
        label: 'Gmail',
        icon: '/icons/gmail.svg',
        color: '#EA4335',
        supported: true,
    },
    {
        value: 'OUTLOOK',
        label: 'Outlook / Microsoft 365',
        icon: '/icons/outlook.svg',
        color: '#0078D4',
        supported: true,
    },
    {
        value: 'CUSTOM',
        label: 'Custom IMAP/SMTP',
        icon: '/icons/email.svg',
        color: '#6366F1',
        supported: false,
    },
];
