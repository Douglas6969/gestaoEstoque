import axios from 'axios';
import { db } from '../../database/connection.database.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Obter o diretório atual do módulo
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Função para obter o token de autenticação do banco de dados
const getBearerTokenFromDB = async (conferenteCodigo) => {
    try {
        const userResult = await db.query(
            'SELECT id_usuario FROM usuario WHERE codsep = $1',
            [Number(conferenteCodigo)]
        );
        if (userResult.rows.length === 0) {
            throw new Error('Conferente não encontrado.');
        }
        const id_usuario = userResult.rows[0].id_usuario;
        const tokenResult = await db.query(
            'SELECT bearer_token, expira_em FROM tokens_usuario WHERE id_usuario = $1 ORDER BY id DESC LIMIT 1',
            [id_usuario]
        );
        if (tokenResult.rows.length > 0) {
            const { bearer_token, expira_em } = tokenResult.rows[0];
            if (new Date(expira_em) > new Date()) {
                return { bearer_token, id_usuario };
            }
        }
        return { bearer_token: null, id_usuario };
    } catch (error) {
        console.error('Erro ao recuperar token do banco de dados:', error);
        throw error;
    }
};

// Função para obter um novo token
const loginToSankhya = async (id_usuario) => {
    try {
        const response = await axios.post('https://api.sandbox.sankhya.com.br/gateway/v1/auth/login', {
            user: process.env.SANKHYA_USER,
            password: process.env.SANKHYA_PASSWORD
        });
        
        const newToken = response.data.token;
        const expiraEm = new Date();
        expiraEm.setHours(expiraEm.getHours() + 1); // Expiração: 1 hora
        
        // Atualizar ou inserir o token no banco de dados
        await db.query(`
            INSERT INTO tokens_usuario (id_usuario, bearer_token, expira_em)
            VALUES ($1, $2, $3)
            ON CONFLICT (id_usuario) DO UPDATE
            SET bearer_token = $2, expira_em = $3
        `, [id_usuario, newToken, expiraEm]);
        
        return newToken;
    } catch (error) {
        console.error('Erro ao obter novo token de autenticação:', error);
        throw new Error('Erro ao obter novo token de autenticação');
    }
};

// Função para obter o token de autenticação
const getBearerToken = async (conferenteCodigo) => {
    try {
        const { bearer_token, id_usuario } = await getBearerTokenFromDB(conferenteCodigo);
        if (!bearer_token) {
            return await loginToSankhya(id_usuario);
        }
        return bearer_token;
    } catch (error) {
        throw error;
    }
};

// Função para verificar se o pedido existe
// Exemplo de como a função verificaPedidoExiste pode estar implementada
const verificaPedidoExiste = async (nroUnico, token) => {
    try {
      console.log(`Verificando existência do pedido ${nroUnico}`);
      const appkey = process.env.SANKHYA_APPKEY;
      
      // Requisição para verificar se o pedido existe
      const requestBody = {
        serviceName: "DbExplorerSP.executeQuery",
        requestBody: {
          sql: `SELECT COUNT(*) FROM TGFCAB WHERE NUNOTA = ${nroUnico}`
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
      
      // Verificar a resposta
      console.log("Resposta da verificação:", JSON.stringify(response.data));
      
      // Conferir se há registros e se o count é maior que 0
      const count = response.data?.responseBody?.rows?.[0]?.[0];
      console.log(`Contagem para pedido ${nroUnico}: ${count}`);
      
      return count > 0;
      
    } catch (error) {
      console.error('Erro ao verificar existência do pedido:', error);
      throw new Error(`Erro ao verificar pedido: ${error.message}`);
    }
  };
  

// Função para atualizar os volumes do pedido usando DatasetSP.save
const updatePedidoVolumes = async (nroUnico, qtdVolumes, qtdEtiquetas, token, conferenteCodigo) => {
    try {
        console.log(`Atualizando pedido ${nroUnico}: volumes=${qtdVolumes}, etiquetas=${qtdEtiquetas}`);
        const appkey = process.env.SANKHYA_APPKEY;
        
        if (!token) {
            throw new Error('Token de autenticação não fornecido');
        }
        
        // Verificar se o pedido existe antes de tentar atualização
        const pedidoExiste = await verificaPedidoExiste(nroUnico, token);
        if (!pedidoExiste) {
            throw new Error(`Pedido ${nroUnico} não encontrado.`);
        }
        
        // Formatação da requisição para DatasetSP.save
        const requestBody = {
            serviceName: "DatasetSP.save",
            requestBody: {
                entityName: "CabecalhoNota",
                standAlone: false,
                fields: ["QTDVOL", "AD_ETIQUETAPEDIDO"],
                records: [
                    {
                        pk: { NUNOTA: nroUnico },
                        values: {
                            "0": qtdVolumes,
                            "1": qtdEtiquetas,
                        }
                    }
                ]
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
        
        // Verificar se a atualização foi bem-sucedida
        if (response.data?.status === '1') {
            console.log('Volumes e etiquetas atualizados com sucesso!');
            return true;
        } else {
            console.error('Erro na resposta da API ao atualizar pedido:', response.data);
            throw new Error(`Erro ao atualizar pedido: ${response.data?.statusMessage || 'Sem resposta da API'}`);
        }
    } catch (error) {
        console.error('Erro na requisição para atualizar pedido:', error);
        if (error.response?.data) {
            console.error('Detalhes do erro da API:', error.response.data);
            throw new Error(`Erro ao atualizar pedido: ${error.response.data?.statusMessage || JSON.stringify(error.response.data)}`);
        }
        throw error;
    }
};

// Função para obter detalhes do pedido
const getPedidoDetails = async (nroUnico, token) => {
    try {
        console.log(`Buscando detalhes para pedido: ${nroUnico}`);
        const appkey = process.env.SANKHYA_APPKEY;
        
        if (!token) {
            throw new Error('Token de autenticação não encontrado');
        }
        
        // Consulta SQL para obter detalhes do pedido
        const sqlQuery = `
            SELECT
                CAB.NUNOTA AS NRO_UNICO,
                CAB.NUMNOTA AS NUMERO_PEDIDO,
                EMP.RAZAOSOCIAL AS EMPRESA_NOME,
                EMP.CODEND AS EMPRESA_ENDERECO_COD,
                ENDE.TIPO || ' ' || ENDE.NOMEEND || ', ' || EMP.NUMEND AS EMPRESA_ENDERECO,
                BCID.NOMEBAI AS EMPRESA_BAIRRO,
                CID.NOMECID || ' - ' || UF.UF || ' - ' || EMP.CEP AS EMPRESA_CIDADE_UF_CEP,
                PAR.RAZAOSOCIAL AS CLIENTE_NOME,
                ENDP.TIPO || ' ' || ENDP.NOMEEND || ', ' || PAR.NUMEND AS CLIENTE_ENDERECO,
                PCID.NOMECID || ' - ' || PUF.UF || ' - ' || PAR.CEP AS CLIENTE_CIDADE_UF_CEP,
                CAB.CODPARCTRANSP AS TRANSPORTADORA_COD,
                PART.RAZAOSOCIAL AS TRANSPORTADORA_NOME,
                COALESCE(CAB.PESOBRUTO, 0) AS PESO_BRUTO,
                COALESCE(CAB.QTDVOL, 0) AS QTD_VOL,
                COALESCE(CAB.AD_ETIQUETAPEDIDO, 0) AS QTD_ETIQUETAS
            FROM TGFCAB CAB
            JOIN TSIEMP EMP ON EMP.CODEMP = CAB.CODEMP
            JOIN TGFPAR PAR ON PAR.CODPARC = CAB.CODPARC
            LEFT JOIN TGFPAR PART ON PART.CODPARC = CAB.CODPARCTRANSP
            LEFT JOIN TSIEND ENDE ON ENDE.CODEND = EMP.CODEND
            LEFT JOIN TSIBAI BCID ON BCID.CODBAI = EMP.CODBAI
            LEFT JOIN TSICID CID ON CID.CODCID = EMP.CODCID
            LEFT JOIN TSIUFS UF ON UF.CODUF = CID.UF
            LEFT JOIN TSIEND ENDP ON ENDP.CODEND = PAR.CODEND
            LEFT JOIN TSICID PCID ON PCID.CODCID = PAR.CODCID
            LEFT JOIN TSIUFS PUF ON PUF.CODUF = PCID.UF
            WHERE CAB.NUNOTA = '${nroUnico}'
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
                // Mapear os resultados para um objeto de dados
                const row = rows[0];
                return {
                    nroUnico: row[0] || '',
                    numeroPedido: row[1] || '',
                    empresaNome: row[2] || '',
                    empresaEndereco: row[4] || '',
                    empresaBairro: row[5] || '',
                    empresaCidadeUfCep: row[6] || '',
                    clienteNome: row[7] || '',
                    clienteEndereco: row[8] || '',
                    clienteCidadeUfCep: row[9] || '',
                    transportadoraCod: row[10] || '',
                    transportadoraNome: row[11] || '',
                    pesoBruto: row[12] || 0,
                    qtdVol: row[13] || 0,
                    qtdEtiquetas: row[14] || 0
                };
            } else {
                throw new Error('Nenhum resultado encontrado para o pedido.');
            }
        } else {
            console.error('Erro na resposta da API:', response.data);
            if (response.data?.statusMessage) {
                throw new Error(`Erro do Sankhya: ${response.data.statusMessage}`);
            } else {
                throw new Error('Erro na resposta da API ao buscar detalhes do pedido.');
            }
        }
    } catch (error) {
        console.error('Erro ao obter detalhes do pedido:', error);
        if (error.response?.data) {
            console.error('Detalhes do erro da API:', error.response.data);
            throw new Error(`Erro ao acessar a API: ${error.response.data?.statusMessage || JSON.stringify(error.response.data)}`);
        }
        throw error;
    }
};

// Função para atualizar a quantidade de volumes do pedido
export const atualizarVolumes = async (req, res) => {
    const { conferenteCodigo, nroUnico } = req.params;
    const { qtdVolumes, qtdEtiquetas = null } = req.body;
    
    if (!conferenteCodigo || !nroUnico || !qtdVolumes) {
        return res.status(400).json({
            erro: 'Parâmetros incompletos. Necessário conferenteCodigo, nroUnico e qtdVolumes.'
        });
    }
    
    try {
        // Obter token de autenticação
        const token = await getBearerToken(conferenteCodigo);
        
        // Atualizar volumes no Sankhya
        await updatePedidoVolumes(
            nroUnico,
            parseInt(qtdVolumes),
            qtdEtiquetas ? parseInt(qtdEtiquetas) : parseInt(qtdVolumes),
            token,
            conferenteCodigo
        );
        
        return res.json({
            mensagem: 'Quantidade de volumes atualizada com sucesso.',
            qtdVolumes: parseInt(qtdVolumes),
            qtdEtiquetas: qtdEtiquetas ? parseInt(qtdEtiquetas) : parseInt(qtdVolumes)
        });
    } catch (error) {
        console.error('Erro ao atualizar quantidade de volumes:', error.message);
        return res.status(500).json({
            erro: 'Erro ao atualizar quantidade de volumes.',
            detalhes: error.message
        });
    }
};

// Função específica para atualizar apenas a quantidade de volumes de um pedido
export const atualizarQuantidadeVolumes = async (req, res) => {
    const { conferenteCodigo, nroUnico } = req.params;
    const { qtdVolumes, qtdEtiquetas } = req.body;

    if (!conferenteCodigo || !nroUnico) {
        return res.status(400).json({
            erro: 'Parâmetros incompletos. Necessário conferenteCodigo e nroUnico.'
        });
    }

    // Verificação para garantir que pelo menos um dos valores seja fornecido
    if (qtdVolumes === undefined && qtdEtiquetas === undefined) {
        return res.status(400).json({
            erro: 'É necessário fornecer ao menos qtdVolumes ou qtdEtiquetas para atualização.'
        });
    }

    try {
        // Obter token de autenticação
        const token = await getBearerToken(conferenteCodigo);
        
        // Obter detalhes atuais do pedido para manter valores existentes se necessário
        const pedidoDetails = await getPedidoDetails(nroUnico, token);
        
        // Usar os valores fornecidos ou manter os existentes
        const volumesParaAtualizar = qtdVolumes !== undefined ? parseInt(qtdVolumes) : pedidoDetails.qtdVol;
        const etiquetasParaAtualizar = qtdEtiquetas !== undefined ? parseInt(qtdEtiquetas) : pedidoDetails.qtdEtiquetas;
        
        // Atualizar volumes e etiquetas no Sankhya
        await updatePedidoVolumes(
            nroUnico,
            volumesParaAtualizar,
            etiquetasParaAtualizar,
            token,
            conferenteCodigo
        );

        return res.json({
            mensagem: 'Atualização realizada com sucesso.',
            nroUnico,
            qtdVolumes: volumesParaAtualizar,
            qtdEtiquetas: etiquetasParaAtualizar
        });
    } catch (error) {
        console.error('Erro ao atualizar volumes e etiquetas:', error.message);
        return res.status(500).json({
            erro: 'Erro ao atualizar volumes e etiquetas.',
            detalhes: error.message
        });
    }
};

// Função para obter detalhes do pedido (endpoint)
export const obterDetalhesPedido = async (req, res) => {
    const { conferenteCodigo, nroUnico } = req.params;
    
    if (!conferenteCodigo || !nroUnico) {
        return res.status(400).json({
            erro: 'Parâmetros incompletos. Necessário conferenteCodigo e nroUnico.'
        });
    }
    
    try {
        // Obter token de autenticação usando o código do conferente
        const token = await getBearerToken(conferenteCodigo);
        
        // Obter detalhes do pedido
        const pedidoDetails = await getPedidoDetails(nroUnico, token);
        
        return res.json({
            mensagem: 'Detalhes do pedido obtidos com sucesso',
            detalhes: pedidoDetails
        });
    } catch (error) {
        console.error('Erro ao obter detalhes do pedido:', error.message);
        return res.status(500).json({
            erro: 'Erro ao obter detalhes do pedido.',
            detalhes: error.message
        });
    }
};


// Função para verificar existência do pedido (endpoint)
export const verificarPedido = async (req, res) => {
    const { conferenteCodigo, nroUnico } = req.params;
    
    if (!conferenteCodigo || !nroUnico) {
        return res.status(400).json({
            erro: 'Parâmetros incompletos. Necessário conferenteCodigo e nroUnico.'
        });
    }
    
    try {
        // Obter token de autenticação
        const token = await getBearerToken(conferenteCodigo);
        
        // Verificar se o pedido existe
        const pedidoExiste = await verificaPedidoExiste(nroUnico, token);
        
        if (pedidoExiste) {
            // Se existe, obter detalhes do pedido
            const pedidoDetails = await getPedidoDetails(nroUnico, token);
            
            return res.json({
                mensagem: 'Pedido encontrado',
                pedidoExiste: true,
                detalhes: pedidoDetails
            });
        } else {
            return res.status(404).json({
                mensagem: 'Pedido não encontrado',
                pedidoExiste: false
            });
        }
    } catch (error) {
        console.error('Erro ao verificar pedido:', error.message);
        return res.status(500).json({
            erro: 'Erro ao verificar pedido.',
            detalhes: error.message
        });
    }
    
};

