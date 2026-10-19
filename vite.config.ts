/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the site at https://<owner>.github.io/<repository>/ (or at the root for a repository
  // named <owner>.github.io). The deploy workflow passes the path, so renaming the repository changes the
  // link with no code change.
  base: command === 'build' || isPreview ? (process.env.BASE_PATH ?? '/breezy-docket/') : '/',
  plugins: [react()],
  // Firebase (accounts) is its own chunk, loaded only when someone uses accounts.
  build: { chunkSizeWarningLimit: 600 },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
