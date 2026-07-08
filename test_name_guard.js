
const crmRouter = require('./lib/crmRouter');

async function test() {
    const payload = {
        name: 'Voice User 1234',
        phone: '+971500000000'
    };
    
    // We can't run the full sync because it hits HubSpot, but we can test the internal logic
    // I'll manually check the regex against various names
    const regex = /^(whatsapp lead|voice user)/i;
    
    const testCases = [
        'WhatsApp Lead +971...',
        'voice user 1234',
        'Voice User 5678',
        'Phil Smith',
        'John Doe'
    ];
    
    testCases.forEach(name => {
        const isPlaceholder = regex.test(name.trim());
        console.log(`Name: "${name}" => isPlaceholder: ${isPlaceholder}`);
    });
}

test();
