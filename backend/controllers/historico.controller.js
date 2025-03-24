import axios from 'axios';
import { db } from '../database/connection.database.js';
import moment from 'moment-timezone';

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

export const atualizarHistorico = async (req, res) => {
  const { nroUnico } = req.params; 

  try {
    console.log(`🔍 Buscando histórico para o pedido: ${nroUnico}`);
    const token = await getBearerTokenFromDB();
    const appkey = process.env.SANKHYA_APPKEY;

    if (!token) {
      return res.status(500).json({ erro: 'Token de autenticação não encontrado' });
    }

    const sqlQuery = `SELECT DATA, NUNOTA, CODUSU, OPERADOR, STATUS FROM AD_TGFEXP WHERE NUNOTA = :nroUnico AND DATA IS NOT NULL`;

    const requestBodyConsulta = {
      serviceName: 'DbExplorerSP.executeQuery',
      requestBody: { sql: sqlQuery.replace(':nroUnico', nroUnico) }
    };

    console.log('📝 Consultando histórico...');
    const consultaResponse = await axios.post(
      'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
      requestBodyConsulta,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'appkey': appkey
        }
      }
    );

    const rows = consultaResponse.data.responseBody?.rows;
    if (!rows || rows.length === 0) {
      console.warn(`❌ Nenhum registro encontrado para o pedido: ${nroUnico}`);
      return res.status(404).json({ erro: 'Nenhum registro encontrado para atualização' });
    }

    const [DATA, NUNOTA, CODUSU, OPERADOR, STATUS] = rows[0];
    console.log('✅ Registro encontrado:', { DATA, NUNOTA, CODUSU, OPERADOR, STATUS });

    // Verificar se DATA não está nulo ou vazio
    if (!DATA) {
      return res.status(400).json({ erro: 'Data inválida recebida do banco de dados' });
    }

    // Converter a data no formato 'DDMMYYYY HH:mm:ss' para 'DD/MM/YYYY HH:mm:ss'
    const dataFormatada = moment(DATA, 'DDMMYYYY HH:mm:ss', true).isValid()
      ? moment(DATA, 'DDMMYYYY HH:mm:ss').format('DD/MM/YYYY HH:mm:ss')
      : null;

    if (!dataFormatada) {
      console.error(`❌ Erro ao converter DATA: ${DATA}`);
      return res.status(400).json({ erro: 'Data inválida recebida do banco de dados' });
    }

    const requestBodyUpdate = {
      serviceName: 'DatasetSP.save',
      requestBody: {
        entityName: 'AD_TGFEXP',
        standAlone: false,
        fields: ['DATAFIN', 'CODUSU', 'OPERADOR'],
        records: [
          {
            pk: {
              DATA: dataFormatada, 
              NUNOTA
            },
            values: {
              '0': moment().tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm:ss'), 
              '1': CODUSU,
              '2': OPERADOR
            }
          }
        ]
      }
    };

    console.log('🔄 Enviando atualização para o Sankhya...');
    const updateResponse = await axios.post(
      'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DatasetSP.save&outputType=json',
      requestBodyUpdate,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'appkey': appkey
        }
      }
    );

    if (updateResponse.data?.status !== '1') {
      console.error('❌ Erro na atualização:', updateResponse.data);
      return res.status(400).json({ erro: 'Erro ao atualizar histórico' });
    }

    console.log(`✅ Histórico atualizado com sucesso para o pedido: ${nroUnico}`);
    return res.json({ mensagem: `Histórico atualizado com sucesso para o pedido ${nroUnico}` });

  } catch (error) {
    console.error('🔥 Erro ao atualizar histórico:', error.response?.data || error.message);
    return res.status(500).json({ erro: 'Erro ao atualizar histórico', detalhes: error.response?.data || error.message });
  }
};
