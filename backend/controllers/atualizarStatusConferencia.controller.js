import axios from 'axios';
import { db } from '../database/connection.database.js';
import dotenv from 'dotenv';
import moment from 'moment-timezone';

dotenv.config();

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

export const atualizarStatusConferencia = async (req, res) => {
  const { nroUnico } = req.params;
  const { separadorCodigo } = req.body;
  const novoStatus = "2"; // Novo status de conferência

  try {
    // Busca o token de autenticação do banco de dados
    const token = await getBearerTokenFromDB();
    if (!token) {
      return res.status(500).json({ erro: 'Token de autenticação não encontrado' });
    }

    // Monta o corpo da requisição para a API Sankhya
    const requestBody = {
      serviceName: "DatasetSP.save",
      requestBody: {
        entityName: "CabecalhoNota",
        standAlone: false,
        fields: ["AD_CODIGO", "AD_SEPARADORNEW"],
        records: [
          {
            pk: { NUNOTA: nroUnico },
            values: {
              "0": novoStatus,
              "1": separadorCodigo
            }
          }
        ]
      }
    };

    // Chama a API Sankhya para atualizar o status da ordem
    const response = await axios.post(
      'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DatasetSP.save&outputType=json',
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Se a resposta for positiva, prossegue com a atualização da tabela AD_TGFEXP
    if (response.data?.status === '1') {
      const formatarDataHora = () => moment().tz("America/Sao_Paulo").format("DD/MM/YYYY HH:mm:ss"); // Formato correto

      const insertRequestBody = {
        serviceName: "DatasetSP.save",
        requestBody: {
          entityName: "AD_TGFEXP",
          standAlone: false,
          fields: ["DATA", "NUNOTA", "STATUS", "CODUSU", "OPERADOR"],
          records: [
            {
              values: {
                "0": formatarDataHora(),
                "1": nroUnico,
                "2": novoStatus,
                "3": "0", // Pode ser substituído por um código de usuário se necessário
                "4": separadorCodigo // Pode ser ajustado dependendo do campo correto para "OPERADOR"
              }
            }
          ]
        }
      };

      // Chama a API Sankhya para inserir o histórico na tabela AD_TGFEXP
      const insertResponse = await axios.post(
        'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DatasetSP.save&outputType=json',
        insertRequestBody,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Verifica se a inserção na tabela AD_TGFEXP foi bem-sucedida
      if (insertResponse.data?.status !== '1') {
        console.error("Erro ao registrar na tabela AD_TGFEXP:", insertResponse.data);
        return res.status(400).json({ erro: "Erro ao registrar na tabela AD_TGFEXP." });
      }

      return res.json({ mensagem: `Status do pedido ${nroUnico} atualizado para 'Conferência Iniciada' e separado pelo código ${separadorCodigo}.` });
    } else {
      console.error("Erro na resposta da API Sankhya:", response.data);
      return res.status(400).json({ erro: "Erro ao atualizar o status da conferência." });
    }

  } catch (error) {
    console.error("Erro ao atualizar status da conferência:", error);
    return res.status(500).json({ erro: "Erro ao atualizar o status da conferência." });
  }
};

  