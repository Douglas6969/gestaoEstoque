import axios from 'axios';
import dotenv from 'dotenv';
import moment from 'moment-timezone';

import { getBearerToken } from './auth.controller.js';
dotenv.config();

import { db } from '../database/connection.database.js';

export const atualizarHistorico = async (req, res) => {
  const { nroUnico, separadorCodigo } = req.params;

  // Validação
  if (!nroUnico) {
    return res.status(400).json({ erro: 'Parâmetro nroUnico é obrigatório.' });
  }

  const separadorCodigoInt = parseInt(separadorCodigo, 10);
  if (!separadorCodigo || isNaN(separadorCodigoInt)) {
    return res.status(400).json({ erro: 'Código do separador inválido.' });
  }

  // Busca id_usuario pelo código do separador
  let id_usuario;
  try {
    const result = await db.query('SELECT id_usuario FROM usuario WHERE codsep = $1', [separadorCodigoInt]);
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Separador não encontrado.' });
    }
    id_usuario = result.rows[0].id_usuario;
    if (!id_usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado via separador.' });
    }
    console.log('ID do usuário obtido:', id_usuario);
  } catch (dbErr) {
    return res.status(500).json({ erro: 'Erro ao buscar usuário pelo separador', detalhes: dbErr.message });
  }

  const nunota = parseInt(nroUnico, 10);

  try {
    const token = await getBearerToken(id_usuario);
    if (!token) {
      return res.status(500).json({ erro: 'Token não localizado para o usuário informado' });
    }

    const sql = `
      SELECT DATA, NUNOTA, OPERADOR
      FROM AD_TGFEXP
      WHERE NUNOTA = ${nunota} AND DATAFIN IS NULL
    `;

    const consultaResp = await axios.post(
      'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
      {
        serviceName: 'DbExplorerSP.executeQuery',
        requestBody: { sql }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'appkey': process.env.SANKHYA_APPKEY
        }
      }
    );

    const rows = consultaResp.data?.responseBody?.rows;
    if (!rows || !rows.length) {
      return res.status(404).json({
        erro: 'Nenhum registro pendente encontrado para atualização',
        diagnostico: { nunota, sql_usado: sql }
      });
    }

    const row = rows[0];
    console.log('🧾 Linha recebida do Sankhya:', row);
    
    // Posição dos dados no array
    const dataRaw = row[0];
    const NUNOTA = row[1];
    const OPERADOR = row[2];
    const CODUSU = id_usuario;
    
    if (!dataRaw) {
      console.error('❌ Erro: DATA ausente na resposta');
      return res.status(400).json({ erro: 'Data inválida recebida do banco de dados' });
    }
    
    const dataFormatada = moment(dataRaw, 'DDMMYYYY HH:mm:ss', true).isValid()
      ? moment(dataRaw, 'DDMMYYYY HH:mm:ss').format('DD/MM/YYYY HH:mm:ss')
      : null;
    
    if (!dataFormatada) {
      console.error(`❌ Erro ao converter DATA: ${dataRaw}`);
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
              NUNOTA: nunota
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
          'appkey': process.env.SANKHYA_APPKEY
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
