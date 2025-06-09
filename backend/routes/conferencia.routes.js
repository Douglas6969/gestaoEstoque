import express from 'express';
import { verificarSeConferentePorCodsep } from '../controllers/controllers.conf/authConf.controller.js';
import { iniciarConferencia } from '../controllers/controllers.conf/iniciarConferencia.controller.js';
import { listarDetalhesPedidoConferente, resetarTentativasConferencia, verificarQuantidadeConferente } from '../controllers/controllers.conf/listaDetalhesPedidoConf.controller.js';
import { divergenciaConferente } from '../controllers/controllers.conf/divergencia.controller.js'
import { atualizarQuantidadeVolumes, obterDetalhesPedido} from '../controllers/controllers.conf/ImprimirEtiquetaConf.controller.js';
import { finalizarConferencia } from '../controllers/controllers.conf/finalizarConferencia.controller.js';
import { registrarDevolucaoParaSeparador, retornarParaConferente } from '../controllers/controllers.conf/ConferenteErr.controller.js';
import { salvarVolumesExpedicao } from '../controllers/controllers.conf/salvarVolumesExpedicao.controller.js';




const router = express.Router();

// Exemplo de rota onde só conferente acessa

    router.get('/is-conf/:codsep', verificarSeConferentePorCodsep);
router.post('/iniciar/:codigoConferente', iniciarConferencia);
router.get('/conferencia/pedido/:nroUnico/:conferenteCodigo', listarDetalhesPedidoConferente);

// 2. Rota para verificar a quantidade informada pelo conferente
router.post('/conferencia/verificar/:nroUnico/:codProduto/:lote/:conferenteCodigo', verificarQuantidadeConferente);


router.put('/divergenciaConf/:nroUnico/:conferenteCodigo', divergenciaConferente);

router.delete('/conferencia/:nroUnico/:conferenteCodigo/resetar', resetarTentativasConferencia);

// Rota para listar volumes disponíveis de um pedido

router.get('/pedidos/:conferenteCodigo/:nroUnico/detalhes', obterDetalhesPedido);

router.put('/volumes/:conferenteCodigo/:nroUnico', atualizarQuantidadeVolumes);

router.post('/finalizar/:codigoConferente', finalizarConferencia);

router.post('/devolucao-separador/:conferenteCodigo', registrarDevolucaoParaSeparador);

// Rota para retornar itens corrigidos do separador para o conferente (status 5)
router.post('/retorno-conferente/:separadorCodigo/', retornarParaConferente);

router.post('/volume-expedicao/conferente/:codigoConferente/nota/:nunota', salvarVolumesExpedicao);


export default router;
