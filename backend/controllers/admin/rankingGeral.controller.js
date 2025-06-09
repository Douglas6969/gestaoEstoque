// controllers/admin/rankingGeral.controller.js
import axios from 'axios';
import { db } from '../../database/connection.database.js'; // Ajuste o caminho
import { getBearerToken } from '../auth.controller.js'; // Ajuste o caminho
import dotenv from 'dotenv';

dotenv.config();

// ... (Mantenha a função listarPorSeparador se ainda precisar dela) ...
const listarPorSeparador = async (req, res) => {
  const { separadorCodigo } = req.params;
  console.log('Valor do separador recebido:', separadorCodigo);
  const separadorCodigoInt = parseInt(separadorCodigo, 10);
  if (!separadorCodigo || isNaN(separadorCodigoInt)) {
    return res.status(400).json({ error: "Código do separador inválido." });
  }
  try {
    const usuarioResult = await db.query('SELECT id_usuario FROM usuario WHERE codsep IS NOT NULL LIMIT 1');
    if (usuarioResult.rows.length === 0) {
      return res.status(404).json({ error: "Nenhum usuário encontrado para autenticação no sistema local." });
    }
    const id_usuario = usuarioResult.rows[0].id_usuario;
    console.log('ID do usuário obtido para listar ordens:', id_usuario);
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
        AND SEP.SEPARADOR = ${separadorCodigoInt} -- <<< Esta linha filtra por separador específico
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


const listarOrdensGerais = async (req, res) => {
  // Não precisamos do separadorCodigo dos params aqui
  try {
    // Obter o primeiro ID de usuário disponível para usar como autenticação
    const usuarioResult = await db.query('SELECT id_usuario FROM usuario WHERE codsep IS NOT NULL LIMIT 1');
    if (usuarioResult.rows.length === 0) {
      return res.status(404).json({ error: "Nenhum usuário encontrado para autenticação no sistema local." });
    }
    const id_usuario = usuarioResult.rows[0].id_usuario;
    console.log('ID do usuário obtido para listar ordens gerais:', id_usuario);

    const token = await getBearerToken(id_usuario);
    const appkey = process.env.SANKHYA_APPKEY;

    if (!token) {
      return res.status(500).json({ erro: 'Token de autenticação não encontrado' });
    }

    // Sua query SQL para listar ordens GERAIS (REMOVIDO o filtro por SEP.SEPARADOR)
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
        NVL(SEP.DESCRICAO, 'N/A') AS "Nome_Separador", -- Mantido para mostrar o separador associado se houver
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
        AND CAB.AD_CODIGO IN ('2')
   
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
          Nome_Separador: row[13] || 'Não informado' // Ainda mostra o nome do separador se a ordem estiver associada
        }));
        return res.json({ ordens: result });
      } else {
        // Mensagem ajustada para refletir que não encontrou ordens nos critérios gerais
        return res.status(404).json({ error: 'Nenhuma ordem de carga encontrada com os critérios especificados.' });
      }
    } else {
      console.error('Resposta inesperada da API ao listar ordens gerais:', JSON.stringify(response.data, null, 2));
      return res.status(500).json({ error: 'Erro ao processar a resposta da API ao listar ordens gerais.' });
    }

  } catch (error) {
    console.error('Erro ao listar ordens gerais:', error.response?.data || error.message);
    if (error.response) {
      console.error('Detalhes do erro:', error.response.data);
    }
    return res.status(500).json({ error: 'Erro ao listar ordens de carga gerais', details: error.response?.data || error.message });
  }
};

const PontuacaoSeparadores = async (req, res) => {
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
    // Obter o primeiro ID de usuário disponível para usar como autenticação
    const usuarioResult = await db.query('SELECT id_usuario FROM usuario WHERE codsep IS NOT NULL LIMIT 1');
    if (usuarioResult.rows.length === 0) {
      return res.status(404).json({ error: "Nenhum usuário encontrado para autenticação no sistema local." });
    }
    const id_usuario = usuarioResult.rows[0].id_usuario;
    const token = await getBearerToken(id_usuario);
    const appkey = process.env.SANKHYA_APPkey; // Verifique se esta variável de ambiente está configurada

    if (!token) {
      return res.status(500).json({ erro: 'Token de autenticação não encontrado' });
    }

    // Definir os parâmetros de período para o mês atual
    const dataAtual = new Date();
    const mesAtual = dataAtual.getMonth() + 1; // JavaScript meses são 0-11
    const anoAtual = dataAtual.getFullYear();

    // Criar data inicial (primeiro dia do mês atual) e final (último dia do mês atual)
    const dataInicial = `${anoAtual}-${mesAtual.toString().padStart(2, '0')}-01`;
    const ultimoDia = new Date(anoAtual, mesAtual, 0).getDate();
    const dataFinal = `${anoAtual}-${mesAtual.toString().padStart(2, '0')}-${ultimoDia}`;
    console.log(`Período de consulta para pontuação: ${dataInicial} a ${dataFinal}`);

    // Consulta para obter dados de todos os separadores para o ranking (Pedidos, Volumes, Produtos)
    const rankingGeralQuery = `
      SELECT
          EXP.OPERADOR AS codigo,
          NVL(SEP.DESCRICAO, 'N/A') AS nome,
          COUNT(DISTINCT EXP.NUNOTA) AS pedidos,
          SUM(CAB.QTDVOL) AS volumes,
          -- NOVA LÓGICA PARA CONTAR PRODUTOS (DISTINTOS POR PEDIDO, SOMADO)
          (SELECT NVL(SUM(ProdutosPorPedido.Distinct_Produtos), 0)
           FROM (
               SELECT COUNT(DISTINCT TITE.CODPROD) AS Distinct_Produtos, TITE.NUNOTA
               FROM TGFITE TITE
               JOIN AD_TGFEXP RelevantOrders ON TITE.NUNOTA = RelevantOrders.NUNOTA
               WHERE RelevantOrders.DATA BETWEEN TO_DATE('${dataInicial}', 'YYYY-MM-DD') AND TO_DATE('${dataFinal}', 'YYYY-MM-DD')
               AND RelevantOrders.OPERADOR = EXP.OPERADOR -- Correlaciona com o operador da query externa
               GROUP BY TITE.NUNOTA
           ) ProdutosPorPedido
          ) AS produtos
      FROM AD_TGFEXP EXP
      INNER JOIN TGFCAB CAB ON CAB.NUNOTA = EXP.NUNOTA
      LEFT JOIN AD_SEPARADOR SEP ON EXP.OPERADOR = SEP.SEPARADOR
      WHERE EXP.DATA BETWEEN TO_DATE('${dataInicial}', 'YYYY-MM-DD') AND TO_DATE('${dataFinal}', 'YYYY-MM-DD')
        AND SEP.TIPO = '01'
        AND EXP.OPERADOR IS NOT NULL
      GROUP BY EXP.OPERADOR, SEP.DESCRICAO
    `;

    // Consulta para obter erros normais de cada separador
    const errosGeralQuery = `
      SELECT
        EXP.OPERADOR,
        COUNT(*) AS total_erros
      FROM TGFITE ERR
      JOIN AD_TGFEXP EXP ON EXP.NUNOTA = ERR.NUNOTA
      LEFT JOIN AD_SEPARADOR SEP ON EXP.OPERADOR = SEP.SEPARADOR
      WHERE ERR.AD_NUNOTAERR IS NOT NULL
        AND EXP.DATA BETWEEN TO_DATE('${dataInicial}', 'YYYY-MM-DD') AND TO_DATE('${dataFinal}', 'YYYY-MM-DD')
        AND SEP.TIPO = '01' -- Garantir que seja separador tipo 01
        AND EXP.OPERADOR IS NOT NULL
      GROUP BY EXP.OPERADOR
    `;

    // Consulta para obter erros que passaram pelo status 9 (contagem de ITENS com erro em notas que tiveram status 9)
    const errosStatus9Query = `
      SELECT
        EXP.OPERADOR,
        COUNT(*) AS total_erros_com_status_9
      FROM TGFITE ERR
      JOIN TGFCAB CAB ON ERR.NUNOTA = CAB.NUNOTA
      JOIN AD_TGFEXP EXP ON EXP.NUNOTA = ERR.NUNOTA
      LEFT JOIN AD_SEPARADOR SEP ON EXP.OPERADOR = SEP.SEPARADOR
      WHERE ERR.AD_NUNOTAERR IS NOT NULL
        AND EXP.DATA BETWEEN TO_DATE('${dataInicial}', 'YYYY-MM-DD') AND TO_DATE('${dataFinal}', 'YYYY-MM-DD')
        AND SEP.TIPO = '01' -- Garantir que seja separador tipo 01
        AND EXP.OPERADOR IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM AD_TGFEXP EXP_STATUS
          WHERE EXP_STATUS.NUNOTA = ERR.NUNOTA
            AND EXP_STATUS.STATUS = '9'
            AND EXP_STATUS.OPERADOR = EXP.OPERADOR
            AND EXP_STATUS.DATA BETWEEN TO_DATE('${dataInicial}', 'YYYY-MM-DD') AND TO_DATE('${dataFinal}', 'YYYY-MM-DD') -- Filtrar por data aqui também
        )
      GROUP BY EXP.OPERADOR
    `;

    // **NOVAS CONSULTAS PARA TOTAIS GERAIS (SEM GROUP BY OPERADOR):**

    // Consulta para obter TOTAL de NUNOTAs em status '1' (Contagem e Lista)
    // Esta consulta busca ordens *atualmente* em status '1' que fazem parte do processo de separação (tipo 01)
    const totalStatus1OrdersQuery = `
      SELECT
        COUNT(DISTINCT CAB.NUNOTA) AS total_count_status_1,
        LISTAGG(CAB.NUNOTA, ', ') WITHIN GROUP (ORDER BY CAB.NUNOTA) AS total_nunotas_status_1
      FROM TGFCAB CAB
      WHERE CAB.AD_CODIGO = '1'
        AND EXISTS (
            SELECT 1
            FROM AD_TGFEXP EXP
            LEFT JOIN AD_SEPARADOR SEP ON EXP.OPERADOR = SEP.SEPARADOR
            WHERE EXP.NUNOTA = CAB.NUNOTA
               AND ( CAB.PENDENTE = 'S' )
              
              AND EXP.OPERADOR IS NOT NULL
           
        )
     
    `;

    // Consulta para obter TOTAL de NUNOTAs em status '2' (Contagem e Lista)
    const totalStatus2OrdersQuery = `
      SELECT
        COUNT(DISTINCT CAB.NUNOTA) AS total_count_status_2,
        LISTAGG(CAB.NUNOTA, ', ') WITHIN GROUP (ORDER BY CAB.NUNOTA) AS total_nunotas_status_2
      FROM TGFCAB CAB
      INNER JOIN AD_TGFEXP EXP ON EXP.NUNOTA = CAB.NUNOTA -- Join para filtrar por separadores tipo 01 e data
      LEFT JOIN AD_SEPARADOR SEP ON EXP.OPERADOR = SEP.SEPARADOR
      WHERE CAB.AD_CODIGO = '2' -- Status 2
       
        AND EXP.OPERADOR IS NOT NULL
        AND EXP.DATA BETWEEN TO_DATE('${dataInicial}', 'YYYY-MM-DD') AND TO_DATE('${dataFinal}', 'YYYY-MM-DD')
      -- SEM GROUP BY OPERADOR
    `;

     // Consulta para obter TOTAL de NUNOTAs que passaram pelo status '9' (Contagem e Lista)
     // Nota: Esta consulta conta ordens que tiveram um registro em AD_TGFEXP com STATUS = '9'
    const totalStatus9OrdersQuery = `
      SELECT
        COUNT(DISTINCT EXP.NUNOTA) AS total_count_status_9,
        LISTAGG(EXP.NUNOTA, ', ') WITHIN GROUP (ORDER BY EXP.NUNOTA) AS total_nunotas_status_9
      FROM AD_TGFEXP EXP
      LEFT JOIN AD_SEPARADOR SEP ON EXP.OPERADOR = SEP.SEPARADOR
      WHERE EXP.STATUS = '9' -- Status 9
        
        AND EXP.OPERADOR IS NOT NULL
        AND EXP.DATA BETWEEN TO_DATE('${dataInicial}', 'YYYY-MM-DD') AND TO_DATE('${dataFinal}', 'YYYY-MM-DD')
      -- SEM GROUP BY OPERADOR
    `;


    // Executar as consultas em paralelo
    const [
      rankingGeralResponse,
      errosGeralResponse,
      errosStatus9Response,
      totalStatus1OrdersResponse, // Nova resposta para total
      totalStatus2OrdersResponse, // Nova resposta para total
      totalStatus9OrdersResponse  // Nova resposta para total
    ] = await Promise.all([
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
      ),
      axios.post( // Nova requisição para total status 1
        'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
        { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql: totalStatus1OrdersQuery } },
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'appkey': appkey } }
      ),
      axios.post( // Nova requisição para total status 2
        'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
        { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql: totalStatus2OrdersQuery } },
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'appkey': appkey } }
      ),
       axios.post( // Nova requisição para total status 9
        'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
        { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql: totalStatus9OrdersQuery } },
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'appkey': appkey } }
      )
    ]);

    // Mapeamento de erros normais por separador (ainda necessário para a pontuação individual)
    const errosPorSeparador = {};
    if (errosGeralResponse.data?.status === '1' && errosGeralResponse.data.responseBody?.rows) {
      errosGeralResponse.data.responseBody.rows.forEach(row => {
        errosPorSeparador[row[0]] = parseInt(row[1] || 0);
      });
    }

    // Mapeamento de erros com status 9 por separador (contagem de ITENS com erro) (ainda necessário para a pontuação individual)
    const errosStatus9PorSeparador = {};
    if (errosStatus9Response.data?.status === '1' && errosStatus9Response.data.responseBody?.rows) {
      errosStatus9Response.data.responseBody.rows.forEach(row => {
        errosStatus9PorSeparador[row[0]] = parseInt(row[1] || 0);
      });
    }

    // **PROCESSAMENTO DOS TOTAIS GERAIS DE STATUS:**

    let totalStatus1Data = { count: 0, nunotas: [] };
    if (totalStatus1OrdersResponse.data?.status === '1' && totalStatus1OrdersResponse.data.responseBody?.rows?.length > 0) {
        const row = totalStatus1OrdersResponse.data.responseBody.rows[0];
        const count = parseInt(row[0] || 0);
        const nunotasString = row[1];
        totalStatus1Data = {
            count: count,
            nunotas: nunotasString ? nunotasString.split(', ').map(Number) : []
        };
    }

    let totalStatus2Data = { count: 0, nunotas: [] };
     if (totalStatus2OrdersResponse.data?.status === '1' && totalStatus2OrdersResponse.data.responseBody?.rows?.length > 0) {
        const row = totalStatus2OrdersResponse.data.responseBody.rows[0];
        const count = parseInt(row[0] || 0);
        const nunotasString = row[1];
        totalStatus2Data = {
            count: count,
            nunotas: nunotasString ? nunotasString.split(', ').map(Number) : []
        };
    }

    let totalStatus9Data = { count: 0, nunotas: [] };
     if (totalStatus9OrdersResponse.data?.status === '1' && totalStatus9OrdersResponse.data.responseBody?.rows?.length > 0) {
        const row = totalStatus9OrdersResponse.data.responseBody.rows[0];
        const count = parseInt(row[0] || 0);
        const nunotasString = row[1];
        totalStatus9Data = {
            count: count,
            nunotas: nunotasString ? nunotasString.split(', ').map(Number) : []
        };
    }


    // Calcular pontuação e formar a lista de separadores com detalhes
    let separadoresComPontuacao = [];
    if (rankingGeralResponse.data?.status === '1' && rankingGeralResponse.data.responseBody?.rows) {
      const rows = rankingGeralResponse.data.responseBody.rows;

      // Calcular pontuação para cada separador
      separadoresComPontuacao = rows.map(row => {
        const codigo = row[0];
        const nome = row[1];
        const pedidos = parseInt(row[2] || 0);
        const volumes = parseInt(row[3] || 0);
        const produtos = parseInt(row[4] || 0); // Valor da subquery de produtos

        // Obter os erros dos mapas, usando valores padrão se não encontrado
        const erros = errosPorSeparador[codigo] || 0; // Total de itens com erro
        const errosStatus9 = errosStatus9PorSeparador[codigo] || 0; // Total de itens com erro em notas que tiveram status 9


        // Pontuação bruta
        const pontuacaoBruta = (pedidos * 10) + (volumes * 1) + (produtos * 4);

        // Deduzir pontos por erros com status 9 (5 pontos por erro de ITEM)
        const deducaoPorErros = errosStatus9 * 5;

        // Pontuação final (não pode ser negativa)
        const pontuacaoTotal = Math.max(0, pontuacaoBruta - deducaoPorErros);

        return {
          separador_codigo: codigo,
          nome_separador: nome,
          pedidos_internos: pedidos,
          volumes: volumes,
          produtos: produtos,
          erros_encontrados: erros, // Total de itens com erro
          erros_com_status_9: errosStatus9, // Total de itens com erro em notas que tiveram status 9
          // REMOVIDOS CAMPOS DE STATUS POR SEPARADOR

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
      separadoresComPontuacao.sort((a, b) => b.pontuacao_total - a.pontuacao_total);

      // Atribuir posição no ranking e calcular pontos_atras
      separadoresComPontuacao.forEach((separador, index) => {
        separador.ranking = index + 1;
        separador.posicao = getPosicaoTexto(index + 1);

        // Calcular pontos_atras em relação ao separador na posição anterior (se não for o primeiro)
        if (index > 0) {
          const separadorAcima = separadoresComPontuacao[index - 1];
          separador.pontos_atras = separadorAcima.pontuacao_total - separador.pontuacao_total;
        } else {
          separador.pontos_atras = 0; // O primeiro colocado não está atrás de ninguém
        }

        // Lógica especial para o separador 8 (sobrescreve o ranking calculado)
        // Mantenho esta lógica, mas note que ela força o separador 8 para o 1º lugar,
        // independentemente da pontuação calculada. Isso afeta APENAS a exibição do ranking
        // para o separador 8; a pontuação total calculada permanece a mesma.
        if (parseInt(separador.separador_codigo) === 8) {
             separador.ranking = 1;
             separador.posicao = "Primeiro lugar";
             separador.pontos_atras = 0; // Se é o primeiro (simulado), pontos_atras é 0
        }
      });

      // Se precisar que o separador 8 venha sempre primeiro na lista JSON, adicione uma lógica de ordenação customizada aqui.
      // Exemplo: separadoresComPontuacao.sort((a, b) => (parseInt(a.separador_codigo) === 8 ? -1 : (parseInt(b.separador_codigo) === 8 ? 1 : b.pontuacao_total - a.pontuacao_total)));
    }

    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const mesAtualNome = meses[mesAtual - 1];

    // Retornar a lista completa de separadores com pontuação e detalhes
    // E ADICIONAR OS TOTAIS GERAIS DE STATUS
    return res.json({
      periodo: `${mesAtualNome}/${anoAtual}`,
      data_referencia: `${dataInicial} a ${dataFinal}`,
      total_separadores: separadoresComPontuacao.length,

      // **TOTAIS GERAIS DE STATUS ADICIONADOS AQUI:**
      total_ordens_status_1_count: totalStatus1Data.count,
      total_ordens_status_1_list: totalStatus1Data.nunotas,
      total_ordens_status_2_count: totalStatus2Data.count,
      total_ordens_status_2_list: totalStatus2Data.nunotas,
      total_ordens_status_9_count: totalStatus9Data.count,
      total_ordens_status_9_list: totalStatus9Data.nunotas,
      // Fim dos totais gerais

      pontuacoes: separadoresComPontuacao // Retorna o array completo com ranking e detalhes
    });

  } catch (error) {
    console.error('Erro ao consultar pontuação geral:', error);
    const errorMessage = error.response?.data?.message || error.message || 'Erro desconhecido';
    return res.status(500).json({
      error: 'Falha ao consultar pontuação geral dos separadores',
      detalhes: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};



// Exporte as funções do controller
export { listarPorSeparador, PontuacaoSeparadores,listarOrdensGerais };
