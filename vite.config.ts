/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/www\.googleapis\.com\/.*/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/accounts\.google\.com\/.*/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/apis\.google\.com\/.*/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/www\.googletagmanager\.com\/.*/,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'LunaFlow Tracker',
        short_name: 'LunaFlow',
        description: 'Track your cycle. Own your data. Privacy-focused period & ovulation tracker.',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        categories: ['health', 'lifestyle', 'medical'],
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'res/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'res/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'res/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'Open Calendar',
            short_name: 'Calendar',
            url: '/calendar',
            icons: [{ src: 'res/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
    }),
  ],
  // @ts-expect-error - test config is valid for vitest but not strictly for vite types
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
})
