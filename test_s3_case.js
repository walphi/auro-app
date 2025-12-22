import axios from 'axios';

async function test() {
    const urls = [
        'https://ggfx-providentestate.s3.eu-west-2.amazonaws.com/i/property/PS-03122535/images/iblock/7e2/7e22d8b6f8f146005f58c9c9f75d0092/ADU00425.jpg',
        'https://ggfx-providentestate.s3.eu-west-2.amazonaws.com/i/property/PS-03122535/images/iblock/7e2/7e22d8b6f8f146005f58c9c9f75d0092/ADU00425.JPG'
    ];

    for (const url of urls) {
        try {
            console.log(`Testing: ${url}`);
            const res = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://providentestate.com/'
                }
            });
            console.log(`SUCCESS: ${res.status}`);
        } catch (e) {
            console.log(`FAILED: ${e.response?.status || e.message}`);
        }
    }
}

test();
