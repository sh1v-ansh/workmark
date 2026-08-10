import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  // Mirrors the "@/*" -> "src/*" path alias in tsconfig.json; without it
  // every import in a test resolves against node_modules and fails.
  resolve: {
    alias: { '@': path.resolve(dir, './src') },
  },
})
