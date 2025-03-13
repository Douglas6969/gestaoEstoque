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

export const separacaoFinalizada = async (req, res) => {
  const { nroUnico } = req.params;
  const { separadorCodigo } = req.body;
  const novoStatus = "4";

  try {
    const token = await getBearerTokenFromDB();
    if (!token) {
      return res.status(500).json({ erro: 'Token de autenticação não encontrado' });
    }

    const verificarSeparadorResponse = await axios.post(
      'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DatasetSP.load&outputType=json',
      {
        serviceName: "DatasetSP.load",
        requestBody: {
          entityName: "CabecalhoNota",
          standAlone: false,
          fields: ["AD_CODIGO", "AD_SEPARADORNEW"],
          filters: { "AD_SEPARADORNEW": separadorCodigo }
        }
      },
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    const pedidoExistente = verificarSeparadorResponse.data?.responseBody?.records?.find(record => record.fields["AD_CODIGO"] === "7");
    if (pedidoExistente) {
      return res.status(400).json({ erro: `O separador ${separadorCodigo} já está associado a um pedido com status 'Conferência Iniciada'.` });
    }

    const requestBody = {
      serviceName: "DatasetSP.save",
      requestBody: {
        entityName: "CabecalhoNota",
        standAlone: false,
        fields: ["AD_CODIGO", "AD_SEPARADORNEW"],
        records: [{ pk: { NUNOTA: nroUnico }, values: { "0": novoStatus, "1": separadorCodigo } }]
      }
    };

    const response = await axios.post(
      'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DatasetSP.save&outputType=json',
      requestBody,
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    if (response.data?.status === '1') {
      const formatarDataHora = () => moment().tz("America/Sao_Paulo").format("DD/MM/YYYY HH:mm:ss");

      const updateRequestBodyStatus3 = {
        serviceName: "DatasetSP.save",
        requestBody: {
          entityName: "AD_TGFEXP",
          standAlone: false,
          fields: ["DATA",  "OPERADOR"],
          records: [{ pk: { NUNOTA: nroUnico, STATUS: "4" }, values: { "0": formatarDataHora(),  "1": separadorCodigo } }]
        }
      };

      const updateResponseStatus3 = await axios.post(
        'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DatasetSP.save&outputType=json',
        updateRequestBodyStatus3,
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      if (updateResponseStatus3.data?.status !== '1') {
        console.error("Erro ao atualizar a tabela AD_TGFEXP:", updateResponseStatus3.data);
        return res.status(400).json({ erro: "Erro ao atualizar a tabela AD_TGFEXP para o status 3." });
      }

      return res.json({ mensagem: `Status do pedido ${nroUnico} atualizado para 'Separação Finalizada' e separador registrado.` });
    } else {
      console.error("Erro na resposta da API Sankhya:", response.data);
      return res.status(400).json({ erro: "Erro ao atualizar o status da conferência." });
    }
  } catch (error) {
    console.error("Erro ao atualizar o status da conferência:", error);
    return res.status(500).json({ erro: "Erro ao atualizar o status da conferência." });
  }
};