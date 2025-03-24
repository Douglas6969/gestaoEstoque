import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

// Importação das rotas
import userRouter from './routes/users.route.js';
import authRoutes from './routes/auth.route.js';
import pedidosroutes from './routes/pedidos.route.js';

// Configuração do ambiente
dotenv.config();
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Definição das rotas
app.use('/api/v1/users', userRouter);
app.use('/api/auth', authRoutes);
app.use('/api/v1', pedidosroutes);

// Configuração do servidor
const PORT = process.env.PORT || 5000;


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
});
