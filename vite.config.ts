import { defineConfig } from 'vite';
import { renderWork } from './src/work/render';

export default defineConfig({
  plugins: [
    {
      name: 'prerender-work',
      transformIndexHtml(html, ctx) {
        if (ctx.path.includes('/work')) return html.replace('<!--work-->', renderWork());
        return html;
      },
    },
  ],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
        work: new URL('./work/index.html', import.meta.url).pathname,
      },
    },
  },
});
