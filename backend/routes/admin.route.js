// routes/separador.routes.js
import express from 'express';
// Importe as funções do seu arquivo de controller
// Certifique-se de que o caminho está correto para o seu projeto
import { listarOrdensGerais, listarPorSeparador, PontuacaoSeparadores } from '../controllers/admin/rankingGeral.controller.js';

const router = express.Router();

// Rota para listar ordens de carga de um separador específico
// Método: GET
// URL: /api/separadores/:separadorCodigo/ordens
router.get('/separadores/ordens', listarPorSeparador);

// Rota para calcular e retornar a pontuação e ranking de TODOS os separadores tipo '01'
// Método: GET
// URL: /api/separadores/ranking
router.get('/separadores/ranking', PontuacaoSeparadores);

router.get('/ordens-gerais', listarOrdensGerais);

export default router; // Exporte APENAS o router
