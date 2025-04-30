import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

// Importação das rotas
import userRouter from './routes/users.route.js';
import authRoutes from './routes/auth.route.js';
import pedidosroutes from './routes/pedidos.route.js';
import conferenciaroutes from './routes/conferencia.routes.js'


dotenv.config();
const app = express();

app.use(cors()); // Habilitar CORS
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Definição das rotas
app.use('/api/v1/users', userRouter);
app.use('/api/auth', authRoutes);
app.use('/api/v1', pedidosroutes);
app.use('/api/v2', conferenciaroutes);

// Configuração do servidor


const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {console.log(`Servidor rodando em http://${HOST}:${PORT}`)
});