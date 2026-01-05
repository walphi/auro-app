import { Handler } from '@netlify/functions';
import { supabase } from '../../lib/supabase';
import { BirdClient } from '../../lib/birdClient';
import { Agent, AgentConfig, SiteConversation } from '../../shared/agent-sites-types';

// Bird config from environment
const {
    BIRD_API_KEY,
    BIRD_WORKSPACE_ID,
    BIRD_WHATSAPP_CHANNEL_ID
} = process.env;

if (!BIRD_API_KEY || !BIRD_WORKSPACE_ID || !BIRD_WHATSAPP_CHANNEL_ID) {
    console.warn('⚠️ Missing Bird environment variables. WhatsApp functionality may fail.');
}

// Global client using env ID, but we can override per request if needed
const defaultBird = new BirdClient(
    BIRD_API_KEY || '',
    BIRD_WORKSPACE_ID || '',
    BIRD_WHATSAPP_CHANNEL_ID || ''
);

/**
 * URL Detection Helper
 */
function detectUrlType(message: string): { hasUrl: boolean; url?: string; type?: "listing" | "unknown"; source?: string } {
    const urlMatch = message.match(/https?:\/\/[^\s]+/);
    if (!urlMatch) return { hasUrl: false };

    const url = urlMatch[0];
    try {
        const domain = new URL(url).hostname;
        const portalDomains = [
            'bayut.com', 'www.bayut.com',
            'propertyfinder.ae', 'www.propertyfinder.ae',
            'dubizzle.com', 'www.dubizzle.com'
        ];

        if (portalDomains.some(d => domain.includes(d))) {
            let source = "other";
            if (domain.includes('bayut.com')) source = 'bayut';
            else if (domain.includes('propertyfinder')) source = 'propertyFinder';
            else if (domain.includes('dubizzle')) source = 'dubizzle';
            return { hasUrl: true, url, type: 'listing', source };
        }

        return { hasUrl: true, url, type: 'unknown' };
    } catch (e) {
        return { hasUrl: false };
    }
}

/**
 * Quota Management
 */
async function checkAndIncrementQuota(agentId: string): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const { data: quota } = await supabase
        .from('agent_scrape_quotas')
        .select('*')
        .eq('agent_id', agentId)
        .single();

    const nextMidnight = new Date();
    nextMidnight.setUTCHours(24, 0, 0, 0);

    if (!quota) {
        await supabase.from('agent_scrape_quotas').insert({
            agent_id: agentId,
            daily_limit: 30,
            used_today: 1,
            reset_at: nextMidnight.toISOString()
        });
        return true;
    }

    if (new Date(quota.reset_at) < new Date()) {
        await supabase.from('agent_scrape_quotas').update({
            used_today: 1,
            reset_at: nextMidnight.toISOString()
        }).eq('agent_id', agentId);
        return true;
    }

    if (quota.used_today >= quota.daily_limit) {
        return false;
    }

    await supabase.from('agent_scrape_quotas').update({
        used_today: quota.used_today + 1
    }).eq('agent_id', agentId);
    return true;
}

/**
 * Scraping Bridge Functions
 */
async function callScrapeListing(url: string, agentId: string) {
    const apiBase = process.env.URL || process.env.VITE_API_BASE_URL || 'http://localhost:8888';
    try {
        const response = await fetch(`${apiBase}/.netlify/functions/scrape-listing`, {
            method: 'POST',
            body: JSON.stringify({ url, agentId })
        });
        const res = await response.json();
        return res;
    } catch (e: any) {
        return { ok: false, error: e.message };
    }
}

async function callScrapeStyle(url: string, agentId: string) {
    const apiBase = process.env.URL || process.env.VITE_API_BASE_URL || 'http://localhost:8888';
    try {
        const response = await fetch(`${apiBase}/.netlify/functions/scrape-site-style`, {
            method: 'POST',
            body: JSON.stringify({ url, agentId })
        });
        const res = await response.json();
        return res;
    } catch (e: any) {
        return { ok: false, error: e.message };
    }
}

async function callBuildSite(agentId: string) {
    const apiBase = process.env.URL || process.env.VITE_API_BASE_URL || 'http://localhost:8888';
    try {
        const response = await fetch(`${apiBase}/.netlify/functions/build-site`, {
            method: 'POST',
            body: JSON.stringify({ agentId })
        });
        const res = await response.json();
        return res;
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export const handler: Handler = async (event) => {
    // Signature validation placeholder
    console.warn("Skipping signature validation in dev");

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const payload = JSON.parse(event.body || '{}');
        console.log("FULL BIRD PAYLOAD:", JSON.stringify(payload, null, 2));

        // Bird sends message events in a specific format
        // Ref: https://docs.bird.com/api/messages-v2/webhook-events
        if (payload.event !== 'message.created' && payload.type !== 'message.created') {
            // Some Bird webhooks use 'type' or have different event names
            // For 'message.created' usually it's message.created
            if (!payload.message) return { statusCode: 200, body: 'Ignoring non-message event' };
        }

        const message = payload.message || payload.data;
        if (!message || message.direction !== 'received') {
            console.log("Non-inbound or missing message, ignoring.");
            return { statusCode: 200, body: 'Not an incoming message' };
        }

        // Identify the agent (sender)
        const from = message.sender?.contacts?.[0]?.identifierValue;
        const incomingChannelId = message.channelId;

        if (!from) {
            console.error('Could not identify sender from Bird payload');
            return { statusCode: 200, body: 'No sender identified' };
        }

        const text = message.body.text?.text || '';
        console.log(`Incoming message from ${from} on channel ${incomingChannelId}: "${text}"`);

        // Use the incoming channelId if available
        const requestBird = incomingChannelId
            ? new BirdClient(BIRD_API_KEY || '', BIRD_WORKSPACE_ID || '', incomingChannelId)
            : defaultBird;

        // 1. Find or Create Agent
        let { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('*')
            .eq('phone', from)
            .single();

        if (!agent) {
            // Create new agent
            const { data: newAgent, error: createError } = await supabase
                .from('agents')
                .insert({
                    phone: from,
                    status: 'onboarding'
                })
                .select()
                .single();

            if (createError) throw createError;
            agent = newAgent;
        }

        // 2. Get or Create Conversation State
        let { data: conversation, error: convError } = await supabase
            .from('site_conversations')
            .select('*')
            .eq('agent_id', agent.id)
            .single();

        if (!conversation) {
            const { data: newConv, error: createConvError } = await supabase
                .from('site_conversations')
                .insert({
                    agent_id: agent.id,
                    current_state: 'IDENTIFY_AGENT',
                    state_data: {}
                })
                .select()
                .single();

            if (createConvError) throw createConvError;
            conversation = newConv;
        }

        // 3. Process State Machine
        console.log(`Processing state machine for agent ${agent.id} in state ${conversation.current_state}`);
        await processStateMachine(agent, conversation, text, requestBird);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };
    } catch (error: any) {
        console.error('Error in whatsapp-bird handler:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

async function processStateMachine(agent: any, conversation: any, text: string, birdClient: BirdClient) {
    const currentState = conversation.current_state;
    let nextState = currentState;
    let replyText = '';
    let stateData = conversation.state_data || {};

    // Find or create agent_config
    let { data: config } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('agent_id', agent.id)
        .single();

    if (!config && currentState !== 'IDENTIFY_AGENT') {
        // Create initial config if we've started collecting info
        const { data: newConfig } = await supabase
            .from('agent_configs')
            .insert({
                agent_id: agent.id,
                slug: agent.phone.replace('+', ''), // Default slug
                status: 'draft',
                name: stateData.name || '',
                needs_site_rebuild: true
            })
            .select()
            .single();
        config = newConfig;
    }

    switch (currentState) {
        case 'IDENTIFY_AGENT':
            replyText = "Welcome to Auro Agent Sites! 🏠 Let's build your professional real estate website in minutes.\n\nWhat is your full name?";
            nextState = 'COLLECT_NAME';
            break;

        case 'COLLECT_NAME':
            stateData.name = text;
            replyText = `Nice to meet you, ${text}. What is your RERA/BRN number? (or type "skip")`;
            nextState = 'COLLECT_RERA';
            if (config) await supabase.from('agent_configs').update({ name: text }).eq('id', config.id);
            break;

        case 'COLLECT_RERA':
            stateData.reraNumber = text;
            replyText = "Which brokerage or company are you with?";
            nextState = 'COLLECT_COMPANY';
            if (config) await supabase.from('agent_configs').update({ rera_number: text }).eq('id', config.id);
            break;

        case 'COLLECT_COMPANY':
            stateData.company = text;
            replyText = "What is your designation? (e.g., Senior Property Consultant, Broker)";
            nextState = 'COLLECT_DESIG';
            if (config) await supabase.from('agent_configs').update({ company: text }).eq('id', config.id);
            break;

        case 'COLLECT_DESIG':
            stateData.designation = text;
            replyText = "Perfect. Now, tell me a bit about yourself (a short bio). This will appear on your 'About' section.";
            nextState = 'COLLECT_BIO';
            if (config) await supabase.from('agent_configs').update({ designation: text }).eq('id', config.id);
            break;

        case 'COLLECT_BIO':
            stateData.bio = text;
            replyText = "Great story! 📸 Now, please send me your professional profile photo (attach it as an image or send a URL).";
            nextState = 'COLLECT_PHOTO';
            if (config) await supabase.from('agent_configs').update({ bio: text }).eq('id', config.id);
            break;

        case 'COLLECT_PHOTO':
            // For MVP, we'll assume text is the URL if no media, or handle media later
            stateData.profilePhotoUrl = text;
            replyText = "Photo received! Do you have a company logo? Send it now, or type 'skip'.";
            nextState = 'COLLECT_LOGO';
            if (config) await supabase.from('agent_configs').update({ profile_photo_url: text }).eq('id', config.id);
            break;

        case 'COLLECT_LOGO':
            stateData.logoUrl = text === 'skip' ? null : text;
            replyText = "What colors represent your brand? Send two hex codes (e.g., #1a365d, #c9a227) or describe them (e.g. 'Gold and Black').";
            nextState = 'COLLECT_COLORS';
            if (config && text !== 'skip') await supabase.from('agent_configs').update({ logo_url: text }).eq('id', config.id);
            break;

        case 'COLLECT_COLORS':
            stateData.colors = text;
            replyText = "Which areas do you specialize in? (e.g., Dubai Marina, Palm Jumeirah, Downtown). Separate with commas.";
            nextState = 'COLLECT_AREAS';
            // Basic color parsing could go here
            break;

        case 'COLLECT_AREAS':
            const areas = text.split(',').map(s => s.trim());
            stateData.areas = areas;
            replyText = "Got it. What types of properties do you focus on? (e.g., Apartments, Villas, Penthouses).";
            nextState = 'COLLECT_TYPES';
            if (config) await supabase.from('agent_configs').update({ areas }).eq('id', config.id);
            break;

        case 'COLLECT_TYPES':
            const types = text.split(',').map(s => s.trim());
            stateData.propertyTypes = types;
            replyText = "Any specific developers you work with? (e.g., Emaar, Damac, Nakheel) or type 'skip'.";
            nextState = 'COLLECT_DEVS';
            if (config) await supabase.from('agent_configs').update({ property_types: types }).eq('id', config.id);
            break;

        case 'COLLECT_DEVS':
            const devs = text === 'skip' ? [] : text.split(',').map(s => s.trim());
            stateData.developers = devs;
            replyText = "What services do you offer? (e.g., Buying, Selling, Renting, Advisory).";
            nextState = 'COLLECT_SERVICES';
            if (config) await supabase.from('agent_configs').update({ developers: devs }).eq('id', config.id);
            break;

        case 'COLLECT_SERVICES':
            const services = text.split(',').map(s => s.trim());
            stateData.services = services;
            replyText = "Excellent! Time to add your listings. 🏘️\n\nYou can send me a URL from Bayut or Property Finder, or type 'manual' to enter details. Type 'done' when finished.";
            nextState = 'LISTINGS_LOOP';
            if (config) await supabase.from('agent_configs').update({ services }).eq('id', config.id);
            break;

        case 'LISTINGS_LOOP':
            const urlInfo = detectUrlType(text);
            if (text.toLowerCase() === 'done') {
                replyText = "Great portfolio! Now let's set up how leads reach you.\n\nWhich channel do you prefer for leads? (whatsapp, phone, or email)";
                nextState = 'COLLECT_LEAD_CONFIG_CHANNEL';
            } else if (text.toLowerCase() === 'manual') {
                replyText = "Manual entry started. What is the title of the property? (e.g., 'Luxury 3BR in Marina')";
                nextState = 'MANUAL_LISTING_TITLE';
                stateData.currentListing = {};
            } else if (urlInfo.hasUrl) {
                const canScrape = await checkAndIncrementQuota(agent.id);
                if (!canScrape) {
                    replyText = "You've reached your daily scraping limit (30 URLs). Please enter the details manually by typing 'manual', or type 'done'.";
                    nextState = 'LISTINGS_LOOP';
                } else {
                    stateData.pendingUrl = urlInfo.url;
                    if (urlInfo.type === 'listing') {
                        replyText = "I see a listing URL! Fetching details... ⏳";
                        await birdClient.sendTextMessage(agent.phone, replyText); // Send immediate feedback

                        const res = await callScrapeListing(urlInfo.url!, agent.id);
                        if (res.ok) {
                            stateData.scrapedDraft = res.data;
                            replyText = `I found: ${res.data.title} in ${res.data.towerOrCommunity} for ${res.data.price} ${res.data.currency}.\n\nReply 'save' to add it, or 'skip' to ignore.`;
                            nextState = 'CONFIRM_LISTING';
                        } else {
                            replyText = `Scraping failed: ${res.error || 'Unknown error'}. Please enter details manually by typing 'manual', or try another URL.`;
                            nextState = 'LISTINGS_LOOP';
                        }
                    } else {
                        replyText = "I see a website URL. Is this for style inspiration? Reply 'style' to analyze it or 'skip'.";
                        nextState = 'CONFIRM_STYLE_ACTION';
                    }
                }
            } else {
                replyText = "Please send a listing URL, type 'manual', or type 'done' to finish.";
            }
            break;

        case 'CONFIRM_LISTING':
            if (text.toLowerCase() === 'save') {
                if (config) {
                    const listings = config.listings || [];
                    listings.push({
                        ...stateData.scrapedDraft,
                        id: `lst_${Date.now()}`,
                        source: 'portal',
                        status: 'available',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                    await supabase.from('agent_configs').update({ listings, needs_site_rebuild: true }).eq('id', config.id);
                }
                replyText = "Listing added! Send another URL, type 'manual', or 'done'.";
            } else {
                replyText = "Skipped. Send another URL, type 'manual', or 'done'.";
            }
            stateData.scrapedDraft = null;
            nextState = 'LISTINGS_LOOP';
            break;

        case 'CONFIRM_STYLE_ACTION':
            if (text.toLowerCase() === 'style') {
                replyText = "Analyzing site style... 🎨";
                await birdClient.sendTextMessage(agent.phone, replyText);

                const res = await callScrapeStyle(stateData.pendingUrl, agent.id);
                if (res.ok) {
                    stateData.pendingStyle = res.data;
                    replyText = `Calculated Style: Colors (${res.data.primaryColor}, ${res.data.secondaryColor}), Tone: ${res.data.toneHints?.join(', ') || 'N/A'}.\n\nReply 'apply' to use this style or 'skip'.`;
                    nextState = 'CONFIRM_STYLE';
                } else {
                    replyText = `Analysis failed: ${res.error || 'Unknown error'}. Send a listing URL, 'manual', or 'done'.`;
                    nextState = 'LISTINGS_LOOP';
                }
            } else {
                replyText = "No problem. Send a listing URL, 'manual', or 'done'.";
                nextState = 'LISTINGS_LOOP';
            }
            break;

        case 'CONFIRM_STYLE':
            if (text.toLowerCase() === 'apply') {
                if (config) {
                    await supabase.from('agent_configs').update({
                        style_profile: stateData.pendingStyle,
                        primary_color: stateData.pendingStyle.primaryColor,
                        secondary_color: stateData.pendingStyle.secondaryColor,
                        needs_site_rebuild: true
                    }).eq('id', config.id);
                }
                replyText = "Style applied! 🎨 Send a listing URL, 'manual', or 'done'.";
            } else {
                replyText = "Style ignored. Send a listing URL, 'manual', or 'done'.";
            }
            stateData.pendingStyle = null;
            nextState = 'LISTINGS_LOOP';
            break;

        case 'COLLECT_LEAD_CONFIG_CHANNEL':
            const channel = text.toLowerCase();
            if (['whatsapp', 'phone', 'email'].includes(channel)) {
                stateData.leadChannel = channel;
                replyText = "What text should appear on your main call-to-action button? (e.g., 'Chat with me on WhatsApp')";
                nextState = 'COLLECT_LEAD_CONFIG_CTA';
            } else {
                replyText = "Please choose: whatsapp, phone, or email.";
            }
            break;

        case 'COLLECT_LEAD_CONFIG_CTA':
            stateData.leadCTA = text;
            const leadConfig = {
                primaryChannel: stateData.leadChannel,
                whatsappNumber: agent.phone, // Default to agent's phone
                ctaTexts: {
                    primary: text
                }
            };
            if (config) await supabase.from('agent_configs').update({ lead_config: leadConfig }).eq('id', config.id);
            replyText = "Got it. Which languages should your site support? (EN, AR, or BOTH)";
            nextState = 'COLLECT_LANGUAGES';
            break;

        case 'COLLECT_LANGUAGES':
            let langs = ['en'];
            if (text.toLowerCase() === 'ar') langs = ['ar'];
            else if (text.toLowerCase() === 'both') langs = ['en', 'ar'];

            stateData.languages = langs;
            if (config) await supabase.from('agent_configs').update({ languages: langs, needs_site_rebuild: true }).eq('id', config.id);
            replyText = "Nearly finished! Choose a URL slug for your site (e.g., sarah-ahmed)";
            nextState = 'COLLECT_SLUG';
            break;

        case 'MANUAL_LISTING_TITLE':
            stateData.currentListing.title = text;
            replyText = "Which tower or community is it in? (e.g., Marina Gate, Palm Jumeirah)";
            nextState = 'MANUAL_LISTING_COMMUNITY';
            break;

        case 'MANUAL_LISTING_COMMUNITY':
            stateData.currentListing.towerOrCommunity = text;
            replyText = "Is this for 'sale' or 'rent'?";
            nextState = 'MANUAL_LISTING_TYPE';
            break;

        case 'MANUAL_LISTING_TYPE':
            stateData.currentListing.type = text.toLowerCase() === 'sale' ? 'sale' : 'rent';
            replyText = "What is the price? (Just the number, e.g., 2500000)";
            nextState = 'MANUAL_LISTING_PRICE';
            break;

        case 'MANUAL_LISTING_PRICE':
            stateData.currentListing.price = parseFloat(text.replace(/,/g, ''));
            replyText = "How many bedrooms?";
            nextState = 'MANUAL_LISTING_BEDS';
            break;

        case 'MANUAL_LISTING_BEDS':
            stateData.currentListing.beds = parseInt(text);
            replyText = "How many bathrooms?";
            nextState = 'MANUAL_LISTING_BATHS';
            break;

        case 'MANUAL_LISTING_BATHS':
            stateData.currentListing.baths = parseInt(text);
            replyText = "What is the size in SqFt?";
            nextState = 'MANUAL_LISTING_SIZE';
            break;

        case 'MANUAL_LISTING_SIZE':
            stateData.currentListing.sizeSqft = parseInt(text);
            replyText = "Almost done! Send an image for this property (or a URL). Type 'done' to save this listing.";
            nextState = 'MANUAL_LISTING_PHOTOS';
            break;

        case 'MANUAL_LISTING_PHOTOS':
            if (text.toLowerCase() === 'done') {
                // Save the listing to config
                if (config) {
                    const listings = config.listings || [];
                    listings.push({
                        ...stateData.currentListing,
                        id: `lst_${Date.now()}`,
                        currency: 'AED',
                        source: 'manual',
                        status: 'available',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                    await supabase.from('agent_configs').update({ listings }).eq('id', config.id);
                }
                stateData.currentListing = null;
                replyText = "Listing saved! 🏆 Add another? Send a URL, type 'manual', or type 'done' to finish.";
                nextState = 'LISTINGS_LOOP';
            } else {
                stateData.currentListing.photos = stateData.currentListing.photos || [];
                stateData.currentListing.photos.push(text);
                replyText = "Photo added! Send another, or type 'done' to finish this listing.";
            }
            break;

        case 'COLLECT_SLUG':
            stateData.slug = text.toLowerCase().replace(/\s+/g, '-');
            replyText = `Preview your site details:\n\nName: ${stateData.name}\nCompany: ${stateData.company}\nSlug: ${stateData.slug}\n\nType 'publish' to generate your site! 🚀`;
            nextState = 'PREVIEW_SUMMARY';
            if (config) await supabase.from('agent_configs').update({ slug: stateData.slug }).eq('id', config.id);
            break;

        case 'PREVIEW_SUMMARY':
            if (text.toLowerCase() === 'publish') {
                replyText = "Building your site with Claude... 🤖 This takes about 30 seconds. I'll message you once it's live!";
                await birdClient.sendTextMessage(agent.phone, replyText);

                const res = await callBuildSite(agent.id);
                if (res.success) {
                    await birdClient.sendTextMessage(agent.phone, `Done! Your site is live at: ${res.siteUrl} 🚀`);
                    nextState = 'CMS_MODE';
                } else {
                    await birdClient.sendTextMessage(agent.phone, `Site build failed: ${res.error || 'Unknown error'}. You can try typing 'publish' again or send a listing to update.`);
                    nextState = 'PREVIEW_SUMMARY';
                }
            } else {
                replyText = "Type 'publish' when you're ready!";
            }
            break;

        case 'CMS_MODE':
            const cmd = text.toUpperCase();
            if (cmd.startsWith('ADD LISTING')) {
                replyText = "Sure! Send a listing URL or type 'manual'.";
                nextState = 'LISTINGS_LOOP';
            } else if (cmd.startsWith('UPDATE PRICE')) {
                replyText = "To update a price, please tell me the property title and the new price. (e.g., 'Marina Gate 2 2900000')";
                nextState = 'CMS_UPDATE_PRICE';
            } else if (cmd.startsWith('UPDATE BIO')) {
                replyText = "Send me your new bio:";
                nextState = 'CMS_UPDATE_BIO';
            } else if (cmd.startsWith('CHANGE COLORS')) {
                replyText = "Send me the new colors (e.g. #000, #fff):";
                nextState = 'CMS_CHANGE_COLORS';
            } else if (cmd.startsWith('HELP')) {
                replyText = "Available commands:\n- ADD LISTING\n- UPDATE PRICE\n- UPDATE BIO\n- CHANGE COLORS\n- VIEW SITE";
            } else {
                replyText = "I didn't recognize that command. Type 'HELP' for a list of commands.";
            }
            break;

        case 'CMS_UPDATE_BIO':
            if (config) await supabase.from('agent_configs').update({ bio: text, needs_site_rebuild: true }).eq('id', config.id);
            replyText = "Bio updated! Site rebuild triggered. ✅";
            nextState = 'CMS_MODE';
            break;

        case 'CMS_CHANGE_COLORS':
            const colors = text.split(',').map(c => c.trim());
            if (config) await supabase.from('agent_configs').update({
                primary_color: colors[0],
                secondary_color: colors[1] || colors[0],
                needs_site_rebuild: true
            }).eq('id', config.id);
            replyText = "Colors updated! Site rebuild triggered. ✅";
            nextState = 'CMS_MODE';
            break;

        case 'CMS_UPDATE_PRICE':
            // Simple space split for title and price
            const parts = text.split(' ');
            const newPrice = parseFloat(parts.pop() || '0');
            const title = parts.join(' ');
            if (config && config.listings) {
                const updatedListings = config.listings.map((l: any) =>
                    l.title.toLowerCase().includes(title.toLowerCase()) ? { ...l, price: newPrice } : l
                );
                await supabase.from('agent_configs').update({ listings: updatedListings, needs_site_rebuild: true }).eq('id', config.id);
                replyText = `Price for "${title}" updated to ${newPrice}! Site rebuild triggered. ✅`;
            } else {
                replyText = "Could not find that listing.";
            }
            nextState = 'CMS_MODE';
            break;

        default:
            replyText = "I'm not sure what to do next. Type 'help' to see what I can do.";
    }

    // ENSURE GREETING: If this was the first message and IDENTIFY_AGENT was triggered, 
    // the replyText should already be set to the welcome message.
    if (!replyText) {
        replyText = "Hi! I'm your Auro assistant. Type 'start' to begin building your site.";
    }

    // Update DB
    await supabase
        .from('site_conversations')
        .update({
            current_state: nextState,
            state_data: stateData,
            last_message_at: new Date().toISOString()
        })
        .eq('id', conversation.id);

    // If we just created the agent or started, we might want to update the agent/config too
    if (currentState !== 'IDENTIFY_AGENT') {
        // Sync to agent_configs as we go or at the end
        // For MVP, let's sync basic info once we have it
    }

    console.log(`REPLYING to ${agent.phone} with: "${replyText}"`);
    try {
        await birdClient.sendTextMessage(agent.phone, replyText);
        console.log("Bird reply sent successfully.");
    } catch (e: any) {
        console.error("FAILED TO SEND BIRD REPLY:", e.message);
    }
}
