import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({base:'./',plugins:[react()],resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},define:{'process.env.NEXT_PUBLIC_API_BASE':JSON.stringify(process.env.NEXT_PUBLIC_API_BASE||''),'process.env':JSON.stringify({NEXT_PUBLIC_API_BASE:process.env.NEXT_PUBLIC_API_BASE||''})},build:{outDir:'pages-dist',emptyOutDir:true,rollupOptions:{input:'index.html'}}});
