import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: '/dashboard',
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    build: {
        outDir: 'dist/dashboard',
    },
    optimizeDeps: {
        include: ['pdfjs-dist'],
    },
    worker: {
        format: 'es',
    },
})
