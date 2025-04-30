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
        AND CAB.AD_CODIGO IN ('7', '2','5')
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
          key: `${row.Data_Pedido}-${index}`,
          Nro_Unico: row[1] || null,
          Status: row[7] ? String(row[7]).trim() : 'Status não disponível',
          Des_Prioridade: row[14] || 'Normal',
          Cliente: row[2] || null,
          Qtd_Vol: row[4] || null,
          Data: row[0] || null,
          Ordem: row[3] || null,
          Nome_Separador: row[13] || 'Não informado'
        }));
        return res.json({ ordens: result });
      } else {
        return res.status(404).json({ error: 'Nenhuma ordem de carga encontrada' });
      }
    } else {
      return res.status(500).json({ error: 'Erro ao processar a resposta da API' });
    }
  } catch (error) {
    console.error('Erro ao listar ordens por separador:', error.response?.data || error.message);
    if (error.response) {
      console.error('Detalhes do erro:', error.response);
    }
    return res.status(500).json({ error: 'Erro ao listar ordens de carga', details: error.response?.data || error.message });
  }
};

const calcularPontuacaoSeparadores = async (req, res) => {
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
        AD_SEPARADORNEW,
        NVL(SEP.DESCRICAO, 'N/A') AS "Nome_Separador",
        COUNT(DISTINCT AD_PEDIDOINTERNO) AS Quantidade_Pedidos_Internos,
        SUM(QTDVOL) AS Quantidade_Volumes,
        SUM(Subquery.CODPROD) AS Quantidade_Produtos,
        (COUNT(DISTINCT AD_PEDIDOINTERNO) * 7) + (SUM(QTDVOL) * 2) + (SUM(Subquery.CODPROD) * 6) AS Pontuacao_Total
      FROM (
        SELECT
          CAB.AD_SEPARADORNEW,
          CAB.AD_PEDIDOINTERNO,
          CAB.QTDVOL,
          COUNT(ITE.CODPROD) AS CODPROD
        FROM TGFCAB CAB
        LEFT JOIN TGFITE ITE ON ITE.NUNOTA = CAB.NUNOTA
        WHERE AD_SEPARADORNEW = ${separadorCodigoInt}
        AND CAB.AD_PEDIDOINTERNO IS NOT NULL
        AND CAB.AD_DTSEPARACAO2 BETWEEN TRUNC(SYSDATE, 'MM') AND LAST_DAY(SYSDATE)
        GROUP BY
          AD_SEPARADORNEW,
          CAB.AD_PEDIDOINTERNO,
          CAB.QTDVOL
      ) Subquery
      LEFT JOIN AD_SEPARADOR SEP ON Subquery.AD_SEPARADORNEW = SEP.SEPARADOR
      GROUP BY AD_SEPARADORNEW, SEP.DESCRICAO
      ORDER BY Pontuacao_Total DESC
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
        const result = rows.map(row => ({
          separador_codigo: row[0],
          nome_separador: row[1],
          pedidos_internos: row[2],
          volumes: row[3],
          produtos: row[4],
          pontuacao_total: row[5]
        }));
        return res.json({ pontuacoes: result });
      } else {
        return res.status(404).json({ error: 'Nenhuma pontuação de separador encontrada' });
      }
    } else {
      return res.status(500).json({ error: 'Erro ao processar a resposta da API' });
    }
  } catch (error) {
    console.error('Erro ao calcular pontuação dos separadores:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Erro ao calcular pontuação', details: error.response?.data || error.message });
  }
};

export { listarOrdensPorSeparador, calcularPontuacaoSeparadores };
