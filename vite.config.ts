import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import { VERSION_LABEL, COMMIT, COMMIT_DATE } from './src/generated/version';

/**
 * Injects the git-derived release version into index.html so a deployed build
 * can be identified from the page source alone (view-source / curl).
 */
const versionStampPlugin = (): Plugin => ({
  name: 'cloudtube-version-stamp',
  transformIndexHtml(html) {
    return html.replaceAll('%APP_VERSION%', VERSION_LABEL).replaceAll(
      '%APP_COMMIT%',
      `${COMMIT} · ${COMMIT_DATE}`
    );
  },
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), versionStampPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
