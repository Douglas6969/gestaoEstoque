import axios from 'axios';
import { db } from '../database/connection.database.js';
import dotenv from 'dotenv';
import moment from 'moment-timezone';
import jwt from 'jsonwebtoken';
import { getBearerToken } from './auth.controller.js';
dotenv.config();

// Função para obter o token do usuário a partir do token JWT

export const atualizarStatusConferencia = async (req, res) => {
    const { nroUnico } = req.params;
    const { separadorCodigo } = req.body;
    const novoStatus = "2"; // Novo status de conferência
    try {
        // Verificação de parâmetros
        if (!separadorCodigo || isNaN(parseInt(separadorCodigo, 10))) {
            return res.status(400).json({ erro: "Código do separador inválido." });
        }

        // Buscar o id_usuario no banco de dados com base no separadorCodigo
        const result = await db.query('SELECT id_usuario FROM usuario WHERE codsep = $1', [parseInt(separadorCodigo, 10)]);
        if (result.rows.length === 0) {
            return res.status(404).json({ erro: "Separador não encontrado." });
        }
        const id_usuario = result.rows[0].id_usuario;
        console.log('ID do usuário obtido:', id_usuario);

        const token = await getBearerToken(id_usuario);
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
                    'appkey': process.env.SANKHYA_APPKEY
                },
            }
        );

        // Se a resposta for positiva, prossegue com a atualização da tabela AD_TGFEXP
        if (response.data?.status === '1') {
            const formatarDataHora = () => moment().tz("America/Sao_Paulo").format("DD/MM/YYYY HH:mm:ss");
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
                                "3": "0",
                                "4": separadorCodigo
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
                        'appkey': process.env.SANKHYA_APPKEY
                    },
                }
            );

            // Verifica se a inserção na tabela AD_TGFEXP foi bem-sucedida
            if (insertResponse.data?.status !== '1') {
                console.error("Erro ao registrar na tabela AD_TGFEXP:", insertResponse.data);
                return res.status(400).json({ erro: "Erro ao registrar na tabela AD_TGFEXP." });
            }
            return res.json({
                mensagem: `Status do pedido ${nroUnico} atualizado para 'Conferência Iniciada' e separado pelo código ${separadorCodigo}.`
            });
        } else {
            console.error("Erro na resposta da API Sankhya:", response.data);
            return res.status(400).json({ erro: "Erro ao atualizar o status da conferência." });
        }
    } catch (error) {
        console.error("Erro ao atualizar status da conferência:", error);
        return res.status(500).json({
            erro: "Erro ao atualizar o status da conferência.",
            detalhes: error.message
        });
    }
};
