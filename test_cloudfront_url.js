import fetch from 'node-fetch';

async function testImageURL() {
    const urls = [
        {
            name: 'Without parameter (should work)',
            url: 'https://d3h330vgpwpjr8.cloudfront.net/x/property/PS-03122535/images/iblock/7e2/7e22d8b6f8f146005f58c9c9f75d0092/696x520/ADU00425.jpg'
        },
        {
            name: 'With ?format=jpeg (currently being sent)',
            url: 'https://d3h330vgpwpjr8.cloudfront.net/x/property/PS-03122535/images/iblock/7e2/7e22d8b6f8f146005f58c9c9f75d0092/696x520/ADU00425.jpg?format=jpeg'
        }
    ];

    console.log('🔍 Testing Image URL Accessibility\n');
    console.log('='.repeat(70));

    for (const test of urls) {
        console.log(`\n📋 ${test.name}`);
        console.log(`URL: ${test.url}\n`);

        try {
            const response = await fetch(test.url, {
                method: 'HEAD',
                redirect: 'follow'
            });

            console.log(`Status: ${response.status} ${response.statusText}`);
            console.log(`Content-Type: ${response.headers.get('content-type')}`);
            console.log(`Content-Length: ${response.headers.get('content-length')} bytes`);

            if (response.ok) {
                console.log('✅ ACCESSIBLE - This URL works!');
            } else {
                console.log('❌ NOT ACCESSIBLE - This URL is blocked!');
            }
        } catch (e) {
            console.log(`❌ ERROR: ${e.message}`);
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n💡 CONCLUSION:');
    console.log('If the URL WITHOUT ?format=jpeg works, we need to ensure');
    console.log('the code is NOT adding that parameter.');
    console.log('\nIf BOTH URLs fail, the issue is with CloudFront permissions.');
}

testImageURL().catch(console.error);
