import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: false,
  build: { outDir: 'dist/client', emptyOutDir: true },
  server: {
    // Keep the watcher off other worktrees, tracking files and generated output.
    watch: { ignored: ['**/.claude/**', '**/.rpi-tracking/**', '**/var/**', '**/dist/**'] },
  },
});
