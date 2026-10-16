/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the site at https://<owner>.github.io/<repository>/. The deploy workflow passes the
  // repository's name, so renaming the repository changes the link with no code change.
  base: command === 'build' || isPreview ? (process.env.BASE_PATH ?? '/curriculum-organizer/') : '/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
