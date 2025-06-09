import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // Redireciona todas as requisições que começam com '/api'
      // para o seu backend rodando em 'http://10.10.10.92:5000'
      '/api': {
        target: 'http://10.10.10.92:5000', // <--- Endereço CORRETO do seu backend
        changeOrigin: true,
        // Sua rota de backend inclui '/api/v1/perfil/score',
        // então o prefixo '/api' já faz parte da URL do backend.
        // Não precisamos remover o '/api' com rewrite neste caso.
        // rewrite: (path) => path.replace(/^\/api/, ''), // <-- Remova ou comente esta linha
      },
    },
  },
})
