import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import net from 'net';
import { db } from '../database/connection.database.js'; 

dotenv.config();

const app = express();
const port = 5000;


app.use(express.json());


const getBearerTokenFromDB = async () => {
  try {
    const result = await db.query('SELECT bearer_token FROM tokens LIMIT 1');
    if (result.rows.length === 0) {
      throw new Error('Bearer token não encontrado no banco de dados');
    }
    return result.rows[0].bearer_token;
  } catch (error) {
    console.error('Erro ao buscar bearer token:', error.message);
    throw error;
  }
};

// Função para buscar o nome do separador
const getSeparadorName = async (separadorCodigo) => {
  try {
    const token = await getBearerTokenFromDB();
    const appkey = process.env.SANKHYA_APPKEY;

    console.log('Código do separador:', separadorCodigo);

    const sqlQuery = `
      SELECT NVL(SEP.DESCRICAO, 'N/A') AS DESCRICAO
      FROM AD_SEPARADOR SEP
      WHERE SEP.SEPARADOR = ${parseInt(separadorCodigo, 10)}
        AND SEP.SEPARADOR IS NOT NULL
        AND SEP.DESCRICAO IS NOT NULL
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
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          appkey: appkey
        }
      }
    );

    console.log('Resposta completa da API Sankhya:', response.data);

    const result = response.data.responseBody?.rows;

    console.log('Resultado extraído:', result);

    // Verifica se retornou algo
    if (!result || result.length === 0) {
      return 'Separador Desconhecido';
    }

    // Lê o primeiro valor da linha retornada
    return result[0][0] || 'Separador Desconhecido';
  } catch (error) {
    console.error('Erro ao buscar nome do separador:', error.message);
    return 'Erro ao buscar nome';
  }
};




const sendToPrinter = (ip, port, content) => {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.connect(port, ip, () => {
      console.log('Conectado à impressora!');
      client.write(content, () => {
        client.end();
        resolve('Impressão enviada com sucesso!');
      });
    });
    client.on('error', (err) => {
      console.error('Erro ao conectar com a impressora:', err);
      reject('Erro ao conectar com a impressora.');
    });
  });
};

// Função para gerar o layout da etiqueta
const generatePrintLayout = (separador, nroUnico) => {
  return `
@ 
M1 
!8 
*** SEPARADOR *** 
${separador}

--------------------------

!8 
*** NUMERO UNICO *** 
${nroUnico}

==========================
`;
};

export const imprimirEtiqueta = async (req, res) => {
 
  const { nroUnico } = req.params;
  const { separadorCodigo } = req.body;

  console.log('Parâmetros recebidos:', { separadorCodigo, nroUnico }); 

 
  if (!separadorCodigo || !nroUnico) {
    return res.status(400).json({ erro: 'Parâmetros incompletos: separadorCodigo ou nroUnico faltando.' });
  }

  try {
    // Buscar nome do separador
    const separadorNome = await getSeparadorName(separadorCodigo);
    console.log('Nome do separador:', separadorNome); 

    // Gerar conteúdo da impressão
    const printContent = generatePrintLayout(separadorNome, nroUnico);
    console.log('Conteúdo da impressão:', printContent); 

    // Enviar para a impressora
    const printerIp = '10.10.10.181';
    const printerPort = 9100;
    await sendToPrinter(printerIp, printerPort, printContent);
    return res.json({ mensagem: 'Etiqueta enviada para a impressora com sucesso!' });
  } catch (error) {
    console.error('Erro ao imprimir etiqueta:', error.message);
    return res.status(500).json({ erro: 'Erro ao imprimir a etiqueta.' });
  }
};
