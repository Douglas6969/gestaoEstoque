import express from 'express';
import { listarOrdemCarga } from '../controllers/ordemCarga.controller.js'; // Importe o controlador
import { listarDetalhesPedido } from '../controllers/listarDetalhesPedido.controller.js';
import { atualizarStatusConferencia} from '../controllers/atualizarStatusConferencia.controller.js';
import { registrarDivergencia } from '../controllers/registrarDivergencia.controller.js';
import { associarSeparador } from '../controllers/associarSeparador.controller.js';
import {  listarOrdensPorSeparador } from '../controllers/listarOrdensPorSeparador.controller.js';

import { registrarDivergenciainput } from '../controllers/registrarDivergenciainput.controller.js';
import { verificarSePodeSeparar } from '../controllers/verificarSePodeSeparar.controller.js';
import { separacaoFinalizada } from '../controllers/separacaoFinalizada.controller.js';

const router = express.Router();

// Rota para listar a ordem de carga
router.get('/ordem-carga', listarOrdemCarga);
router.get('/detalhes/:nroUnico', listarDetalhesPedido);
router.put('/ordem-carga/iniciar-conferencia/:nroUnico',atualizarStatusConferencia);
router.put('/api/divergencia/:nroUnico', registrarDivergencia);
router.put('/api/divergenciainput/:nroUnico/:sequencia', registrarDivergenciainput);
router.put('/api/v1/users/associar-separador', associarSeparador);
router.get('api/ordens-carga', listarOrdensPorSeparador);
router.get('/api/v1/verificar-separacao/:separadorCodigo', verificarSePodeSeparar);
router.put('/api/v1/separacao-finalizada/:nroUnico',separacaoFinalizada);

export default router; // Exporte o router
