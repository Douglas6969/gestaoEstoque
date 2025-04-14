import axios from 'axios';
import { db } from '../database/connection.database.js';
import net from 'net';
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

// Função para obter detalhes dos produtos
const getProductDetails = async (nroUnico, separadorCodigo, token) => {
    try {
        console.log(`Buscando detalhes para nroUnico: ${nroUnico}, separadorCodigo: ${separadorCodigo}`);
        const appkey = process.env.SANKHYA_APPKEY;
        if (!token) {
            throw new Error('Token de autenticação não encontrado');
        }
        const sqlQuery = `
            SELECT
                SEP.DESCRICAO AS NOME_SEPARADOR,
                CAB.NUNOTA AS NRO_UNICO,
                PRO.CODPROD AS CODIGO_PRODUTO,
                PRO.DESCRPROD AS DESCRICAO_PRODUTO,
                PRO.MARCA,
                PRO.CODVOL AS UNIDADE,
                ITE.CONTROLE AS LOTE,
                ITE.QTDNEG AS QUANTIDADE,
                PAR.RAZAOSOCIAL || ' - ' || CAB.CODPARC AS CLIENTE,
                CASE
                    WHEN CAB.AD_PRIORIDADE = 0 THEN 'Urgente'
                    ELSE 'Normal'
                END AS PRIORIDADE
            FROM TGFITE ITE
            INNER JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
            INNER JOIN TGFCAB CAB ON CAB.NUNOTA = ITE.NUNOTA
            INNER JOIN TGFPAR PAR ON PAR.CODPARC = CAB.CODPARC
            LEFT JOIN AD_SEPARADOR SEP ON CAB.AD_SEPARADORNEW = SEP.SEPARADOR
            WHERE CAB.NUNOTA = '${nroUnico}' AND SEP.SEPARADOR = '${separadorCodigo}'
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
                return rows.map(row => ({
                    Nome_Separador: row[0] || 'N/A',
                    Nro_Unico: row[1] || 'N/A',
                    Codigo_Produto: row[2] || 'N/A',
                    Descricao_Produto: row[3] || 'N/A',
                    Marca: row[4] || 'N/A',
                    Unidade: row[5] || 'N/A',
                    Lote: row[6] || 'N/A',
                    Quantidade: row[7] || 0,
                    Cliente: row[8] || 'N/A',
                    Prioridade: row[9] || 'Normal'
                }));
            } else {
                throw new Error('Nenhum resultado encontrado para os parâmetros fornecidos');
            }
        } else {
            throw new Error(`Erro na API: ${response.data?.statusMessage || 'Resposta inválida'}`);
        }
    } catch (error) {
        console.error('Erro ao buscar detalhes dos produtos:', error);
        throw error;
    }
};

// Utilitário para formatar número com milhar
const formatarQuantidade = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(valor);
};

// Função para gerar o layout da etiqueta em texto
const generateLabelLayout = (details) => {
    const initPrint = '\x1B\x40'; // ESC @
    const normalFont = '\x1B\x21\x00';
    const largeFont = '\x1B\x21\x30';
    const cutPaper = '\x1D\x56\x41';
    const primeiroItem = details[0];
    let layout = initPrint;
    layout += largeFont + 'PRIORIDADE\n';
    layout += normalFont + `${primeiroItem.Prioridade}\n\n`;
    layout += largeFont + 'CLIENTE\n';
    layout += normalFont + `${primeiroItem.Cliente}\n\n`;
    layout += largeFont + 'SEPARADOR\n';
    layout += normalFont + `${primeiroItem.Nome_Separador}\n\n`;
    layout += largeFont + 'NUMERO UNICO\n';
    layout += normalFont + `${primeiroItem.Nro_Unico}\n\n`;
    layout += largeFont + 'PRODUTOS\n';
    layout += normalFont + '===================\n';
    details.forEach(item => {
        layout += `COD: ${item.Codigo_Produto}\n`;
        layout += `DESC: ${item.Descricao_Produto}\n`;
        layout += `MARCA: ${item.Marca}\n`;
        layout += `LOTE: ${item.Lote}\n`;
        layout += `QTD: ${formatarQuantidade(item.Quantidade)} ${item.Unidade}\n`;
        layout += '-------------------\n';
    });
    layout += cutPaper;
    return layout;
};

// Função para enviar para a impressora
const sendToPrinter = (ip, port, content) => {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        client.connect(port, ip, () => {
            console.log('Conectado à impressora');
            client.write(content);
            client.end();
        });
        client.on('close', () => {
            console.log('Conexão fechada');
            resolve();
        });
        client.on('error', (err) => {
            console.error('Erro na conexão com a impressora:', err);
            reject(err);
        });
    });
};

// Função principal para gerar e imprimir a etiqueta
export const imprimirEtiqueta = async (req, res) => {
    const { nroUnico, separadorCodigo } = req.params;
    console.log('Parâmetros recebidos:', { separadorCodigo, nroUnico });
    if (!separadorCodigo || !nroUnico) {
        return res.status(400).json({ erro: 'Parâmetros incompletos: separadorCodigo ou nroUnico faltando.' });
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
        const productDetails = await getProductDetails(nroUnico, separadorCodigo, token);
        console.log('Detalhes do produto obtidos:', productDetails);
        const printContent = generateLabelLayout(productDetails);
        console.log('Conteúdo da impressão:', printContent);
        const printerIp = '10.10.10.181';
        const printerPort = 9100;
        await sendToPrinter(printerIp, printerPort, printContent);
        return res.json({ mensagem: 'Etiqueta enviada para a impressora com sucesso!' });
    } catch (error) {
        console.error('Erro ao imprimir etiqueta:', error.message);
        return res.status(500).json({ erro: 'Erro ao imprimir a etiqueta.' });
    }
};
