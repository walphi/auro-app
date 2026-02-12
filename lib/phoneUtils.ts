/**
 * Global Phone Number Utility for E.164 Normalization.
 * Implements strict rules as requested: customer.number (Vapi) > lead.phone (Supabase) > structured.phone (Assistant).
 */

/**
 * Normalizes any string to a valid E.164 phone number with a leading '+'.
 * Optimized for UAE numbers and international fallbacks.
 * 
 * Rules:
 * - UAE numbers starting with 971 -> +971...
 * - Local UAE numbers starting with 05 -> +9715...
 * - Shorthand UAE numbers starting with 5 -> +9715...
 * - Generic international: if no leading 0, assume it's already a CC and prefix +
 * - Generic international: if starts with 00, drop 00 and prefix +
 */
export function normalizePhone(raw: string | undefined | null): string {
    if (!raw) return "";

    // Strip all non-digit characters
    const digits = raw.replace(/\D/g, "");

    if (!digits) return "";

    // 1. UAE convenience branch
    if (digits.startsWith("971")) {
        return `+${digits}`;
    }
    if (digits.startsWith("05")) {
        return `+971${digits.slice(1)}`;
    }
    if (digits.startsWith("5") && digits.length === 9) {
        // Standard UAE mobile without CC or leading zero is 9 digits (e.g. 507150812)
        return `+971${digits}`;
    }
    // User's specific rule: "if starts with 5" -> +9715... (regardless of length for now to be safe)
    if (digits.startsWith("5")) {
        return `+971${digits}`;
    }

    // 2. Generic international logic

    // If it already looks like a full international number (no leading 0), just prefix +
    if (!digits.startsWith("0")) {
        return `+${digits}`;
    }

    // If it starts with 00 (common intl prefix), drop 00 and prefix +
    if (digits.startsWith("00")) {
        return `+${digits.slice(2)}`;
    }

    // Otherwise, prefix + and leave as-is (caller must send country code if it doesn't match above)
    return `+${digits}`;
}

/**
 * Resolves the primary phone number based on global source priority:
 * 1. Customer Number (Vapi)
 * 2. Lead Phone (Supabase)
 * 3. Structured Phone (Assistant Data)
 */
export function resolvePrioritizedPhone(vapiPhone?: string, leadPhone?: string, assistantPhone?: string): string {
    const chosen = vapiPhone || leadPhone || assistantPhone || "";
    return normalizePhone(chosen);
}
