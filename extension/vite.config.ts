import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync, cpSync } from 'fs';

function copyManifestAndIconsPlugin() {
  return {
    name: 'copy-manifest-and-icons',
    closeBundle() {
      if (!existsSync('dist')) {
        mkdirSync('dist', { recursive: true });
      }
      if (existsSync('manifest.json')) {
        copyFileSync('manifest.json', 'dist/manifest.json');
      }
      if (existsSync('public')) {
        cpSync('public', 'dist', { recursive: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyManifestAndIconsPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/observer.tsx'),
        worker: resolve(__dirname, 'src/background/worker.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'content.css';
          }
          return 'assets/[name].[ext]';
        },
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
