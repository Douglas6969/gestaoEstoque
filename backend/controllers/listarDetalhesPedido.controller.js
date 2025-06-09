import axios from 'axios';
import dotenv from 'dotenv';
import { db } from '../database/connection.database.js';
import { getBearerToken } from './auth.controller.js';

dotenv.config();

// Função para listar detalhes do pedido
export const listarDetalhesPedido = async (req, res) => {
    const { nroUnico, separadorCodigo } = req.params;
    const separadorCodigoInt = parseInt(separadorCodigo, 10);

    if (!separadorCodigo || isNaN(separadorCodigoInt)) {
        return res.status(400).json({ error: "Código do separador inválido." });
    }

    try {
        const result = await db.query('SELECT id_usuario FROM usuario WHERE codsep = $1', [separadorCodigoInt]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Separador não encontrado." });
        }

        const id_usuario = result.rows[0].id_usuario;
        console.log('ID do usuário obtido:', id_usuario);

        const token = await getBearerToken(id_usuario);
        const appkey = process.env.SANKHYA_APPKEY;

        if (!token) {
            return res.status(500).json({ erro: 'Token de autenticação não encontrado' });
        }

        // 1. Primeiro, vamos buscar a observação geral (OBS) da tabela AD_TGFEXP com STATUS = 9
        // (Mantido como estava, embora o uso no frontend pareça ser para cada item)
        const obsGeralQuery = `
            SELECT OBS
            FROM AD_TGFEXP
            WHERE NUNOTA = '${nroUnico}'
            AND STATUS = '9'
            ORDER BY DATA DESC
            FETCH FIRST 1 ROW ONLY
        `;

        const obsGeralRequestBody = {
            serviceName: 'DbExplorerSP.executeQuery',
            requestBody: {
                sql: obsGeralQuery
            }
        };

        const obsGeralResponse = await axios.post(
            'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
            obsGeralRequestBody,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'appkey': appkey
                }
            }
        );

        // Extrair a observação geral (se existir)
        let obsGeral = null;
        if (obsGeralResponse.data?.status === '1' &&
            obsGeralResponse.data.responseBody?.rows &&
            obsGeralResponse.data.responseBody.rows.length > 0) {
            obsGeral = obsGeralResponse.data.responseBody.rows[0][0];
        }

        // 2. Agora vamos buscar os detalhes dos itens, INCLUINDO AD_OBSCONF E AD_LISTERR
        const sqlQuery = `
            SELECT
                ITE.NUNOTA AS "Nro_Unico",
                PRO.CODPROD AS "Codigo_Produto",
                PRO.DESCRPROD AS "Descricao_Produto",
                PRO.MARCA AS "Marca",
                PRO.CODVOL AS "Uni",
                ITE.CONTROLE AS "Lote",
                ITE.QTDNEG AS "Quantidade",
                ITE.SEQUENCIA AS "sequencia",
                ITE.AD_OBSCONF AS "AD_OBSCONF",
                ITE.AD_LISTERR AS "AD_LISTERR", -- <-- ADICIONADO AQUI
                CAB.AD_CODIGO AS "AD_CODIGO",
                (
                    SELECT LISTAGG(DISTINCT LOC.LOCALIZACAO, ' | ')
                    WITHIN GROUP (ORDER BY LOC.LOCALIZACAO)
                    FROM AD_LOCEST LOC
                    INNER JOIN AD_TGFLOC FLOC ON FLOC.LOCALIZACAO = LOC.LOCALIZACAO
                    WHERE LOC.CODPROD = ITE.CODPROD
                      AND LOC.CODLOCAL = 0
                      AND FLOC.FUNCAO IN ('05', '06', '08')
                      AND LOC.CONTROLE = ITE.CONTROLE
                ) AS "Localizacao",
                (
                    SELECT LISTAGG(DISTINCT LOC.LOCALIZACAO, ' | ')
                    WITHIN GROUP (ORDER BY LOC.LOCALIZACAO)
                    FROM AD_LOCEST LOC
                    INNER JOIN AD_TGFLOC FLOC ON FLOC.LOCALIZACAO = LOC.LOCALIZACAO
                    WHERE LOC.CODPROD = ITE.CODPROD
                      AND LOC.CODLOCAL = 0
                      AND FLOC.FUNCAO IN ('01')
                      AND LOC.CONTROLE = ITE.CONTROLE
                ) AS "Armazenagem",
                 CASE
                    WHEN PRO.CONTROLADO = 'S' THEN 'Sim' ELSE 'Nao'
                    END AS "Controlado"
            FROM TGFITE ITE
            INNER JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
            INNER JOIN TGFCAB CAB ON CAB.NUNOTA = ITE.NUNOTA
            WHERE ITE.NUNOTA = '${nroUnico}'
        `;

        const requestBody = {
            serviceName: 'DbExplorerSP.executeQuery',
            requestBody: {
                sql: sqlQuery
            }
        };

        const response = await axios.post(
            'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
            requestBody,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'appkey': appkey
                }
            }
        );

        if (response.data?.status === '1' && response.data.responseBody?.rows) {
            const rows = response.data.responseBody.rows;

            if (Array.isArray(rows) && rows.length > 0) {
                const result = rows.map((row) => ({
                    Nro_Unico: row[0] || null,
                    Codigo_Produto: row[1] || null,
                    Descricao_Produto: row[2] || null,
                    Marca: row[3] || null,
                    Uni: row[4] || null,
                    Lote: row[5] || null,
                    Quantidade: row[6] || null,
                    sequencia: row[7] || null,
                    AD_OBSCONF: row[8] || null,
                    AD_LISTERR: row[9] || null, // <-- MAPEAMENTO ATUALIZADO PARA AD_LISTERR
                    AD_CODIGO: row[10] || null, // <-- MAPEAMENTO ATUALIZADO (índice mudou)
                    Localizacao: row[11] || null, // <-- MAPEAMENTO ATUALIZADO (índice mudou)
                    Armazenagem: row[12] || null, // <-- MAPEAMENTO ATUALIZADO (índice mudou)
                    Controlado: row[13] || 'Não', // <-- MAPEAMENTO ATUALIZADO (índice mudou)
                    AD_OBS: obsGeral // Mantido, mas considere se é o local correto para OBS geral
                }));

                return res.json({
                    detalhes: result,
                    observacaoGeral: obsGeral // Também enviando a observação geral separadamente
                });

            } else {
                return res.status(404).json({ error: 'Nenhum detalhe encontrado para este pedido' });
            }

        } else {
             // Log da resposta completa da API para depuração
            console.error('Resposta completa da API Sankhya:', JSON.stringify(response.data, null, 2));
            return res.status(response.status || 500).json({
                 error: 'Erro ao processar a resposta da API do Sankhya',
                 details: response.data // Incluir detalhes da resposta da API no erro
            });
        }

    } catch (error) {
        console.error('Erro ao listar detalhes do pedido:', error.message);
        // Log do erro completo para depuração
        console.error('Detalhes do erro:', error);
        return res.status(500).json({ error: 'Erro ao listar detalhes do pedido', details: error.message });
    }
};
