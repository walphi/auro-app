import fs from 'fs';

async function downloadUrl(url: string, filename: string) {
    console.log("Downloading from:", url);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        if (!res.ok) throw new Error(`Status: ${res.status}`);
        const text = await res.text();
        // Simple HTML strip (very basic)
        const cleanText = text.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "")
            .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gm, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        fs.writeFileSync(filename, cleanText);
        console.log(`Saved ${cleanText.length} bytes to ${filename}`);
    } catch (e) {
        console.error(`Error downloading ${url}:`, e);
    }
}

async function main() {
    await downloadUrl("https://providentestate.com/blog/dubai-market-report-q3-2025/", "market_report_q3_2025.txt");
    await downloadUrl("https://providentestate.com/blog/dubai-property-market-report-2025/", "market_report_2025_outlook.txt");
}

main();
