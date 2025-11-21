/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // White-label placeholder colors - can be overridden by CSS variables if needed
                primary: 'var(--color-primary, #4f46e5)', // Indigo-600
                'primary-hover': 'var(--color-primary-hover, #4338ca)', // Indigo-700
            }
        },
    },
    plugins: [],
}
