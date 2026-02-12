
import { createCalComBooking } from './lib/calCom';

async function test() {
    console.log('--- Testing Cal.com Phone Normalization ---');

    // MOCKING the normalized function logic to see what it does
    function normalizePhone(raw: string): string | null {
        if (!raw) return null;

        let cleaned = raw.replace(/^whatsapp:/i, '').trim();
        let hasPlus = cleaned.startsWith('+');
        let digits = cleaned.replace(/\D/g, '');

        if (digits.startsWith('00')) {
            digits = digits.slice(2);
        }

        if (!digits.startsWith('971') && !digits.startsWith('1') && !digits.startsWith('44') && !digits.startsWith('91')) {
            if (digits.startsWith('0')) {
                digits = digits.slice(1);
            }
            digits = '971' + digits;
        }

        if (digits.length < 10) {
            console.warn(`[Normalized] TOO SHORT: ${digits}`);
            return null;
        }

        if (digits.startsWith('971') && digits.length > 12) {
            console.warn(`[Normalized] TRIMMED: ${digits} -> ${digits.slice(0, 12)}`);
            digits = digits.slice(0, 12);
        }

        return '+' + digits;
    }

    const testCases = [
        '+971507150121',
        '+971 50 715 0121',
        '971507150121',
        '0507150121',
        '+9715071501219', // Too long
        '507150121'
    ];

    testCases.forEach(input => {
        console.log(`Input: "${input}" -> Result: "${normalizePhone(input)}"`);
    });
}

test();
