import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative paths let the app run from any host or sub-folder.
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PlayBox',
        short_name: 'PlayBox',
        description: 'Piano, drums and little games.',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#17151f',
        theme_color: '#17151f',
        id: 'playbox',
        scope: './',
        start_url: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Samples are precached so the piano works with no internet.
        globPatterns: ['**/*.{js,css,html,png,mp3}'],
        maximumFileSizeToCacheInBytes: 2_000_000,
      },
    }),
  ],
});
