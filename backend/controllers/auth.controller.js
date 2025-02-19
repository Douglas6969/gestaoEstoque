import axios from 'axios';
import dotenv from 'dotenv';
import { db } from '../database/connection.database.js';

dotenv.config();

let storedBearerToken = '';
let tokenGeneratedAt = 0;
let isTokenFetching = false;  // Flag para evitar múltiplos fetches do token
const TOKEN_EXPIRATION_TIME = 10 * 60 * 1000; // 10 minutos

// Função para realizar o login e obter o Bearer Token
const loginToSankhya = async () => {
  try {
    console.log('Tentando autenticar na Sankhya...');

    const response = await axios.post('https://api.sandbox.sankhya.com.br/login', {}, {
      headers: {
        token: process.env.SANKHYA_TOKEN,
        appkey: process.env.SANKHYA_APPKEY,
        username: process.env.SANKHYA_USERNAME,
        password: process.env.SANKHYA_PASSWORD
      }
    });

    console.log('Resposta da Sankhya:', response.data);
    
    storedBearerToken = response.data.bearerToken;
    tokenGeneratedAt = Date.now();
    console.log('Novo Bearer Token obtido:', storedBearerToken);

    await storeTokenInDB(storedBearerToken);

    isTokenFetching = false;  // Token obtido, liberando o flag

    return storedBearerToken;
  } catch (error) {
    console.error('Erro ao obter token:', error.response?.data || error.message);
    isTokenFetching = false;  // Libera o flag em caso de erro também
    throw error;
  }
};

// Função para armazenar o token no banco de dados
const storeTokenInDB = async (bearerToken) => {
  const query = `
    INSERT INTO tokens (service, bearer_token, created_at)
    VALUES ('Sankhya', $1, NOW())
    ON CONFLICT (service) 
    DO UPDATE SET bearer_token = EXCLUDED.bearer_token, created_at = NOW();
  `;

  try {
    await db.query(query, [bearerToken]);
    console.log('Bearer Token atualizado no banco.');
  } catch (error) {
    console.error('Erro ao armazenar token no banco de dados:', error.message);
  }
};

// Função para recuperar o token do banco de dados
const getBearerTokenFromDB = async () => {
  try {
    const result = await db.query('SELECT bearer_token FROM tokens WHERE service = $1', ['Sankhya']);
    return result.rows.length > 0 ? result.rows[0].bearer_token : null;
  } catch (error) {
    console.error('Erro ao recuperar token do banco de dados:', error);
    return null;
  }
};

// Função para obter o token de autenticação
export const getBearerToken = async () => {
  const now = Date.now();

  // Verificar se o token já foi obtido e se ele não está expirado
  if (storedBearerToken && now - tokenGeneratedAt < TOKEN_EXPIRATION_TIME) {
    return storedBearerToken;  // Retorna o token existente e válido
  }

  // Se o token não existir ou estiver expirado, verifica se já estamos buscando o token
  if (isTokenFetching) {
    console.log('Aguardando obtenção do token...');
    // Se já estamos buscando o token, aguarda
    while (isTokenFetching) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Aguarda 500ms e tenta novamente
    }
    return storedBearerToken; // Retorna o token obtido após a espera
  }

  // Marca que estamos no processo de obtenção do token
  isTokenFetching = true;

  // Tenta obter o token do banco de dados
  storedBearerToken = await getBearerTokenFromDB();

  if (!storedBearerToken) {
    // Se não encontrar no banco, faz o login na Sankhya
    storedBearerToken = await loginToSankhya();
  }

  return storedBearerToken;
};

// Função para realizar o logout da Sankhya
const logoutFromSankhya = async () => {
  if (!storedBearerToken) {
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
          'Authorization': `Bearer ${storedBearerToken}`
        }
      }
    );

    console.log('Logout realizado com sucesso:', response.data);
    storedBearerToken = '';
    tokenGeneratedAt = 0;

    return response.data;
  } catch (error) {
    console.error('Erro ao fazer logout da Sankhya:', error.response?.data || error.message);
    throw error;
  }
};

// Intervalo para renovação do Bearer Token a cada 10 minutos
setInterval(async () => {
  console.log('Renovando Bearer Token...');
  try {
    await loginToSankhya();
    console.log('Bearer Token renovado com sucesso!');
  } catch (error) {
    console.error('Erro ao renovar o Bearer Token:', error.message);
  }
}, TOKEN_EXPIRATION_TIME);

const authController = { getBearerToken, loginToSankhya, logoutFromSankhya };
export { authController };
