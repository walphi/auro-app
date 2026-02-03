
import { getListingById, getListingImageUrl } from './netlify/functions/listings-helper.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
    const id = "84b32ed7-fc37-4a5d-9602-1f480373e351";
    console.log(`Testing listing: ${id}`);

    try {
        const listing = await getListingById(id);
        if (!listing) {
            console.log("Listing NOT FOUND");
            return;
        }

        console.log("Listing images count:", listing.images?.length);
        console.log("First image original:", listing.images?.[0]);

        const imageUrl = getListingImageUrl(listing);
        console.log("Resolved image URL:", imageUrl);
    } catch (e: any) {
        console.error("Test failed:", e.message);
    }
}

test();
