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
        const result = await db.query('SELECT id_usuario FROM usuario WHERE separador_codigo = $1', [separadorCodigoInt]);
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
                    Localizacao: row[8] || null,
                    Armazenagem: row[9] || null,
                    Controlado: row[10] || 'Não'
                }));
                return res.json({ detalhes: result });
            } else {
                return res.status(404).json({ error: 'Nenhum detalhe encontrado para este pedido' });
            }
        } else {
            return res.status(500).json({ error: 'Erro ao processar a resposta da API do Sankhya' });
        }
    } catch (error) {
        console.error('Erro ao listar detalhes do pedido:', error.message);
        return res.status(500).json({ error: 'Erro ao listar detalhes do pedido' });
    }
};
