import axios from 'axios';
import dotenv from 'dotenv';
import { db } from '../database/connection.database.js';
dotenv.config();



const loginToSankhya = async (id_usuario) => {
    try {
        console.log(`Tentando autenticar na Sankhya para o usuário ${id_usuario}...`);
        const response = await axios.post('https://api.sandbox.sankhya.com.br/login', {}, {
            headers: {
                token: process.env.SANKHYA_TOKEN,
                appkey: process.env.SANKHYA_APPKEY,
                username: process.env.SANKHYA_USERNAME,
                password: process.env.SANKHYA_PASSWORD
            }
        });
        console.log('Resposta da Sankhya:', response.data);
        const bearerToken = response.data.bearerToken;
        await storeTokenInDB(id_usuario, bearerToken);
        return bearerToken;
    } catch (error) {
        console.error('Erro ao obter token:', error.response?.data || error.message);
        throw error;
    }
};

const storeTokenInDB = async (id_usuario, bearerToken) => {
    const query = `
        INSERT INTO tokens_usuario (id_usuario, bearer_token, criado_em, expira_em)
        VALUES ($1, $2, NOW(), NOW() + INTERVAL '10 minutes')
        ON CONFLICT (id_usuario)
        DO UPDATE SET bearer_token = EXCLUDED.bearer_token, criado_em = NOW(), expira_em = NOW() + INTERVAL '10 minutes';
    `;
    try {
        await db.query(query, [id_usuario, bearerToken]);
        console.log(`Bearer Token atualizado no banco para o usuário ${id_usuario}.`);
    } catch (error) {
        console.error('Erro ao armazenar token no banco de dados:', error.message);
    }
};

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

export const getBearerToken = async (id_usuario) => {
    let bearerToken = await getBearerTokenFromDB(id_usuario);
    if (!bearerToken) {
        bearerToken = await loginToSankhya(id_usuario);
    }
    return bearerToken;
};

const logoutFromSankhya = async (id_usuario) => {
    const bearerToken = await getBearerTokenFromDB(id_usuario);
    if (!bearerToken) {
        console.log('Erro: Nenhum token encontrado, faça login primeiro.');
        return;
    }
    try {
        const response = await axios.post(
            'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=MobileLoginSP.logout&outputType=json',
            {},
            {
                headers: {
                    'appkey': process.env.SANKHYA_APPKEY,
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${bearerToken}`
                }
            }
        );
        console.log('Logout realizado com sucesso:', response.data);
        await storeTokenInDB(id_usuario, ''); // Limpa o token no banco
        return response.data;
    } catch (error) {
        console.error('Erro ao fazer logout da Sankhya:', error.response?.data || error.message);
        throw error;
    }
};

const authController = { getBearerToken, loginToSankhya, logoutFromSankhya };
export { authController };
