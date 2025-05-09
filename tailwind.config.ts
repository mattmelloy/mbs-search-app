import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}', // If you had a pages directory
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // You can extend your theme here if needed
    },
  },
  plugins: [
    require('@tailwindcss/forms'), // Optional: for better default form styling
  ],
}
export default config