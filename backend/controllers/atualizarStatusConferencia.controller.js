import axios from 'axios';
import { db } from '../database/connection.database.js'; // Assumindo que você tenha a conexão com o banco configurada
import dotenv from 'dotenv';

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

// Controller - Atualizar status da conferência
export const atualizarStatusConferencia = async (req, res) => {
  const { nroUnico } = req.params; // Número único do pedido (NUNOTA)
  const { separadorCodigo } = req.body; // Código do separador (CODSEP)
  const novoStatus = "7"; // Conferência Iniciada (novo status)

  try {
    const token = await getBearerTokenFromDB(); // Obtendo o bearer token do banco de dados

    if (!token) {
      return res.status(500).json({ erro: 'Token de autenticação não encontrado' });
    }

    // 1. Verificar se o separador já está associado a um pedido com status 7
    const verificarSeparadorResponse = await axios.post(
      'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DatasetSP.load&outputType=json',
      {
        serviceName: "DatasetSP.load",
        requestBody: {
          entityName: "CabecalhoNota", // Instância da tabela
          standAlone: false,
          fields: ["AD_STATUSDACONFERENCIA", "AD_SEPARADORNEW"], // Campos para buscar o status e separador
          records: [
            {
              fields: {
                "AD_SEPARADORNEW": separadorCodigo, // Verificar se o separador já está associado a algum pedido
              }
            }
          ]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      }
    );

    // Verificando se existe algum pedido com o separador e status 7
    const pedidoExistente = verificarSeparadorResponse.data?.records?.find(record => record.fields["AD_STATUSDACONFERENCIA"] === "7");

    // Se encontrar um pedido com status 7, não permite iniciar outra conferência
    if (pedidoExistente) {
      return res.status(400).json({
        erro: `O separador ${separadorCodigo} já está associado a um pedido com status 'Conferência Iniciada'. Não é possível iniciar uma nova conferência.`
      });
    }

    // 2. Se não houver pedidos com o separador e status 7, prossegue com a atualização
    const requestBody = {
      serviceName: "DatasetSP.save",
      requestBody: {
        entityName: "CabecalhoNota", // Instância da tabela
        standAlone: false,
        fields: ["AD_STATUSDACONFERENCIA", "AD_SEPARADORNEW"], // Campos a serem atualizados
        records: [
          {
            pk: { NUNOTA: nroUnico }, // Chave primária do pedido
            values: {
              "0": novoStatus, // Novo status da conferência
              "1": separadorCodigo // Código do separador
            }
          }
        ]
      }
    };

    // Fazendo a requisição para atualizar o status na API do Sankhya
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

    // Log da resposta da API
    console.log("Resposta da API Sankhya:", response.data);

    // Verificando se a atualização foi bem-sucedida
    if (response.data?.status === '1') {
      return res.json({ mensagem: `Status do pedido ${nroUnico} atualizado para 'Conferência Iniciada' e separador registrado.` });
    } else {
      console.error("Erro na resposta da API Sankhya:", response.data);
      return res.status(400).json({ erro: "Erro ao atualizar o status da conferência." });
    }
  } catch (error) {
    console.error("Erro ao atualizar o status da conferência:", error);
    return res.status(500).json({ erro: "Erro ao atualizar o status da conferência." });
  }
};
