
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

console.log('--- ALL Environment Variables (Keys only) ---');
Object.keys(process.env).sort().forEach(key => {
    console.log(key);
});
