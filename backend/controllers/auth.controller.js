import axios from 'axios';
import dotenv from 'dotenv';
import { db } from '../database/connection.database.js';
import schedule from 'node-schedule'; // Adicione este pacote para agendar tarefas

dotenv.config();

// Função principal para autenticação na Sankhya
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

// Armazenar token no banco de dados com data de expiração
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

// Obter token do banco de dados
const getBearerTokenFromDB = async (id_usuario) => {
    try {
        const result = await db.query('SELECT bearer_token, expira_em FROM tokens_usuario WHERE id_usuario = $1', [id_usuario]);
        if (result.rows.length > 0) {
            const { bearer_token, expira_em } = result.rows[0];
            
            // Adiciona uma margem de segurança de 30 segundos para renovar o token antes de expirar
            const expirationTime = new Date(expira_em);
            const currentTime = new Date();
            const timeToExpire = expirationTime - currentTime;
            
            if (timeToExpire > 30000) { // 30 segundos em milissegundos
                return bearer_token;
            } else {
                console.log(`Token para usuário ${id_usuario} está prestes a expirar. Renovando...`);
                return null; // Forçar renovação do token
            }
        }
        return null;
    } catch (error) {
        console.error('Erro ao recuperar token do banco de dados:', error);
        return null;
    }
};

// Função principal para obter token
export const getBearerToken = async (id_usuario) => {
    let bearerToken = await getBearerTokenFromDB(id_usuario);
    if (!bearerToken) {
        bearerToken = await loginToSankhya(id_usuario);
    }
    return bearerToken;
};

// Função para renovar tokens automaticamente para todos os usuários ativos
const renewAllActiveTokens = async () => {
    try {
        // Busca todos os usuários que possuem tokens
        const result = await db.query('SELECT id_usuario FROM tokens_usuario');
        
        // Para cada usuário, solicita um novo token
        for (const row of result.rows) {
            const id_usuario = row.id_usuario;
            console.log(`Renovando automaticamente token para usuário ${id_usuario}`);
            await loginToSankhya(id_usuario);
        }
        console.log('Renovação automática de tokens concluída.');
    } catch (error) {
        console.error('Erro durante renovação automática de tokens:', error);
    }
};

// Função de logout
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
        await clearTokenInDB(id_usuario);
        return response.data;
    } catch (error) {
        console.error('Erro ao fazer logout da Sankhya:', error.response?.data || error.message);
        throw error;
    }
};

// Limpar token do banco de dados após logout
const clearTokenInDB = async (id_usuario) => {
    try {
        await db.query('DELETE FROM tokens_usuario WHERE id_usuario = $1', [id_usuario]);
        console.log(`Token removido do banco para o usuário ${id_usuario}`);
    } catch (error) {
        console.error('Erro ao limpar token no banco de dados:', error.message);
    }
};

// Agendar renovação de tokens a cada 9 minutos (um pouco antes dos 10 minutos de expiração)
// Isso garante que tokens serão renovados antes de expirarem
const scheduleTokenRenewal = () => {
    // Executa a cada 9 minutos
    schedule.scheduleJob('*/9 * * * *', async () => {
        console.log('Iniciando renovação programada de tokens...');
        await renewAllActiveTokens();
    });
    console.log('Renovação automática de tokens agendada para ocorrer a cada 9 minutos.');
};

// Iniciar agendamento de renovação de tokens quando o módulo for importado
scheduleTokenRenewal();

const authController = { getBearerToken, loginToSankhya, logoutFromSankhya };
export { authController };
