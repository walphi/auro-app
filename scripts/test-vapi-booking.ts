
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

function getStructuredData(body: any): any {
    const analysis = body.message?.analysis || body.call?.analysis || {};
    const artifact = body.message?.artifact || body.call?.artifact || {};
    const structuredOutputs = artifact.structuredOutputs || {};
    const outputsArray = Object.values(structuredOutputs) as any[];

    const consolidated = outputsArray.find((o: any) =>
        o.name === 'Morgan Booking' ||
        o.name === 'Consultation Booking' ||
        (o.result && o.result.meeting_scheduled !== undefined && o.result.meeting_start_iso !== undefined)
    );

    if (consolidated) {
        console.log("[VAPI] Found consolidated booking artifact:", consolidated.name);
        return consolidated.result || {};
    }

    const harvested: any = {};
    const fieldsToHarvest = [
        'meeting_scheduled', 'meeting_start_iso', 'first_name', 'last_name',
        'email', 'phone', 'budget', 'property_type', 'preferred_area'
    ];

    outputsArray.forEach(o => {
        if (o.name && fieldsToHarvest.includes(o.name)) {
            harvested[o.name] = o.result;
        }
    });

    if (harvested.meeting_scheduled !== undefined) {
        console.log("[VAPI] Successfully harvested individual structured fields:", Object.keys(harvested));
        return harvested;
    }

    const fallback = analysis.structuredData;
    if (fallback) {
        console.log("[VAPI] Using analysis.structuredData fallback");
        return fallback;
    }

    return {};
}

async function runTest() {
    console.log("--- Starting Vapi Booking Simulation ---");

    const syntheticPayload = {
        message: {
            type: "end-of-call-report",
            call: { id: "test-call-id" },
            artifact: {
                structuredOutputs: {
                    "id1": { name: "meeting_scheduled", result: true },
                    "id2": { name: "meeting_start_iso", result: "2026-02-06T14:00:00+04:00" },
                    "id3": { name: "first_name", result: "Philip" },
                    "id4": { name: "last_name", result: "Walsh" },
                    "id5": { name: "email", result: "pw@mael.media" },
                    "id6": { name: "phone", result: "+971500000000" }
                }
            }
        }
    };

    const structuredData = getStructuredData(syntheticPayload);
    console.log("Extracted Structured Data:", JSON.stringify(structuredData, null, 2));

    if (structuredData.meeting_scheduled === true || structuredData.meeting_scheduled === 'true') {
        const meetingStartIso = structuredData.meeting_start_iso;
        if (meetingStartIso) {
            console.log(`[VAPI] Simulating Cal.com booking...`);
            const details = {
                eventTypeId: 4644939,
                start: meetingStartIso,
                name: `${structuredData.first_name || ''} ${structuredData.last_name || ''}`.trim(),
                email: structuredData.email,
                phoneNumber: structuredData.phone,
                metadata: {
                    source: 'Simulator',
                    lead_id: 'test-lead-uuid',
                    tenant_id: 1,
                    call_id: syntheticPayload.message.call.id
                }
            };

            console.log("Cal.com Payload Construction SUCCESS.");
            console.log("Payload:", JSON.stringify(details, null, 2));

            try {
                const { createCalComBooking } = await import('../lib/calCom');
                console.log("Calling createCalComBooking...");
                const result = await createCalComBooking(details);
                console.log("SUCCESS:", JSON.stringify(result, null, 2));
            } catch (err: any) {
                console.error("CALCOM ERROR (Reachable!):", err.message);
            }
        }
    }
}

runTest();
