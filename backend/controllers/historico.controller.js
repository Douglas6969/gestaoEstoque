import axios from 'axios';
import { db } from '../database/connection.database.js';
import dotenv from 'dotenv';
import moment from 'moment-timezone';

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

// Função para formatar data e hora
const formatarDataHora = () => {
    return moment().tz("America/Sao_Paulo").format("DD/MM/YYYY HH:mm:ss");
};

// Função para atualizar o histórico da separação
export const atualizarHistorico = async (req, res) => {
    const { nroUnico, separadorCodigo } = req.params;

    if (!nroUnico || !separadorCodigo) {
        return res.status(400).json({ erro: 'Parâmetros incompletos: nroUnico ou separadorCodigo faltando.' });
    }

    try {
        const separadorCodigoInt = parseInt(separadorCodigo, 10);
        if (isNaN(separadorCodigoInt)) {
            return res.status(400).json({ error: "Código do separador inválido." });
        }

        const result = await db.query('SELECT id_usuario FROM usuario WHERE separador_codigo = $1', [separadorCodigoInt]);
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

        const sqlQuery = `
            SELECT DATA, NUNOTA, CODUSU, OPERADOR, STATUS
            FROM AD_TGFEXP
            WHERE NUNOTA = '${nroUnico}' AND DATA IS NOT NULL
        `;
        const requestBodyConsulta = {
            serviceName: 'DbExplorerSP.executeQuery',
            requestBody: { sql: sqlQuery }
        };

        console.log('📝 Consultando histórico...');
        const consultaResponse = await axios.post(
            'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
            requestBodyConsulta,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    appkey: appkey
                }
            }
        );

        const rows = consultaResponse.data.responseBody?.rows;
        if (!rows || rows.length === 0) {
            console.warn(`❌ Nenhum registro encontrado para o pedido: ${nroUnico}`);
            return res.status(404).json({ erro: 'Nenhum registro encontrado para atualização' });
        }

        const [DATA, NUNOTA, CODUSU, OPERADOR, STATUS] = rows[0];
        console.log('✅ Registro encontrado:', { DATA, NUNOTA, CODUSU, OPERADOR, STATUS });

        if (!DATA || !NUNOTA || !CODUSU || !OPERADOR) {
            return res.status(400).json({ erro: 'Dados incompletos recebidos da API Sankhya.' });
        }

        if (STATUS !== 2) {
            return res.status(400).json({ erro: 'Status do registro não é 2. Atualização não permitida.' });
        }

        const dataFormatada =
            moment(DATA, 'DDMMYYYY HH:mm:ss', true).isValid()
                ? moment(DATA, 'DDMMYYYY HH:mm:ss').format('DD/MM/YYYY HH:mm:ss')
                : null;
        if (!dataFormatada) {
            console.error(`❌ Data inválida recebida do banco: ${DATA}`);
            return res.status(400).json({ erro: 'Data inválida recebida do banco de dados' });
        }

        const dataAtual = formatarDataHora();

        const requestBodyUpdate = {
            serviceName: 'DatasetSP.save',
            requestBody: {
                entity: 'AD_TGFEXP',
                standAlone: false,
                fields: ['DATAFIN', 'CODUSU', 'OPERADOR', 'STATUS'],
                records: [
                    {
                        pk: { DATA: dataFormatada, NUNOTA },
                        values: {
                            'DATAFIN': dataAtual,
                            'CODUSU': CODUSU,
                            'OPERADOR': OPERADOR,
                            'STATUS': 2
                        }
                    }
                ]
            }
        };

        console.log('🔄 Enviando atualização para o Sankhya...');
        const updateResponse = await axios.post(
            'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DatasetSP.save&outputType=json',
            requestBodyUpdate,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    appkey: appkey
                }
            }
        );

        if (updateResponse.data?.status !== '1') {
            console.error('❌ Erro ao atualizar histórico:', updateResponse.data);
            return res.status(400).json({ erro: 'Erro ao atualizar histórico', detalhe: updateResponse.data });
        }

        console.log(`✅ Histórico atualizado com sucesso para NUNOTA: ${NUNOTA}`);
        return res.json({ mensagem: `Histórico do pedido ${NUNOTA} atualizado com sucesso!` });

    } catch (error) {
        console.error('🔥 Erro no processo de atualização:', error.response?.data || error.message);
        return res.status(500).json({
            erro: 'Erro ao atualizar histórico',
            detalhes: error.response?.data || error.message
        });
    }
};
