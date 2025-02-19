import dotenv from 'dotenv';

import express from 'express';
import cors from 'cors';

// Importar as rotas de usuários e empresas
import useRouter from './routes/users.route.js';
import authRoutes from './routes/auth.route.js'; 
import { listarOrdemCarga } from './controllers/ordemCarga.controller.js';
import { listarDetalhesPedido } from './controllers/listarDetalhesPedido.controller.js';
import { atualizarStatusConferencia } from './controllers/atualizarStatusConferencia.controller.js';
import { registrarDivergencia } from './controllers/registrarDivergencia.controller.js';
import { associarSeparador } from './controllers/associarSeparador.controller.js';
import { listarOrdensPorSeparador } from './controllers/listarOrdensPorSeparador.controller.js';

import { registrarDivergenciainput } from './controllers/registrarDivergenciainput.controller.js';
import {  verificarSePodeSeparar } from './controllers/verificarSePodeSeparar.controller.js';
import { separacaoFinalizada } from './controllers/separacaoFinalizada.controller.js';

dotenv.config();
const app = express();



app.use(cors()); // Habilitar CORS
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rota para /api/v1/users
app.use('/api/v1/users', useRouter);

app.get('/api/v1/verificar-separacao/:separadorCodigo', verificarSePodeSeparar);

app.use('/api', authRoutes);

// Rota para listar a ordem de carga
app.get('/api/ordem-carga', listarOrdemCarga);

//Rota para pegar detalhes do pedido 
app.get('/api/detalhes/:nroUnico', listarDetalhesPedido);

app.put('/api/ordem-carga/iniciar-conferencia/:nroUnico', atualizarStatusConferencia);

app.put('/api/divergencia/:nroUnico', registrarDivergencia);

app.put('/api/divergenciainput/:nroUnico/:sequencia', registrarDivergenciainput);

app.put('/api/v1/users/associar-separador', associarSeparador);

app.get('/api/ordens-carga', listarOrdensPorSeparador);

app.put('/api/v1/separacao-finalizada/:nroUnico',separacaoFinalizada);






const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
});

// Inicializar o servidor
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
