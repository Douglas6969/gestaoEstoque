import axios from 'axios';
import { db } from '../database/connection.database.js'; // Conexão com o banco de dados

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

// Controller - Atualizar status da conferência com registro de divergência
export const registrarDivergencia = async (req, res) => {
  const { nroUnico } = req.params; // Número único do pedido (NUNOTA)
  const { separadorCodigo, divergencia } = req.body; // Código do separador e a divergência encontrada
  const novoStatus = "3"; // Conferência Iniciada (novo status)

  try {
    const token = await getBearerTokenFromDB(); // Obtendo o bearer token do banco de dados

    if (!token) {
      return res.status(500).json({ erro: 'Token de autenticação não encontrado' });
    }

    // Montando o payload da requisição
    const requestBody = {
      serviceName: "DatasetSP.save",
      requestBody: {
        entityName: "CabecalhoNota", // Instância da tabela
        standAlone: false,
        fields: ["AD_STATUSDACONFERENCIA"], // Campos a serem atualizados
        records: [
          {
            pk: { NUNOTA: nroUnico }, // Chave primária do pedido
            values: {
              "0": novoStatus, // Novo status da conferência
            }
          }
        ]
      }
    };

    // Fazendo a requisição à API da Sankhya
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
      return res.json({ mensagem: `Status do pedido ${nroUnico} atualizado para 'divergência encontrada'.` });
    } else {
      console.error("Erro na resposta da API Sankhya:", response.data);
      return res.status(400).json({ erro: "Erro ao atualizar o status da conferência." });
    }
  } catch (error) {
    console.error("Erro ao atualizar o status da conferência:", error);
    return res.status(500).json({ erro: "Erro ao atualizar o status da conferência." });
  }
};
