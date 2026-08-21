import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';

const urlSitio = process.env.PUBLIC_URL_SITIO || 'https://papeleria-de-sol.netlify.app';

export default defineConfig({
  site: urlSitio,
  output: 'server',
  adapter: netlify(),
  integrations: [sitemap()],
  server: {
    host: '127.0.0.1',
    port: 4321,
  },
  vite: {
    build: {
      sourcemap: false,
    },
  },
});
