import axios from 'axios';
import dotenv from 'dotenv';
import moment from 'moment-timezone';

import { getBearerToken } from './auth.controller.js';
dotenv.config();

// Exponha o pool/conexão do PG conforme seu projeto, ex:
import { db } from '../database/connection.database.js';

export const atualizarHistorico = async (req, res) => {
    const { nroUnico, separadorCodigo } = req.params;

    // Validação
    if (!nroUnico) {
        return res.status(400).json({ erro: 'Parâmetro nroUnico é obrigatório.' });
    }
    const separadorCodigoInt = parseInt(separadorCodigo, 10);
    if (!separadorCodigo || isNaN(separadorCodigoInt)) {
        return res.status(400).json({ erro: "Código do separador inválido." });
    }

    // Busca id_usuario pelo código do separador
    let id_usuario;
    try {
        const result = await db.query('SELECT id_usuario FROM usuario WHERE codsep = $1', [separadorCodigoInt]);
        if (result.rows.length === 0) {
            return res.status(404).json({ erro: "Separador não encontrado." });
        }
        id_usuario = result.rows[0].id_usuario;
        if (!id_usuario) {
            return res.status(404).json({ erro: "Usuário não encontrado via separador." });
        }
        console.log('ID do usuário obtido:', id_usuario);
    } catch (dbErr) {
        return res.status(500).json({ erro: 'Erro ao buscar usuário pelo separador', detalhes: dbErr.message });
    }

    const nunota = parseInt(nroUnico, 10);

    try {
        // Esse método pode ser modificado para aceitar o ID diretamente ou um objeto. Use conforme sua implementação real.
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

        const dataFinalizacao = moment().tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss');
        const tentativas = [];
        for (const row of rows) {
            let [DATA, NUNOTA, OPERADOR] = row;
            let dataFormatada = "";
            if (typeof DATA === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/.test(DATA)) {
                dataFormatada = DATA.replace('T', ' ').slice(0, 19);
            } else if (typeof DATA === 'string' && /^(\d{2})(\d{2})(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.test(DATA)) {
                dataFormatada = moment(DATA, 'DDMMYYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');
            } else if (DATA instanceof Date) {
                dataFormatada = moment(DATA).format('YYYY-MM-DD HH:mm:ss');
            } else {
                dataFormatada = String(DATA);
            }
            const pk = {
                DATA: dataFormatada,
                NUNOTA: String(NUNOTA),
                OPERADOR: String(OPERADOR)
            };
            const payload = {
                serviceName: 'DatasetSP.save',
                requestBody: {
                    entity: 'AD_TGFEXP',
                    standAlone: false,
                    records: [
                        {
                            pk,
                            values: {
                                DATAFIN: dataFinalizacao
                            }
                        }
                    ]
                }
            };
            // Log para debug:
            console.log("Payload sendo enviado:", JSON.stringify(payload, null, 2));
            try {
                const upResp = await axios.post(
                    'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DatasetSP.save&outputType=json',
                    payload,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            'appkey': process.env.SANKHYA_APPKEY
                        }
                    }
                );
                tentativas.push({
                    pk,
                    status: upResp.data.status,
                    respostaApi: upResp.data,
                    payloadEnviado: payload
                });
            } catch (e) {
                tentativas.push({
                    pk,
                    erro: e.response?.data || e.message,
                    payloadEnviado: payload
                });
            }
        }
        return res.json({
            mensagem: 'Processo de atualização concluído.',
            tentativas
        });

    } catch (error) {
        return res.status(500).json({
            erro: 'Erro inesperado',
            detalhes: error.response?.data || error.message
        });
    }
};
