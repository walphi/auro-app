
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

console.log('--- Environment Variables ---');
Object.keys(process.env).forEach(key => {
    if (key.includes('AURO') || key.includes('BITRIX') || key.includes('WEBHOOK')) {
        console.log(`${key}: ${process.env[key] ? 'SET (length: ' + process.env[key].length + ')' : 'MISSING'}`);
    }
});
