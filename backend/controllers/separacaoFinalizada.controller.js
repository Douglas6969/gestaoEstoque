import axios from 'axios';
import { db } from '../database/connection.database.js';
import moment from 'moment-timezone';
import dotenv from 'dotenv';
dotenv.config();

// Função para obter o token de autenticação do banco de dados
const getBearerTokenFromDB = async (id_usuario) => {
    try {
        const result = await db.query('SELECT bearer_token, expira_em FROM tokens_usuario WHERE id_usuario = $1', [id_usuario]);
        if (result.rows.length > 0) {
            const { bearer_token, expira_em } = result.rows[0];
            if (new Date(expira_em) > new Date()) {
                return bearer_token;
            }
        }
        return null;
    } catch (error) {
        console.error('Erro ao recuperar token do banco de dados:', error);
        return null;
    }
};

// Função fictícia de login para obter um novo token (você deve implementar isso conforme necessário)
const loginToSankhya = async (id_usuario) => {
    try {
        const response = await axios.post('https://api.sandbox.sankhya.com.br/gateway/v1/auth/login', {
            user: 'username', // Substitua pelo nome de usuário real
            password: 'password' // Substitua pela senha real
        });
        const newToken = response.data.token;
        const expiraEm = new Date();
        expiraEm.setHours(expiraEm.getHours() + 1); // Definindo a expiração para 1 hora a partir de agora

        // Armazenar o novo token no banco de dados
        await db.query('INSERT INTO tokens_usuario (id_usuario, bearer_token, expira_em) VALUES ($1, $2, $3)', [id_usuario, newToken, expiraEm]);

        return newToken;
    } catch (error) {
        console.error('Erro ao obter novo token de autenticação:', error);
        throw new Error('Erro ao obter novo token de autenticação');
    }
};

// Função para obter o token de autenticação
const getBearerToken = async (id_usuario) => {
    let bearerToken = await getBearerTokenFromDB(id_usuario);
    if (!bearerToken) {
        bearerToken = await loginToSankhya(id_usuario);
    }
    return bearerToken;
};

// Função para finalizar a separação
export const separacaoFinalizada = async (req, res) => {
    const { nroUnico } = req.params;
    const { separadorCodigo } = req.body;
    const novoStatus = "4"; // Status para 'Separação Finalizada'

    if (!nroUnico || !separadorCodigo) {
        return res.status(400).json({ erro: 'Parâmetros incompletos: nroUnico ou separadorCodigo faltando.' });
    }

    try {
        const separadorCodigoInt = parseInt(separadorCodigo, 10);
        if (isNaN(separadorCodigoInt)) {
            return res.status(400).json({ error: "Código do separador inválido." });
        }

        const result = await db.query('SELECT id_usuario FROM usuario WHERE codsep = $1', [separadorCodigoInt]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Separador não encontrado." });
        }

        const id_usuario = result.rows[0].id_usuario;
        console.log('ID do usuário obtido:', id_usuario);

        const token = await getBearerToken(id_usuario);
        if (!token) {
            return res.status(500).json({ erro: 'Token de autenticação não encontrado' });
        }

        const appkey = process.env.SANKHYA_APPKEY;
        if (!appkey) {
            return res.status(500).json({ erro: 'Appkey não configurada' });
        }

        // Verificar se o separador já está associado a um pedido com status 'Conferência Iniciada'
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
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'appkey': appkey
                }
            }
        );

        const pedidoExistente = verificarSeparadorResponse.data?.responseBody?.records?.find(record => record.fields["AD_CODIGO"] === "7");
        if (pedidoExistente) {
            return res.status(400).json({ erro: `O separador ${separadorCodigo} já está associado a um pedido com status 'Conferência Iniciada'.` });
        }

        // Atualizar o status do pedido para 'Separação Finalizada'
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
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'appkey': appkey
                }
            }
        );

        if (response.data?.status === '1') {
            const formatarDataHora = () => moment().tz("America/Sao_Paulo").format("DD/MM/YYYY HH:mm:ss");

            // Atualizar a tabela AD_TGFEXP para o status 4
            const updateRequestBodyStatus4 = {
                serviceName: "DatasetSP.save",
                requestBody: {
                    entityName: "AD_TGFEXP",
                    standAlone: false,
                    fields: ["DATA", "OPERADOR"],
                    records: [{ pk: { NUNOTA: nroUnico, STATUS: "4" }, values: { "0": formatarDataHora(), "1": separadorCodigo } }]
                }
            };

            const updateResponseStatus4 = await axios.post(
                'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DatasetSP.save&outputType=json',
                updateRequestBodyStatus4,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'appkey': appkey
                    }
                }
            );

            if (updateResponseStatus4.data?.status !== '1') {
                console.error("Erro ao atualizar a tabela AD_TGFEXP:", updateResponseStatus4.data);
                return res.status(400).json({ erro: "Erro ao atualizar a tabela AD_TGFEXP para o status 4." });
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
