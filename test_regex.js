
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
