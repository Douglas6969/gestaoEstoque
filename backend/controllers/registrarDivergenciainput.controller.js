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

// Função para registrar divergência no input
export const registrarDivergenciainput = async (req, res) => {
    const { nroUnico, sequencia } = req.params;
    const { motivoDivergencia } = req.body;

    // Verificação de parâmetros obrigatórios
    if (!nroUnico || !sequencia || !motivoDivergencia) {
        return res.status(400).json({ erro: "Número único, sequência e motivo da divergência são obrigatórios." });
    }

    try {
        const token = await getBearerTokenFromDB(); 

        if (!token) {
            return res.status(500).json({ erro: 'Token de autenticação não encontrado' });
        }

        const payload = {
            serviceName: "CACSP.incluirAlterarItemNota",
            requestBody: {
                nota: {
                    NUNOTA: nroUnico,
                    SEQUENCIA: sequencia,
                    itens: {
                        item: {
                            NUNOTA: { "$": nroUnico },
                            SEQUENCIA: { "$": sequencia },
                            AD_MOTIVOSEPARADOR: { "$": motivoDivergencia }
                        }
                    }
                }
            }
        };

        const response = await axios.post(
            'https://api.sandbox.sankhya.com.br/gateway/v1/mgecom/service.sbr?serviceName=CACSP.incluirAlterarItemNota&outputType=json',
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (response.data?.status === '1') {
            return res.json({ mensagem: `Divergência registrada para o pedido ${nroUnico}.` });
        } else {
            return res.status(400).json({ erro: "Erro ao registrar a divergência.", detalhes: response.data });
        }
        
    } catch (error) {
        console.error('Erro ao registrar divergência:', error.response?.data || error.message);
        if (error.response) {
            console.error('Detalhes do erro:', error.response);
        }
        return res.status(500).json({ erro: "Erro interno ao processar a requisição." });
    }
};
