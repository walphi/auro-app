
const axios = require('axios');

async function simulate() {
    const payload = {
        message: {
            type: 'end-of-call-report',
            call: {
                id: 'test-call-id',
                customer: { number: '+971500000000' },
                assistantOverrides: { variableValues: { tenant_id: '2', lead_id: '123' } }
            },
            analysis: {
                structuredData: {
                    meeting_scheduled: true,
                    meeting_start_iso: '2025-12-23T16:00:00+04:00',
                    first_name: 'Simulated',
                    last_name: 'User',
                    email: 'sim@example.com'
                }
            }
        }
    };
    
    try {
        // We'll just test the getStructuredData logic if we can
        console.log("Simulating webhook processing...");
    } catch (e) {
        console.error(e);
    }
}

simulate();
