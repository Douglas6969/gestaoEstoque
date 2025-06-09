import axios from 'axios';
import { getBearerToken } from './auth.controller.js';
import { db } from '../database/connection.database.js';

// Função para verificar se o separador pode pegar outra separação
export const verificarSePodeSeparar = async (req, res) => {
    try {
        const { separadorCodigo } = req.params;
        console.log('Valor do separador recebido:', separadorCodigo);

        // Verificação de parâmetros
        if (!separadorCodigo || isNaN(parseInt(separadorCodigo, 10))) {
            return res.status(400).json({ error: "Código do separador inválido." });
        }

        // Buscar o id_usuario no banco de dados com base no separadorCodigo
        const result = await db.query('SELECT id_usuario FROM usuario WHERE codsep = $1', [separadorCodigo]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Separador não encontrado." });
        }
        const id_usuario = result.rows[0].id_usuario;
        console.log('ID do usuário obtido:', id_usuario);

        const token = await getBearerToken(id_usuario);
        const appkey = process.env.SANKHYA_APPKEY;

        // SQL para contar as ordens com AD_STATUSDACONFERENCIA = 7 (Conferência iniciada)
        const sqlQuery = `
            SELECT COUNT(CAB.NUNOTA) AS "Qtd_Ordens_Conferencia_Iniciada"
            FROM TGFCAB CAB
            WHERE CAB.AD_SEPARADORNEW = ${separadorCodigo}
              AND CAB.AD_CODIGO IN (2, 9)
        `;

        const requestBody = {
            serviceName: 'DbExplorerSP.executeQuery',
            requestBody: { sql: sqlQuery, parameters: { separadorCodigo: parseInt(separadorCodigo, 10) } }
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

        console.log('Resposta da API:', response.data);

        if (response.data?.status === '1' && response.data.responseBody?.rows?.length > 0) {
            const rows = response.data.responseBody.rows;
            const qtdOrdens = rows[0][0];
            console.log('Quantidade de ordens em conferência iniciada:', qtdOrdens);

            if (qtdOrdens > 0) {
                return res.status(400).json({ error: 'Você não pode iniciar outra separação enquanto houver ordens em Conferência iniciada.' });
            } else {
                return res.json({ message: 'Você pode iniciar uma nova separação.' });
            }
        } else {
            return res.status(500).json({ error: 'Erro ao processar a resposta da API, dados inválidos.' });
        }
    } catch (error) {
        console.error('Erro ao verificar separador:', error.response?.data || error.message);
        return res.status(500).json({ error: 'Erro ao verificar separador', details: error.response?.data || error.message });
    }
};
