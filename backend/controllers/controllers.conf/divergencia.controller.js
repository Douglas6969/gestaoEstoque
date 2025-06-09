import axios from 'axios';
import { db } from '../../database/connection.database.js';
import moment from 'moment-timezone';

const getBearerTokenFromDB = async (id_usuario) => {
    try {
        const result = await db.query('SELECT bearer_token FROM tokens_usuario WHERE id_usuario = $1', [id_usuario]);
        if (result.rows.length === 0) {
            throw new Error('Bearer token não encontrado no banco de dados');
        }
        return result.rows[0].bearer_token;
    } catch (error) {
        console.error('Erro ao buscar bearer token do banco:', error.message);
        throw error;
    }
};

const formatarDataHora = () => {
    return moment().tz("America/Sao_Paulo").format("DD/MM/YYYY HH:mm:ss");
};

// Controller - Atualizar status da conferência com registro de divergência
export const divergenciaConferente = async (req, res) => {
    const { nroUnico } = req.params;
    const { conferenteCodigo } = req.params; // Alterado para conferenteCodigo via body
    const novoStatus = "9"; // Alterado para status 8
    
    try {
        // Buscar id_usuario com base no conferenteCodigo
        const result = await db.query('SELECT id_usuario FROM usuario WHERE codsep = $1', [conferenteCodigo]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Conferente não encontrado." });
        }
        
        const id_usuario = result.rows[0].id_usuario;
        const token = await getBearerTokenFromDB(id_usuario);
        
        if (!token) {
            return res.status(500).json({ erro: 'Token de autenticação não encontrado' });
        }
        
        // Montando o payload da requisição para atualizar o status na tabela CabecalhoNota
        const requestBody = {
            serviceName: "DatasetSP.save",
            requestBody: {
                entityName: "CabecalhoNota",
                standAlone: false,
                fields: ["AD_CODIGO"],
                records: [
                    {
                        pk: { NUNOTA: nroUnico },
                        values: {
                            "0": novoStatus, // Status 8 para divergência de conferente
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
        
        console.log("Resposta da API Sankhya:", response.data);
        
        if (response.data?.status === '1') {
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
                                "2": "8", // Status 8 para divergência de conferente
                                "3": "0",
                                "4": conferenteCodigo // Código do conferente
                            }
                        }
                    ]
                }
            };
            
            const insertResponse = await axios.post(
                'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DatasetSP.save&outputType=json',
                insertRequestBody,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    }
                }
            );
            
            // Log da resposta da API
            console.log("Resposta da API Sankhya:", insertResponse.data);
            
            if (insertResponse.data?.status === '1') {
                return res.json({ mensagem: `Status do pedido ${nroUnico} atualizado para 'divergência encontrada pelo conferente'.` });
            }
            
            return res.json({ mensagem: `Status do pedido ${nroUnico} atualizado para 'Divergência Encontrada pelo Conferente' e registrado com sucesso.` });
        } else {
            console.error("Erro na resposta da API Sankhya:", response.data);
            return res.status(400).json({ erro: "Erro ao atualizar o status da conferência." });
        }
    } catch (error) {
        console.error("Erro ao atualizar o status da conferência:", error);
        return res.status(500).json({ erro: "Erro ao atualizar o status da conferência." });
    }
};
