
import axios from 'axios';

const src = "https://d3h330vgpwpjr8.cloudfront.net/x/464x312/Feature_69a5d2a656.webp";

async function test() {
    console.log(`Fetching: ${src}`);
    try {
        const response = await axios.get(src, {
            responseType: 'arraybuffer',
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Referer': 'https://providentestate.com/'
            }
        });
        console.log(`Success! Status: ${response.status}, Length: ${response.data.length}, Type: ${response.headers['content-type']}`);
    } catch (error: any) {
        console.error(`Failed: ${error.message}`);
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(error.response.headers);
        }
    }
}

test();
