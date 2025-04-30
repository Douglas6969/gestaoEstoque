import axios from 'axios';
import { db } from '../../database/connection.database.js';
import dotenv from 'dotenv';
import moment from 'moment-timezone';

dotenv.config();

export const iniciarConferencia = async (req, res) => {
    const { codigoConferente } = req.params;
    
    // Aceitar tanto nroUnico quanto nruUnico (para compatibilidade)
    const nroUnico = req.body.nroUnico || req.body.nruUnico;
    
    const novoStatus = "5"; // Status de conferência iniciada
    
    console.log("Body recebido:", req.body);
    console.log("nroUnico processado:", nroUnico);
    
    try {
        // 1. Validação dos parâmetros
        if (!codigoConferente || isNaN(Number(codigoConferente))) {
            return res.status(400).json({ erro: "Código do conferente inválido." });
        }
        
        if (!nroUnico) {
            return res.status(400).json({
                erro: "Número único não informado.",
                detalhe: "Certifique-se de que o campo 'nroUnico' ou 'nruUnico' está presente no corpo da requisição."
            });
        }
        
        // Garantir que nroUnico seja tratado como string para evitar problemas com números grandes
        const nroUnicoStr = String(nroUnico);
        if (!/^\d+$/.test(nroUnicoStr)) {
            return res.status(400).json({ 
                erro: "Número único inválido.", 
                detalhe: "O número único deve conter apenas dígitos."
            });
        }
        
        // 2. Busca usuário e token
        const userResult = await db.query(
            'SELECT id_usuario FROM usuario WHERE codsep = $1',
            [Number(codigoConferente)]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ erro: "Conferente não encontrado." });
        }
        
        const id_usuario = userResult.rows[0].id_usuario;
        
        const tokenResult = await db.query(
            'SELECT bearer_token FROM tokens_usuario WHERE id_usuario = $1 ORDER BY id DESC LIMIT 1',
            [id_usuario]
        );
        
        if (tokenResult.rows.length === 0 || !tokenResult.rows[0].bearer_token) {
            return res.status(404).json({ 
                erro: 'Token de autenticação não encontrado para o usuário.' 
            });
        }
        
        const bearerToken = tokenResult.rows[0].bearer_token;
        
        // 3. Atualiza o status da nota diretamente
        const atualizaRequestBody = {
            serviceName: "DatasetSP.save",
            requestBody: {
                entityName: "CabecalhoNota",
                standAlone: false,
                fields: ["AD_CODIGO", "AD_SEPARADORNEW"],
                records: [
                    {
                        pk: { NUNOTA: nroUnicoStr },
                        values: {
                            "0": novoStatus,
                            "1": codigoConferente
                        }
                    }
                ]
            }
        };
        
        console.log("Request para atualizar nota:", JSON.stringify(atualizaRequestBody, null, 2));
        
        const atualizaResponse = await axios.post(
            "https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DatasetSP.save&outputType=json",
            atualizaRequestBody,
            {
                headers: {
                    'Authorization': `Bearer ${bearerToken}`,
                    'Content-Type': 'application/json',
                    'appkey': process.env.SANKHYA_APPKEY
                }
            }
        );
        
        if (atualizaResponse.data?.status !== "1") {
            // Resposta detalhada de erro da Sankhya
            console.error("Erro na resposta da API Sankhya:", atualizaResponse.data);
            return res.status(400).json({
                erro: "Erro ao atualizar o status da conferência.",
                motivo: atualizaResponse.data?.statusMessage || JSON.stringify(atualizaResponse.data)
            });
        }
        
        // 4. Registra histórico de conferência
        const dataHoraAtual = moment().tz("America/Sao_Paulo").format("DD/MM/YYYY HH:mm:ss");
        
        const historicoRequestBody = {
            serviceName: "DatasetSP.save",
            requestBody: {
                entityName: "AD_TGFEXP",
                standAlone: false,
                fields: ["DATA", "NUNOTA", "STATUS", "CODUSU", "OPERADOR"],
                records: [
                    {
                        values: {
                            "0": dataHoraAtual,
                            "1": nroUnicoStr,
                            "2": novoStatus,
                            "3": "0",
                            "4": codigoConferente
                        }
                    }
                ]
            }
        };
        
        console.log("Request para registrar histórico:", JSON.stringify(historicoRequestBody, null, 2));
        
        const historicoResponse = await axios.post(
            "https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DatasetSP.save&outputType=json",
            historicoRequestBody,
            {
                headers: {
                    'Authorization': `Bearer ${bearerToken}`,
                    'Content-Type': 'application/json',
                    'appkey': process.env.SANKHYA_APPKEY
                }
            }
        );
        
        if (historicoResponse.data?.status !== "1") {
            console.error("Erro ao registrar histórico:", historicoResponse.data);
            return res.status(400).json({ 
                erro: "Erro ao registrar histórico de início da conferência.",
                motivo: historicoResponse.data?.statusMessage || JSON.stringify(historicoResponse.data)
            });
        }
        
        // Finaliza OK
        return res.json({
            mensagem: `Conferência iniciada no pedido ${nroUnicoStr} pelo conferente ${codigoConferente}.`,
            dataHora: dataHoraAtual
        });
    } catch (error) {
        console.error("Erro ao iniciar conferência:", error);
        
        // Melhor tratamento do erro
        let detalhesErro = 'Erro interno no servidor';
        
        if (error.response && error.response.data) {
            detalhesErro = typeof error.response.data === 'object' 
                ? JSON.stringify(error.response.data) 
                : error.response.data;
        } else if (error.message) {
            detalhesErro = error.message;
        }
        
        return res.status(500).json({
            erro: "Erro ao iniciar a conferência.",
            detalhes: detalhesErro
        });
    }
};
