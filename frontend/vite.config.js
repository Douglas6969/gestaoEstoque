import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // Faz o servidor escutar em todas as interfaces de rede
    port: 5173,       // Ou qualquer outra porta que você preferir
  },
})
