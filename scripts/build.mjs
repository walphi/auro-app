import { execSync } from 'child_process';
import { existsSync, cpSync, mkdirSync, rmSync } from 'fs';

console.log('--- Building marketing site ---');
execSync('cd marketing && npm install && npm run build', { stdio: 'inherit', shell: true });

if (existsSync('marketing/dist')) {
  console.log('--- Copying marketing dist to root dist/ ---');
  mkdirSync('dist', { recursive: true });
  cpSync('marketing/dist', 'dist', { recursive: true, force: true });
}

// Clean up stray _redirects that got copied into sub-SPA dirs
for (const dir of ['dashboard', 'sites']) {
  const p = `dist/${dir}/_redirects`;
  if (existsSync(p)) {
    rmSync(p);
    console.log(`  Removed stray ${p}`);
  }
}

console.log('--- Building dashboard ---');
execSync('npx vite build', { stdio: 'inherit', shell: true });

console.log('--- Building sites ---');
execSync('cd sites && npm install && npm run build', { stdio: 'inherit', shell: true });

console.log('--- Build complete ---');
