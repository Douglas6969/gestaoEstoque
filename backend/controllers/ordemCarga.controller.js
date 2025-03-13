import axios from 'axios';
import { db } from '../database/connection.database.js';
import dotenv from 'dotenv';

// Carregando as variáveis de ambiente
dotenv.config();

// Função para obter o bearer_token do banco de dados
const getBearerTokenFromDB = async () => {
  try {
    const result = await db.query('SELECT bearer_token FROM tokens LIMIT 1');
    
    if (result.rows.length === 0) {
      throw new Error('Bearer token não encontrado no banco de dados');
    }

    return result.rows[0].bearer_token;
  } catch (error) {
    console.error('Erro ao buscar bearer token do banco:', error.message);
    throw error;
  }
};

// Função para listar as ordens de carga
const listarOrdemCarga = async (req, res) => {
  try {
    const bearerToken = await getBearerTokenFromDB(); // Obtendo o bearer token do banco de dados
    const appkey = process.env.SANKHYA_APPKEY; // A appkey ainda vem do .env

    if (!bearerToken || !appkey) {
      return res.status(500).json({ error: 'Credenciais não encontradas' });
    }

    console.log("Bearer Token sendo usado:", bearerToken);

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
    END AS "Status",
    CAB.AD_DS_MOTIVODIV AS "Motivo",
    TOP.DESCROPER || ' - ' || CAB.CODTIPOPER AS "Top",
    NVL(PRODUTOS.CODPRODS, 'Nenhum produto') AS "Codigo_Produtos", 
    CAB.NUMCONTRATO,
    NVL(F_DESCROPC('TGFCAB', 'AD_PRIORIDADE', CAB.AD_PRIORIDADE), 'Normal') AS "Des_Prioridade",
    NVL(SEP.DESCRICAO, 'N/A') AS "Nome_Separador",    
    NVL(CAB.AD_PRIORIDADE, 1) AS "Prioridade",
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
    AND CAB.AD_CODIGO IN ('1', '2', '7')
    ORDER BY "Prioridade",  AD_ORDEMPEDIDO ASC, "Nro_Unico" 
    `;

    const requestBody = {
      serviceName: 'DbExplorerSP.executeQuery',
      requestBody: { sql: sqlQuery }
    };

    // Enviando a requisição com Bearer Token
    const response = await axios.post(
      'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${bearerToken}`, // Usando o bearer token obtido do banco
          'Content-Type': 'application/json',
          'appkey': appkey
        }
      }
    );

    console.log('Resposta da API:', response.data);

    if (response.data?.status === '1' && response.data.responseBody?.rows) {
      const rows = response.data.responseBody.rows;
      console.log('Linhas retornadas:', rows);
      
      if (Array.isArray(rows) && rows.length > 0) {
        const result = rows.map((row) => ({
          Data: row[0] || null,
          Nro_Unico: row[1] || null,
          Cliente: row[2] || null,
          Ordem: row[3] || null,
          Qtd_Vol: row[4] || null,
          Transportadora: row[5] || null,
          Nome_Empresa: row[6] || null,
          Status: row[7] || null,
          Motivo: row[8] || null,
          Top: row[9] || null,
          Codigo_Produtos: row[10] || 'Nenhum produto',
          NumContrato: row[11] || null,
          Des_Prioridade: row[12] || 'Normal',
          Nome_Separador: row[13] || 'Não informado',
          Total_Numeros_Unicos: row[14] || 0
        }));

        return res.json({ ordens: result });
      } else {
        console.log('Nenhuma ordem de carga encontrada');
        return res.status(404).json({ error: 'Nenhuma ordem de carga encontrada' });
      }
    } else {
      console.error('Erro na resposta da API:', response.data?.statusMessage || 'Desconhecido');
      return res.status(500).json({ error: 'Erro ao processar a resposta da API' });
    }
  } catch (error) {
    console.error('Erro ao listar ordens de carga:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Erro ao listar ordens de carga' });
  }
};

export { listarOrdemCarga };
