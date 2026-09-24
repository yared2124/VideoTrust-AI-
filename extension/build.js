import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync, cpSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function buildExtension() {
  console.log('🚀 Building VideoTrust AI Chrome Extension...');

  // Ensure dist directory exists
  if (!existsSync('dist')) {
    mkdirSync('dist', { recursive: true });
  }

  // 1. Build Content Script (IIFE - fully self-contained for Chrome Content Script)
  console.log('📦 Bundling Content Script (observer.tsx)...');
  await build({
    configFile: false,
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      target: 'es2022',
      sourcemap: 'inline',
      rollupOptions: {
        input: resolve(__dirname, 'src/content/observer.tsx'),
        output: {
          format: 'iife',
          entryFileNames: 'content.js',
        },
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
  });

  // 2. Build Tailwind CSS for Content Script
  console.log('🎨 Compiling Content Script Stylesheet (content.css)...');
  execSync('npx tailwindcss -i ./src/content/content.css -o ./dist/content.css --minify', {
    stdio: 'inherit',
  });

  // 3. Build Background Service Worker (ES Module)
  console.log('⚡ Bundling Background Service Worker (worker.ts)...');
  await build({
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      target: 'es2022',
      sourcemap: 'inline',
      rollupOptions: {
        input: resolve(__dirname, 'src/background/worker.ts'),
        output: {
          format: 'es',
          entryFileNames: 'worker.js',
        },
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
  });

  // 4. Copy Manifest & Static Icons
  console.log('📄 Copying manifest.json and icons...');
  if (existsSync('manifest.json')) {
    copyFileSync('manifest.json', 'dist/manifest.json');
  }
  if (existsSync('public')) {
    cpSync('public', 'dist', { recursive: true });
  }

  console.log('✅ Chrome Extension build finished successfully in dist/');
}

buildExtension().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
