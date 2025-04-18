import express from 'express';
import { listarOrdemCarga } from '../controllers/ordemCarga.controller.js';
import { listarDetalhesPedido } from '../controllers/listarDetalhesPedido.controller.js';
import { atualizarStatusConferencia } from '../controllers/atualizarStatusConferencia.controller.js';
import { registrarDivergencia } from '../controllers/registrarDivergencia.controller.js';
import { associarSeparador } from '../controllers/associarSeparador.controller.js';
import { calcularPontuacaoSeparadores, listarOrdensPorSeparador } from '../controllers/listarOrdensPorSeparador.controller.js';
import { registrarDivergenciainput } from '../controllers/registrarDivergenciainput.controller.js';
import { verificarSePodeSeparar } from '../controllers/verificarSePodeSeparar.controller.js';
import { separacaoFinalizada } from '../controllers/separacaoFinalizada.controller.js';
import { atualizarHistorico } from '../controllers/historico.controller.js';
import { imprimirEtiqueta } from '../controllers/ImprimirEtiqueta.controller.js';

const router = express.Router();

// Rotas de ordem de carga
router.get('/ordem-carga/:separadorCodigo', listarOrdemCarga);
router.get('/perfil/:separadorCodigo', listarOrdensPorSeparador);
router.get ('/perfil/score/:separadorCodigo', calcularPontuacaoSeparadores)
router.put('/ordem-carga/iniciar-conferencia/:nroUnico', atualizarStatusConferencia);

// Rotas de detalhes e divergências
router.get('/detalhes/:nroUnico/:separadorCodigo', listarDetalhesPedido);
router.put('/divergencia/:nroUnico', registrarDivergencia);
router.put('/divergenciainput/:nroUnico/:sequencia', registrarDivergenciainput);

// Rotas de separador
router.get('/verificar-separacao/:separadorCodigo', verificarSePodeSeparar);
router.put('/users/associar-separador', associarSeparador);

// Outras rotas
router.put('/separacao-finalizada/:nroUnico', separacaoFinalizada);
router.put('/historico/:nroUnico/:separadorCodigo', atualizarHistorico);
router.put('/imprimir/:nroUnico/:separadorCodigo', imprimirEtiqueta);

export default router;