/**
 * Test TwiML Generation
 * Verify that the TwiML response is valid
 */

const testTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>
    <Body>We have one listing in Creek Beach: a 2-bedroom apartment at Vida Residences Creek Beach for AED 3,400,000. Would you like more details on this property?
</Body>
    <Media>https://d3h330vgpwpjr8.cloudfront.net/x/property/PS-03122535/images/iblock/7e2/7e22d8b6f8f146005f58c9c9f75d0092/696x520/ADU00425.jpg</Media>
  </Message>
</Response>`;

console.log('Testing TwiML Response:\n');
console.log(testTwiML);
console.log('\n' + '='.repeat(70));

// Check for common issues
const issues = [];

if (!testTwiML.includes('<?xml')) {
    issues.push('❌ Missing XML declaration');
} else {
    console.log('✅ XML declaration present');
}

if (!testTwiML.includes('<Response>')) {
    issues.push('❌ Missing <Response> tag');
} else {
    console.log('✅ <Response> tag present');
}

if (!testTwiML.includes('<Message>')) {
    issues.push('❌ Missing <Message> tag');
} else {
    console.log('✅ <Message> tag present');
}

if (!testTwiML.includes('<Body>')) {
    issues.push('❌ Missing <Body> tag');
} else {
    console.log('✅ <Body> tag present');
}

if (!testTwiML.includes('<Media>')) {
    issues.push('❌ Missing <Media> tag');
} else {
    console.log('✅ <Media> tag present');
}

// Check for unclosed tags
if (!testTwiML.includes('</Body>')) {
    issues.push('❌ <Body> tag not closed');
} else {
    console.log('✅ <Body> tag closed');
}

if (!testTwiML.includes('</Message>')) {
    issues.push('❌ <Message> tag not closed');
} else {
    console.log('✅ <Message> tag closed');
}

if (!testTwiML.includes('</Response>')) {
    issues.push('❌ <Response> tag not closed');
} else {
    console.log('✅ <Response> tag closed');
}

// Check for Media tag closure
if (!testTwiML.includes('</Media>')) {
    issues.push('❌ <Media> tag not closed');
} else {
    console.log('✅ <Media> tag closed');
}

console.log('\n' + '='.repeat(70));

if (issues.length > 0) {
    console.log('\n❌ ISSUES FOUND:\n');
    issues.forEach(issue => console.log(issue));
} else {
    console.log('\n✅ TwiML appears to be valid!');
}

console.log('\n💡 IMPORTANT: Check if the image URL is accessible:');
console.log('https://d3h330vgpwpjr8.cloudfront.net/x/property/PS-03122535/images/iblock/7e2/7e22d8b6f8f146005f58c9c9f75d0092/696x520/ADU00425.jpg');
console.log('\nTry opening this URL in your browser to verify it works WITHOUT ?format=jpeg');
