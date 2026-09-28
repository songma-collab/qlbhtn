import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isProd = mode === 'production';

  return {
    base: '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-router-dom',
        'react-helmet-async',
        'lucide-react',
        'chart.js',
        'react-chartjs-2',
        '@tanstack/react-virtual',
        '@supabase/supabase-js',
        'xlsx-js-style',
        'pdfmake',
        'html2canvas',
        'zod',
      ],
    },
    esbuild: {
      drop: isProd ? ['console', 'debugger'] : [],
      legalComments: 'none',
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      target: 'es2020',
      minify: 'esbuild',
      cssMinify: true,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (
                id.includes('react') ||
                id.includes('react-dom') ||
                id.includes('react-router-dom') ||
                id.includes('react-helmet-async') ||
                id.includes('@tanstack/react-virtual')
              ) {
                return 'vendor-react';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
                return 'vendor-charts';
              }
              if (id.includes('xlsx') || id.includes('xlsx-js-style')) {
                return 'vendor-excel';
              }
              if (id.includes('pdfmake') || id.includes('html2canvas')) {
                return 'vendor-pdf';
              }
              if (id.includes('@supabase')) {
                return 'vendor-supabase';
              }
              if (id.includes('motion')) {
                return 'vendor-animation';
              }
            }
          }
        }
      }
    }
  };
});
