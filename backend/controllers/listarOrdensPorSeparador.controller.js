import axios from 'axios';
import { db } from '../database/connection.database.js';
import { getBearerToken } from './auth.controller.js';

const listarOrdensPorSeparador = async (req, res) => {
  const { separadorCodigo } = req.params;
  console.log('Valor do separador recebido:', separadorCodigo);
  const separadorCodigoInt = parseInt(separadorCodigo, 10);

  if (!separadorCodigo || isNaN(separadorCodigoInt)) {
    return res.status(400).json({ error: "Código do separador inválido." });
  }

  try {
    const result = await db.query('SELECT id_usuario FROM usuario WHERE codsep = $1', [separadorCodigoInt]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Separador não encontrado." });
    }

    const id_usuario = result.rows[0].id_usuario;
    console.log('ID do usuário obtido:', id_usuario);

    const token = await getBearerToken(id_usuario);
    const appkey = process.env.SANKHYA_APPKEY;

    if (!token) {
      return res.status(500).json({ erro: 'Token de autenticação não encontrado' });
    }

    const sqlQuery = `
      SELECT
        TO_CHAR(CAB.DTNEG, 'DD/MM/YYYY') AS "Data",
        CAB.NUNOTA AS "Nro_Unico",
        PAR.RAZAOSOCIAL || ' - ' || CAB.CODPARC AS "Cliente",
        TO_CHAR(NVL(AD_ORDEMPEDIDO, CAB.DTNEG), 'DD/MM/YYYY HH24:MI:SS') AS "Ordem",
        CAB.QTDVOL AS "Qtd_Vol",
        TRA.RAZAOSOCIAL || ' - ' || CAB.CODPARCTRANSP AS "Transportadora",
        EMP.RAZAOSOCIAL AS "Nome_Empresa",
        CASE
          WHEN CAB.AD_CODIGO = '1' THEN 'Liberado para Separação'
          WHEN CAB.AD_CODIGO = '2' THEN 'Separação Iniciada'
          WHEN CAB.AD_CODIGO = '7' THEN 'Divergência Encontrada'
          WHEN CAB.AD_CODIGO = '5' THEN 'Conferencia Iniciada'
          WHEN CAB.AD_CODIGO = '9' THEN 'err404'
        END AS "Status",
        CAB.AD_DS_MOTIVODIV AS "Motivo",
        TOP.DESCROPER || ' - ' || CAB.CODTIPOPER AS "Top",
        NVL(PRODUTOS.CODPRODS, 'Nenhum produto') AS "Codigo_Produtos",
        CAB.NUMCONTRATO,
        NVL(F_DESCROPC('TGFCAB', 'AD_PRIORIDADE', CAB.AD_PRIORIDADE), 'Normal') AS "Des_Prioridade",
        NVL(SEP.DESCRICAO, 'N/A') AS "Nome_Separador",
        CASE
          WHEN CAB.AD_PRIORIDADE = 1 THEN 'Urgente'
          ELSE 'Normal'
        END AS "Prioridade",
        COUNT(CAB.NUNOTA) OVER() AS "Total_Numeros_Unicos"
      FROM TGFCAB CAB
        INNER JOIN TSIEMP EMP ON EMP.CODEMP = CAB.CODEMP
        INNER JOIN TGFPAR PAR ON PAR.CODPARC = CAB.CODPARC
        LEFT JOIN TGFPAR TRA ON TRA.CODPARC = CAB.CODPARCTRANSP
        INNER JOIN TGFTOP TOP ON TOP.CODTIPOPER = CAB.CODTIPOPER
                               AND TOP.DHALTER = CAB.DHTIPOPER
        LEFT JOIN (
          SELECT ITE.NUNOTA,
            LISTAGG(PRO.CODPROD, ', ') WITHIN GROUP (ORDER BY PRO.CODPROD) AS CODPRODS
          FROM TGFITE ITE
          INNER JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
          GROUP BY ITE.NUNOTA
        ) PRODUTOS ON PRODUTOS.NUNOTA = CAB.NUNOTA
        LEFT JOIN AD_SEPARADOR SEP ON CAB.AD_SEPARADORNEW = SEP.SEPARADOR
      WHERE CAB.CODTIPOPER IN (1000, 1003, 1005)
        AND CAB.PENDENTE = 'S'
        AND CAB.AD_CODIGO IN ('7', '2','5','9')
        AND SEP.SEPARADOR = ${separadorCodigoInt}
      ORDER BY "Prioridade", "Ordem", "Nro_Unico"
    `;

    const requestBody = {
      serviceName: 'DbExplorerSP.executeQuery',
      requestBody: { sql: sqlQuery }
    };

    const response = await axios.post(
      'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'appkey': appkey
        }
      }
    );

    if (response.data?.status === '1' && response.data.responseBody?.rows) {
      const rows = response.data.responseBody.rows;
      if (Array.isArray(rows) && rows.length > 0) {
        const result = rows.map((row, index) => ({
          key: `${row[0]}-${index}`, // Usando Data e index para key
          Nro_Unico: row[1] || null,
          Status: row[7] ? String(row[7]).trim() : 'Status não disponível',
          Des_Prioridade: row[12] || 'Normal', // Índice corrigido para Des_Prioridade
          Cliente: row[2] || null,
          Qtd_Vol: row[4] || null,
          Data: row[0] || null,
          Ordem: row[3] || null,
          Nome_Separador: row[13] || 'Não informado'
        }));
        return res.json({ ordens: result });
      } else {
        return res.status(404).json({ error: 'Nenhuma ordem de carga encontrada para este separador no período.' });
      }
    } else {
      console.error('Resposta inesperada da API ao listar ordens:', JSON.stringify(response.data, null, 2));
      return res.status(500).json({ error: 'Erro ao processar a resposta da API ao listar ordens.' });
    }

  } catch (error) {
    console.error('Erro ao listar ordens por separador:', error.response?.data || error.message);
    if (error.response) {
      console.error('Detalhes do erro:', error.response.data);
    }
    return res.status(500).json({ error: 'Erro ao listar ordens de carga', details: error.response?.data || error.message });
  }
};

const calcularPontuacaoSeparadores = async (req, res) => {
  const { separadorCodigo } = req.params;
  console.log('Valor do separador recebido para pontuação:', separadorCodigo);
  const separadorCodigoInt = parseInt(separadorCodigo, 10);

  if (!separadorCodigo || isNaN(separadorCodigoInt)) {
    return res.status(400).json({ error: "Código do separador inválido." });
  }

  function getPosicaoTexto(ranking) {
    const rankingNum = parseInt(ranking);
    switch (rankingNum) {
      case 1: return 'Primeiro lugar';
      case 2: return 'Segundo lugar';
      case 3: return 'Terceiro lugar';
      default: return `${rankingNum}º lugar`;
    }
  }

  try {
    // Consulta local para obter id_usuario
    const result = await db.query('SELECT id_usuario FROM usuario WHERE codsep = $1', [separadorCodigoInt]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Separador não encontrado no sistema local." });
    }
    const id_usuario = result.rows[0].id_usuario;
    console.log('ID do usuário obtido:', id_usuario);

    // Obter token de autenticação para o Sankhya
    const token = await getBearerToken(id_usuario);
    const appkey = process.env.SANKHYA_APPKEY;

    if (!token) {
      return res.status(500).json({ erro: 'Token de autenticação não encontrado' });
    }

    // Obter a data atual para definir o período
    const dataAtual = new Date();
    const mesAtual = dataAtual.getMonth() + 1; // JavaScript meses são 0-11
    const anoAtual = dataAtual.getFullYear();

    // Criar data inicial (primeiro dia do mês atual) e final (último dia do mês atual)
    const dataInicial = `${anoAtual}-${mesAtual.toString().padStart(2, '0')}-01`;
    const ultimoDia = new Date(anoAtual, mesAtual, 0).getDate();
    const dataFinal = `${anoAtual}-${mesAtual.toString().padStart(2, '0')}-${ultimoDia}`;
    console.log(`Período de consulta: ${dataInicial} a ${dataFinal}`);

    // --- Consulta para obter dados de todos os separadores para o ranking ---
    // **ALTERAÇÃO AQUI: Subquery de produtos foi substituída**
    const rankingGeralQuery = `
      SELECT
          CAB.AD_SEPARADORNEW AS codigo,
          NVL(SEP.DESCRICAO, 'N/A') AS nome,
          (SELECT COUNT(DISTINCT NUNOTA) FROM AD_TGFEXP WHERE OPERADOR = CAB.AD_SEPARADORNEW AND DATA BETWEEN TO_DATE('${dataInicial}', 'YYYY-MM-DD') AND TO_DATE('${dataFinal}', 'YYYY-MM-DD')) AS pedidos,
          (SELECT SUM(CX.QTDVOL)
             FROM (
                 SELECT DISTINCT NUNOTA
                 FROM AD_TGFEXP
                 WHERE DATA BETWEEN TO_DATE('${dataInicial}', 'YYYY-MM-DD') AND TO_DATE('${dataFinal}', 'YYYY-MM-DD') AND OPERADOR = CAB.AD_SEPARADORNEW
             ) EX
             JOIN TGFCAB CX ON CX.NUNOTA = EX.NUNOTA
             ) AS volumes,
          -- NOVA LÓGICA PARA CONTAR PRODUTOS (DISTINTOS POR PEDIDO, SOMADO)
          (SELECT NVL(SUM(ProdutosPorPedido.Distinct_Produtos), 0)
           FROM (
               SELECT COUNT(DISTINCT TITE.CODPROD) AS Distinct_Produtos, TITE.NUNOTA
               FROM TGFITE TITE
               JOIN (
                   SELECT DISTINCT NUNOTA
                   FROM AD_TGFEXP
                   WHERE DATA BETWEEN TO_DATE('${dataInicial}', 'YYYY-MM-DD') AND TO_DATE('${dataFinal}', 'YYYY-MM-DD')
                   AND OPERADOR = CAB.AD_SEPARADORNEW
               ) RelevantOrders ON TITE.NUNOTA = RelevantOrders.NUNOTA
               GROUP BY TITE.NUNOTA
           ) ProdutosPorPedido
          ) AS produtos
      FROM TGFCAB CAB
      INNER JOIN AD_TGFEXP EXP ON EXP.NUNOTA = CAB.NUNOTA
      LEFT JOIN AD_SEPARADOR SEP ON CAB.AD_SEPARADORNEW = SEP.SEPARADOR
      WHERE EXP.DATA BETWEEN TO_DATE('${dataInicial}', 'YYYY-MM-DD') AND TO_DATE('${dataFinal}', 'YYYY-MM-DD')
        AND SEP.TIPO = '01'
        AND CAB.AD_SEPARADORNEW IS NOT NULL
      GROUP BY CAB.AD_SEPARADORNEW, SEP.DESCRICAO
    `;

    // Consulta para obter erros normais de cada separador
    const errosGeralQuery = `
      SELECT
        EXP.OPERADOR,
        COUNT(*) AS total_erros
      FROM TGFITE ERR
      JOIN AD_TGFEXP EXP ON EXP.NUNOTA = ERR.NUNOTA
      WHERE ERR.AD_NUNOTAERR IS NOT NULL
        AND EXP.DATA BETWEEN TO_DATE('${dataInicial}', 'YYYY-MM-DD') AND TO_DATE('${dataFinal}', 'YYYY-MM-DD')
      GROUP BY EXP.OPERADOR
    `;

    // Consulta para obter erros que passaram pelo status 9
    const errosStatus9Query = `
      SELECT
        EXP.OPERADOR,
        COUNT(*) AS total_erros_com_status_9
      FROM TGFITE ERR
      JOIN TGFCAB CAB ON ERR.NUNOTA = CAB.NUNOTA
      JOIN AD_TGFEXP EXP ON EXP.NUNOTA = ERR.NUNOTA
      WHERE ERR.AD_NUNOTAERR IS NOT NULL
        AND EXP.DATA BETWEEN TO_DATE('${dataInicial}', 'YYYY-MM-DD') AND TO_DATE('${dataFinal}', 'YYYY-MM-DD')
        AND EXISTS (
          SELECT 1
          FROM AD_TGFEXP EXP_STATUS
          WHERE EXP_STATUS.NUNOTA = ERR.NUNOTA
            AND EXP_STATUS.STATUS = '9'
            AND EXP_STATUS.OPERADOR = EXP.OPERADOR
        )
      GROUP BY EXP.OPERADOR
    `;

    // Executar as consultas em paralelo
    const [rankingGeralResponse, errosGeralResponse, errosStatus9Response] = await Promise.all([
      axios.post(
        'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
        { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql: rankingGeralQuery } },
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'appkey': appkey } }
      ),
      axios.post(
        'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
        { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql: errosGeralQuery } },
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'appkey': appkey } }
      ),
      axios.post(
        'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
        { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql: errosStatus9Query } },
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'appkey': appkey } }
      )
    ]);

    // Mapeamento de erros normais por separador
    const errosPorSeparador = {};
    if (errosGeralResponse.data?.status === '1' && errosGeralResponse.data.responseBody?.rows) {
      errosGeralResponse.data.responseBody.rows.forEach(row => {
        errosPorSeparador[row[0]] = parseInt(row[1] || 0);
      });
    }

    // Mapeamento de erros com status 9 por separador
    const errosStatus9PorSeparador = {};
    if (errosStatus9Response.data?.status === '1' && errosStatus9Response.data.responseBody?.rows) {
      errosStatus9Response.data.responseBody.rows.forEach(row => {
        errosStatus9PorSeparador[row[0]] = parseInt(row[1] || 0);
      });
    }

    let separadoresRanking = [];
    if (rankingGeralResponse.data?.status === '1' && rankingGeralResponse.data.responseBody?.rows) {
      const rows = rankingGeralResponse.data.responseBody.rows;

      // Calcular pontuação para cada separador
      separadoresRanking = rows.map(row => {
        const codigo = row[0];
        const nome = row[1];
        const pedidos = parseInt(row[2] || 0);
        const volumes = parseInt(row[3] || 0);
        // O valor de 'produtos' agora vem da nova subquery
        const produtos = parseInt(row[4] || 0);

        // Obter os erros dos mapas, usando 0 como padrão se não encontrado
        const erros = errosPorSeparador[codigo] || 0;
        const errosStatus9 = errosStatus9PorSeparador[codigo] || 0;

        // Pontuação bruta
        const pontuacaoBruta = (pedidos * 10) + (volumes * 1) + (produtos * 4);

        // Deduzir pontos por erros com status 9 (5 pontos por erro)
        const deducaoPorErros = errosStatus9 * 5;

        // Pontuação final (não pode ser negativa)
        const pontuacaoTotal = Math.max(0, pontuacaoBruta - deducaoPorErros);

        return {
          separador_codigo: codigo,
          nome_separador: nome,
          pedidos_internos: pedidos,
          volumes: volumes,
          produtos: produtos, // Este valor agora reflete a nova lógica de contagem
          erros_encontrados: erros,
          erros_com_status_9: errosStatus9,
          pontuacao_bruta: pontuacaoBruta,
          deducao_por_erros: deducaoPorErros,
          pontuacao_total: pontuacaoTotal,
          detalhamento: {
            pontos_pedidos: pedidos * 10,
            pontos_volumes: volumes * 1,
            pontos_produtos: produtos * 4, // O cálculo dos pontos usa o novo total de produtos
            formula: `((${pedidos} * 10) + (${volumes} * 1) + (${produtos} * 4)) - (${errosStatus9} * 5)`,
            pontuacao_bruta: pontuacaoBruta,
            deducao_por_erros: deducaoPorErros,
            pontuacao_final: pontuacaoTotal
          }
        };
      });

      // Ordenar por pontuação total (do maior para o menor)
      separadoresRanking.sort((a, b) => b.pontuacao_total - a.pontuacao_total);

      // Atribuir posição no ranking e calcular pontos_atras
      separadoresRanking.forEach((separador, index) => {
        separador.ranking = index + 1;
        separador.posicao = getPosicaoTexto(index + 1);

        // Calcular pontos_atras em relação ao separador na posição anterior (se não for o primeiro)
        if (index > 0) {
          const separadorAcima = separadoresRanking[index - 1];
          separador.pontos_atras = separadorAcima.pontuacao_total - separador.pontuacao_total;
        } else {
          separador.pontos_atras = 0; // O primeiro colocado não está atrás de ninguém
        }
      });
    }

    // Encontrar o separador específico na lista ranqueada
    const separadorAtual = separadoresRanking.find(sep => parseInt(sep.separador_codigo) === separadorCodigoInt);

    if (separadorAtual) {
      // Lógica especial para o separador 8, se aplicável (sobrescreve o ranking calculado)
      // Mantenho esta lógica, mas note que ela força o separador 8 para o 1º lugar,
      // independentemente da pontuação calculada.
      if (separadorCodigoInt === 8) {
           separadorAtual.ranking = 1;
           separadorAtual.posicao = "Primeiro lugar";
           separadorAtual.pontos_atras = 0; // Se é o primeiro (simulado), pontos_atras é 0
      }

      const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      const mesAtualNome = meses[mesAtual - 1];

      // Retornar os dados do separador encontrado
      return res.json({
        pontuacoes: [{
          separador_codigo: separadorAtual.separador_codigo,
          nome_separador: separadorAtual.nome_separador,
          pedidos_internos: separadorAtual.pedidos_internos,
          volumes: separadorAtual.volumes,
          produtos: separadorAtual.produtos, // Valor atualizado
          erros_encontrados: separadorAtual.erros_encontrados,
          erros_com_status_9: separadorAtual.erros_com_status_9,
          pontuacao_bruta: separadorAtual.pontuacao_bruta,
          deducao_por_erros: separadorAtual.deducao_por_erros,
          pontuacao_total: separadorAtual.pontuacao_total,
          ranking: separadorAtual.ranking,
          posicao: separadorAtual.posicao,
          pontos_atras: separadorAtual.pontos_atras, // Usar o valor calculado/sobrescrito
          periodo: `${mesAtualNome}/${anoAtual}`,
          detalhamento: separadorAtual.detalhamento // Detalhamento usa o novo valor de 'produtos'
        }]
      });
    } else {
      // Se o separador não foi encontrado na lista ranqueada (sem atividade no período)
      const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      const mesAtualNome = meses[mesAtual - 1];
      return res.status(404).json({
        error: 'Separador não encontrado ou sem registros no período',
        diagnostico: {
          // Removido a consulta extra de dataAtual, pois não é necessária para o período
          mes_atual: mesAtual,
          ano_atual: anoAtual,
          periodo_consultado: `${dataInicial} a ${dataFinal}`,
          mensagem: "Separador não encontrado no sistema Sankhya ou sem registros de atividade no período consultado."
        }
      });
    }

  } catch (error) {
    console.error('Erro ao consultar pontuação:', error);
    const errorMessage = error.response?.data?.message || error.message || 'Erro desconhecido';
    return res.status(500).json({
      error: 'Falha ao consultar pontuação',
      detalhes: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Função para obter o ranking completo de todos os separadores (mantida, pois já estava correta)
const obterRankingCompleto = async (req, res) => {
  try {
    // Obter o primeiro ID de usuário disponível para usar como autenticação
    const usuarioResult = await db.query('SELECT id_usuario FROM usuario WHERE codsep IS NOT NULL LIMIT 1');
    if (usuarioResult.rows.length === 0) {
      return res.status(404).json({ error: "Nenhum usuário encontrado para autenticação." });
    }
    const id_usuario = usuarioResult.rows[0].id_usuario;

    const token = await getBearerToken(id_usuario);
    const appkey = process.env.SANKHYA_APPKEY;

    if (!token) {
      return res.status(500).json({ erro: 'Token de autenticação não encontrado' });
    }

    // Definir o período para o mês atual
    const dataAtual = new Date();
    const mesAtual = dataAtual.getMonth() + 1;
    const anoAtual = dataAtual.getFullYear();
    const dataInicial = `${anoAtual}-${mesAtual.toString().padStart(2, '0')}-01`;
    const ultimoDia = new Date(anoAtual, mesAtual, 0).getDate();
    const dataFinal = `${anoAtual}-${mesAtual.toString().padStart(2, '0')}-${ultimoDia}`;

    // Consulta para obter dados de todos os separadores
    const rankingQuery = `
      SELECT
          CAB.AD_SEPARADORNEW AS codigo,
          NVL(SEP.DESCRICAO, 'N/A') AS nome,
          (SELECT COUNT(DISTINCT NUNOTA) FROM AD_TGFEXP WHERE OPERADOR = CAB.AD_SEPARADORNEW AND DATA BETWEEN TO_DATE('${dataInicial}', 'YYYY-MM-DD') AND TO_DATE('${dataFinal}', 'YYYY-MM-DD')) AS pedidos,
          (SELECT SUM(CX.QTDVOL)
           FROM (
                SELECT DISTINCT NUNOTA
                FROM AD_TGFEXP
                WHERE DATA BETWEEN TO_DATE('${dataInicial}', 'YYYY-MM-DD') AND TO_DATE('${dataFinal}', 'YYYY-MM-DD') AND OPERADOR = CAB.AD_SEPARADORNEW
           ) EX
           JOIN TGFCAB CX ON CX.NUNOTA = EX.NUNOTA
           ) AS volumes,
           (SELECT COUNT(DISTINCT TT.CODPROD)
            FROM (
                 SELECT DISTINCT NUNOTA
                 FROM AD_TGFEXP
                 WHERE DATA BETWEEN TO_DATE('${dataInicial}', 'YYYY-MM-DD') AND TO_DATE('${dataFinal}', 'YYYY-MM-DD') AND OPERADOR = CAB.AD_SEPARADORNEW
            ) EX
            JOIN TGFCAB CX ON CX.NUNOTA = EX.NUNOTA
            INNER JOIN TGFITE TT ON CX.NUNOTA = TT.NUNOTA
            ) AS produtos
      FROM TGFCAB CAB
      INNER JOIN AD_TGFEXP EXP ON EXP.NUNOTA = CAB.NUNOTA
      LEFT JOIN AD_SEPARADOR SEP ON CAB.AD_SEPARADORNEW = SEP.SEPARADOR
      WHERE EXP.DATA BETWEEN TO_DATE('${dataInicial}', 'YYYY-MM-DD') AND TO_DATE('${dataFinal}', 'YYYY-MM-DD')
        AND SEP.TIPO = '01'
        AND CAB.AD_SEPARADORNEW IS NOT NULL
      GROUP BY CAB.AD_SEPARADORNEW, SEP.DESCRICAO
    `;

    // Consulta para obter erros normais
    const errosQuery = `
      SELECT
        EXP.OPERADOR,
        COUNT(*) AS total_erros
      FROM TGFITE ERR
      JOIN AD_TGFEXP EXP ON EXP.NUNOTA = ERR.NUNOTA
      WHERE ERR.AD_NUNOTAERR IS NOT NULL
        AND EXP.DATA BETWEEN TO_DATE('${dataInicial}', 'YYYY-MM-DD') AND TO_DATE('${dataFinal}', 'YYYY-MM-DD')
      GROUP BY EXP.OPERADOR
    `;

    // Consulta para obter erros com status 9
    const errosStatus9Query = `
      SELECT
        EXP.OPERADOR,
        COUNT(*) AS total_erros_com_status_9
      FROM TGFITE ERR
      JOIN TGFCAB CAB ON ERR.NUNOTA = CAB.NUNOTA
      JOIN AD_TGFEXP EXP ON EXP.NUNOTA = ERR.NUNOTA
      WHERE ERR.AD_NUNOTAERR IS NOT NULL
        AND EXP.DATA BETWEEN TO_DATE('${dataInicial}', 'YYYY-MM-DD') AND TO_DATE('${dataFinal}', 'YYYY-MM-DD')
        AND EXISTS (
          SELECT 1
          FROM AD_TGFEXP EXP_STATUS
          WHERE EXP_STATUS.NUNOTA = ERR.NUNOTA
            AND EXP_STATUS.STATUS = '9'
            AND EXP_STATUS.OPERADOR = EXP.OPERADOR
        )
      GROUP BY EXP.OPERADOR
    `;

    // Executar as consultas em paralelo
    const [rankingResponse, errosResponse, errosStatus9Response] = await Promise.all([
      axios.post(
        'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
        { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql: rankingQuery } },
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'appkey': appkey } }
      ),
      axios.post(
        'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
        { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql: errosQuery } },
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'appkey': appkey } }
      ),
      axios.post(
        'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
        { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql: errosStatus9Query } },
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'appkey': appkey } }
      )
    ]);

    // Mapeamento de erros por separador
    const errosPorSeparador = {};
    if (errosResponse.data?.status === '1' && errosResponse.data.responseBody?.rows) {
      errosResponse.data.responseBody.rows.forEach(row => {
        errosPorSeparador[row[0]] = parseInt(row[1] || 0);
      });
    }

    // Mapeamento de erros com status 9 por separador
    const errosStatus9PorSeparador = {};
    if (errosStatus9Response.data?.status === '1' && errosStatus9Response.data.responseBody?.rows) {
      errosStatus9Response.data.responseBody.rows.forEach(row => {
        errosStatus9PorSeparador[row[0]] = parseInt(row[1] || 0);
      });
    }

    function getPosicaoTexto(ranking) {
      const rankingNum = parseInt(ranking);
      switch (rankingNum) {
        case 1: return 'Primeiro lugar';
        case 2: return 'Segundo lugar';
        case 3: return 'Terceiro lugar';
        default: return `${rankingNum}º lugar`;
      }
    }

    // Calcular pontuação e formar o ranking
    let ranking = [];
    if (rankingResponse.data?.status === '1' && rankingResponse.data.responseBody?.rows) {
      const rows = rankingResponse.data.responseBody.rows;
      // Calcular pontuação para cada separador
      ranking = rows.map(row => {
        const codigo = row[0];
        const nome = row[1];
        const pedidos = parseInt(row[2] || 0);
        const volumes = parseInt(row[3] || 0);
        const produtos = parseInt(row[4] || 0);

        // Obter os erros dos mapas, usando 0 como padrão se não encontrado
        const erros = errosPorSeparador[codigo] || 0;
        const errosStatus9 = errosStatus9PorSeparador[codigo] || 0;

        // Pontuação bruta
        const pontuacaoBruta = (pedidos * 10) + (volumes * 1) + (produtos * 4);

        // Deduzir pontos por erros com status 9 (5 pontos por erro)
        const deducaoPorErros = errosStatus9 * 5;

        // Pontuação final (não pode ser negativa)
        const pontuacaoTotal = Math.max(0, pontuacaoBruta - deducaoPorErros);

        return {
          separador_codigo: codigo,
          nome_separador: nome,
          pedidos_internos: pedidos,
          volumes: volumes,
          produtos: produtos,
          erros_encontrados: erros,
          erros_com_status_9: errosStatus9,
          pontuacao_bruta: pontuacaoBruta,
          deducao_por_erros: deducaoPorErros,
          pontuacao_total: pontuacaoTotal,
          detalhamento: {
            pontos_pedidos: pedidos * 10,
            pontos_volumes: volumes * 1,
            pontos_produtos: produtos * 4,
            formula: `((${pedidos} * 10) + (${volumes} * 1) + (${produtos} * 4)) - (${errosStatus9} * 5)`,
            pontuacao_bruta: pontuacaoBruta,
            deducao_por_erros: deducaoPorErros,
            pontuacao_final: pontuacaoTotal
          }
        };
      });

      // Ordenar por pontuação total (do maior para o menor)
      ranking.sort((a, b) => b.pontuacao_total - a.pontuacao_total);

      // Atribuir posição no ranking e calcular pontos_atras
      ranking.forEach((separador, index) => {
        separador.ranking = index + 1;
        separador.posicao = getPosicaoTexto(index + 1);

        // Calcular pontos_atras em relação ao separador na posição anterior (se não for o primeiro)
        if (index > 0) {
          const separadorAcima = ranking[index - 1];
          separador.pontos_atras = separadorAcima.pontuacao_total - separador.pontuacao_total;
        } else {
          separador.pontos_atras = 0; // O primeiro colocado não está atrás de ninguém
        }
      });
    }

    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    return res.json({
      periodo: `${meses[mesAtual - 1]}/${anoAtual}`,
      data_referencia: `${dataInicial} a ${dataFinal}`,
      total_separadores: ranking.length,
      ranking: ranking
    });

  } catch (error) {
    console.error('Erro ao obter ranking completo:', error);
    const errorDetails = error.response?.data || error.message || 'Erro desconhecido';
    return res.status(500).json({
      error: 'Erro ao obter ranking dos separadores',
      details: errorDetails
    });
  }
};

// Exportar as funções
export { listarOrdensPorSeparador, calcularPontuacaoSeparadores, obterRankingCompleto };
