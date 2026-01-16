import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function patchPhillip() {
    console.log("Searching for phillip-walsh...");
    const { data: configs, error: configError } = await supabase
        .from('agentconfigs')
        .select('*')
        .eq('slug', 'phillip-walsh');

    if (configError) {
        console.error("Config fetch error:", configError);
        return;
    }

    if (!configs || configs.length === 0) {
        console.log("No config found for phillip-walsh.");
        return;
    }

    const config = configs[0];
    console.log("Found config:", config.id, "for agent:", config.agent_id);

    const patch = {
        primary_color: "#1a1a2e",
        secondary_color: "#c9a227",
        bio: "With over a decade of experience in Dubai's ultra-luxury property market, I specialize in connecting discerning clients with exceptional residences in the world's most coveted developments. From Palm Jumeirah penthouses to Downtown Dubai sky mansions, I provide white-glove service for buyers who demand nothing less than perfection.",
        designation: "Senior Luxury Property Consultant",
        company: "Premium Properties Dubai",
        style_profile: {
            ...config.style_profile,
            synthesized_style: {
                primary_mood: "dark_luxury",
                layout_preferences: {
                    hero_style: "full_viewport_video",
                    section_spacing: "generous",
                    image_treatment: "full_bleed"
                },
                ui_elements: {
                    button_style: "outlined_gold",
                    navigation_style: "floating_transparent"
                }
            }
        },
        needs_site_rebuild: true
    };

    console.log("Applying patch...");
    const { data: updated, error: updateError } = await supabase
        .from('agentconfigs')
        .update(patch)
        .eq('id', config.id)
        .select();

    if (updateError) {
        console.error("Update error:", updateError);
    } else {
        console.log("Successfully updated Phillip Walsh config.");
    }
}

patchPhillip();
