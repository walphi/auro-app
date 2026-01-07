import { Handler } from '@netlify/functions';
import { supabase } from '../../lib/supabase';
import { buildSite } from '../../lib/aiBuilder';
import { AgentConfig, SiteStyleProfile, AgentSiteDocument } from '../../shared/agent-sites-types';
import { TwilioWhatsAppClient } from '../../lib/twilioWhatsAppClient';

export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        console.info(`[build-site] Event body: ${event.body}`);
        const { agentId } = JSON.parse(event.body || '{}');
        if (!agentId) {
            console.error(`[build-site] Missing agentId in payload`);
            return { statusCode: 400, body: JSON.stringify({ error: 'agentId is required' }) };
        }

        console.info(`[build-site] Starting build for agentId: ${agentId}`);

        console.info(`[build-site] Fetching AgentConfig for agentId: ${agentId}`);
        const { data: configRow, error: configError } = await supabase
            .from('agentconfigs')
            .select('*')
            .eq('agent_id', agentId)
            .single();

        if (configError || !configRow) {
            console.error(`[build-site] Config lookup failed or empty`, { agentId, configError });
            return { statusCode: 404, body: JSON.stringify({ error: 'Agent config not found', detail: configError?.message }) };
        }

        console.info(`[build-site] Found config row for slug: ${configRow.slug}`);

        // Map snake_case to camelCase for the builder
        const agentConfig: AgentConfig = {
            id: configRow.id,
            agentId: configRow.agent_id,
            brokerageId: configRow.brokerage_id,
            slug: configRow.slug,
            status: configRow.status,
            name: configRow.name,
            designation: configRow.designation,
            company: configRow.company,
            reraNumber: configRow.rera_number,
            phone: configRow.phone,
            email: configRow.email,
            location: configRow.location,
            languages: configRow.languages,
            bio: configRow.bio,
            primaryColor: configRow.primary_color,
            secondaryColor: configRow.secondary_color,
            themeVariant: configRow.theme_variant,
            logoUrl: configRow.logo_url,
            profilePhotoUrl: configRow.profile_photo_url,
            areas: configRow.areas,
            propertyTypes: configRow.property_types,
            developers: configRow.developers,
            services: configRow.services,
            differentiators: configRow.differentiators,
            listings: configRow.listings,
            leadConfig: configRow.lead_config || {
                primaryChannel: 'whatsapp',
                whatsappNumber: configRow.phone,
                ctaTexts: { primary: 'Chat with me on WhatsApp' }
            },
            styleProfile: configRow.style_profile,
            needsSiteRebuild: configRow.needs_site_rebuild,
            lastBuiltAt: configRow.last_built_at,
            createdAt: configRow.created_at,
            updatedAt: configRow.updated_at,
            publishedAt: configRow.published_at
        };

        // 2. Determine Version
        const { data: latestDoc } = await supabase
            .from('agent_site_documents')
            .select('version')
            .eq('agent_id', agentId)
            .order('version', { ascending: false })
            .limit(1)
            .single();

        const nextVersion = (latestDoc?.version || 0) + 1;

        // 3. Call AI Builder
        const buildResult = await buildSite({
            agentConfig,
            styleProfile: agentConfig.styleProfile
        });

        const doc = buildResult.document;
        doc.version = nextVersion;
        doc.listings = agentConfig.listings; // Ensure runtime listings are attached

        // 4, 5 & 6. Store Document, Update Config, Log Usage (Sequential/Parallel within 15min window)
        console.info(`[build-site-background] Starting full persistence for slug: ${agentConfig.slug}`);

        // Restore full document persistence
        const docPromise = supabase.from('agent_site_documents').insert({
            agent_id: agentId,
            config_id: agentConfig.id,
            slug: agentConfig.slug,
            version: nextVersion,
            language_codes: doc.languageCodes,
            meta: doc.meta,
            theme: doc.theme,
            sections: doc.sections,
            listings: doc.listings,
            generated_at: new Date().toISOString(),
            generated_by: buildResult.model,
            token_usage: buildResult.tokenUsage
        });

        // Config update
        const configPromise = supabase.from('agentconfigs').update({
            status: 'live',
            published_at: new Date().toISOString(),
            last_built_at: new Date().toISOString(),
            needs_site_rebuild: false
        }).eq('id', agentConfig.id);

        // Usage log
        const logPromise = supabase.from('ai_usage_logs').insert({
            agent_id: agentId,
            operation: 'build_site',
            model: buildResult.model,
            input_tokens: buildResult.tokenUsage.input,
            output_tokens: buildResult.tokenUsage.output,
            latency_ms: buildResult.latencyMs,
            success: true
        });

        // Execute all persistence operations
        const [docRes, configRes, logRes] = await Promise.all([docPromise, configPromise, logPromise]);

        if (docRes.error) console.error('[build-site-background] Document persistence error:', docRes.error);
        if (configRes.error) console.error('[build-site-background] Config update error:', configRes.error);
        if (logRes.error) console.error('[build-site-background] Usage log error:', logRes.error);

        console.info(`[build-site-background] Mark LIVE complete for slug: ${agentConfig.slug}. Rows updated:`, configRes.count);

        return { statusCode: 200 };

    } catch (error: any) {
        console.error(`[build-site] Error: ${error.message}`);

        // Log failure
        if (event.body) {
            const { agentId } = JSON.parse(event.body);
            if (agentId) {
                console.log(`[build-site] site_build_failed`, {
                    agentId,
                    reason: error.message
                });
                await supabase.from('ai_usage_logs').insert({
                    agent_id: agentId,
                    operation: 'build_site',
                    success: false,
                    error_message: error.message
                });
            }
        }

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};
