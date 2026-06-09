import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'

// Ensure manifest.json and other static assets are copied to the dist folder
function copyManifestPlugin() {
  return {
    name: 'copy-manifest-and-static',
    closeBundle: async () => {
      try {
        const root = process.cwd()
        const out = resolve(root, 'dist')
        const manifestSrc = resolve(root, 'manifest.json')
        const manifestDest = resolve(out, 'manifest.json')
        await fs.promises.copyFile(manifestSrc, manifestDest)
        // copy built html entry points from nested folder to dist root for Chrome
        const popupSrc = resolve(out, 'src/popup/popup.html')
        const optionsSrc = resolve(out, 'src/options/options.html')
        const popupDest = resolve(out, 'popup.html')
        const optionsDest = resolve(out, 'options.html')
        try {
          await fs.promises.copyFile(popupSrc, popupDest)
        } catch (e) {
          // ignore
        }
        try {
          await fs.promises.copyFile(optionsSrc, optionsDest)
        } catch (e) {
          // ignore
        }
      } catch (err) {
        // don't fail the build for non-critical copy errors here
        // but log for debugging
        // eslint-disable-next-line no-console
        console.warn('copy-manifest failed', err)
      }
    }
  }
}

// Vite config with multiple inputs for extension pages and scripts.
export default defineConfig({
  plugins: [react(), copyManifestPlugin()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        options: resolve(__dirname, 'src/options/options.html'),
        background: resolve(__dirname, 'src/background/service-worker.ts'),
        content: resolve(__dirname, 'src/content/contentScript.ts')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
})
