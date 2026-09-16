import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';

const urlSitio = 'https://papeleriadesol.com.ar';

export default defineConfig({
  site: urlSitio,
  trailingSlash: 'never',
  output: 'server',
  prefetch: true,
  adapter: netlify(),
  integrations: [sitemap({
    filter: (pagina) => {
      const ruta = new URL(pagina).pathname.replace(/\/$/, '');
      return ruta !== '/admin' && ruta !== '/catalogo';
    },
  })],
  server: {
    host: '127.0.0.1',
    port: 4321,
  },
  vite: {
    build: {
      // Mantener los scripts externos para respetar script-src 'self'.
      assetsInlineLimit: 0,
      sourcemap: false,
    },
  },
});
