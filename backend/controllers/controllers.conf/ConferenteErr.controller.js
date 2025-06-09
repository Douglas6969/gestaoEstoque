import axios from 'axios';
import moment from 'moment-timezone';
import dotenv from 'dotenv';
import { db } from '../../database/connection.database.js';
dotenv.config();

// Formatar data e hora no formato brasileiro
const formatarDataHora = () => {
    return moment().tz("America/Sao_Paulo").format("DD/MM/YYYY HH:mm:ss");
};

// Função para obter o token de autenticação do banco de dados
const getBearerTokenFromDB = async (id_usuario) => {
    try {
        // Remover a ordenação pela coluna 'id' que não existe
        const result = await db.query(
            'SELECT bearer_token FROM tokens_usuario WHERE id_usuario = $1 ORDER BY criado_em DESC LIMIT 1', 
            [id_usuario]
        );
        
        if (result.rows.length === 0) {
            return null;
        }
        return result.rows[0].bearer_token;
    } catch (error) {
        console.error('Erro ao obter token do banco de dados:', error);
        return null;
    }
};




export const registrarDevolucaoParaSeparador = async (req, res) => {
    const { conferenteCodigo } = req.params;
    // Assumindo que o corpo da requisição agora inclui 'erroCodigo' em cada item
    const { nunota, itens, observacaoGeral } = req.body;
    const novoStatus = "9"; // Status para devolução ao separador

    // Log do ambiente para debug
    console.log('Ambiente:', process.env.NODE_ENV);
    // Mantendo a URL hardcoded como solicitado, embora o uso de variável de ambiente seja recomendado
    console.log('API URL (Hardcoded):', 'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr');
    console.log('AppKey está definido:', !!process.env.SANKHYA_APPKEY);

    // Validações básicas
    if (!nunota) {
        return res.status(400).json({ error: "Número único da nota é obrigatório" });
    }
    // Validar que itens é um array e não está vazio
    if (!itens || !Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ error: "É necessário informar pelo menos um item com problema" });
    }
    // Validar que cada item no array tem a sequencia, observacao e o erroCodigo
    for (const item of itens) {
        if (item.sequencia === undefined || item.sequencia === null) {
             return res.status(400).json({ error: `Item com problema sem número de sequência: ${JSON.stringify(item)}` });
        }
         // Validação adicionada para o erroCodigo
        if (!item.erroCodigo || !["01", "02", "03"].includes(item.erroCodigo)) {
             return res.status(400).json({ error: `Código de erro inválido ou ausente para o item com sequência ${item.sequencia}. Valores permitidos: 01, 02, 03.` });
        }
    }

    if (!conferenteCodigo) {
        return res.status(400).json({ error: "Código do conferente é obrigatório" });
    }

    try {
        // Buscar id_usuario com base no conferenteCodigo
        const result = await db.query('SELECT id_usuario FROM usuario WHERE codsep = $1', [conferenteCodigo]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Conferente não encontrado." });
        }
        const id_usuario = result.rows[0].id_usuario;

        // Obter token de autenticação do banco de dados
        const token = await getBearerTokenFromDB(id_usuario);
        if (!token) {
            return res.status(500).json({ erro: 'Token de autenticação não encontrado para o usuário' });
        }
        const appkey = process.env.SANKHYA_APPKEY;

        // 1. Buscar o separador original (status 2 - separação)
        const sqlBuscarSeparador = `
            SELECT OPERADOR AS separador
            FROM AD_TGFEXP
            WHERE NUNOTA = ${nunota}
            AND STATUS = 2
            ORDER BY DATA DESC
            -- Adicionado LIMIT 1 para Oracle, se necessário (ROWNUM = 1 já está na outra query)
            -- Se seu banco não for Oracle, pode precisar de LIMIT 1 ou FETCH FIRST 1 ROW ONLY
        `;
         const requestBuscarSeparador = {
            serviceName: 'DbExplorerSP.executeQuery',
            requestBody: {
                sql: sqlBuscarSeparador
            }
        };
        console.log('Requisição para buscar separador:', sqlBuscarSeparador);
        console.log('Token usado (parcial):', token ? token.substring(0, 10) + '...' : 'null');

        // Mantendo a URL hardcoded como solicitado
        const sankhyaApiUrl = 'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr';

        const responseSeparador = await axios.post(
            `${sankhyaApiUrl}?serviceName=DbExplorerSP.executeQuery&outputType=json`,
            requestBuscarSeparador,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'appkey': appkey
                }
            }
        );
        console.log('Resposta da busca pelo separador:', JSON.stringify(responseSeparador.data));

        // Verificar se encontrou o separador
        if (!responseSeparador.data?.responseBody?.rows ||
            responseSeparador.data.responseBody.rows.length === 0) {
            return res.status(404).json({ error: "Separador original não encontrado para esta nota." });
        }
        const codigoSeparador = responseSeparador.data.responseBody.rows[0][0];
        console.log('Código do separador encontrado:', codigoSeparador);

        // 2. Buscar o conferente atual (status 3, 5, 8)
         const sqlBuscarConferente = `
            SELECT OPERADOR
            FROM AD_TGFEXP
            WHERE NUNOTA = ${nunota}
            AND STATUS IN (3, 5, 8)
            AND ROWNUM = 1 -- Para Oracle
            ORDER BY DATA DESC
        `;
         const requestBuscarConferente = {
            serviceName: 'DbExplorerSP.executeQuery',
            requestBody: {
                sql: sqlBuscarConferente
            }
        };
        console.log('Requisição para buscar conferente:', sqlBuscarConferente);
        const responseConferente = await axios.post(
            `${sankhyaApiUrl}?serviceName=DbExplorerSP.executeQuery&outputType=json`,
            requestBuscarConferente,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'appkey': appkey
                }
            }
        );

        console.log('Resposta da busca pelo conferente:', JSON.stringify(responseConferente.data));

        // Verificar se encontrou o conferente e implementar fallbacks
        let codigoConferente;
        if (!responseConferente.data?.responseBody?.rows ||
            responseConferente.data.responseBody.rows.length === 0 ||
            responseConferente.data.status === "0") { // Status 0 indica erro
            console.log("Conferente não encontrado na tabela AD_TGFEXP, implementando fallbacks...");
            // Fallback 1: Tentar buscar na tabela de usuários
            try {
                const userResult = await db.query(
                    'SELECT codsep FROM usuario WHERE codsep = $1',
                    [conferenteCodigo]
                );
                if (userResult.rows.length > 0) {
                    codigoConferente = conferenteCodigo;
                    console.log("Conferente encontrado na tabela de usuários:", codigoConferente);
                } else {
                    // Fallback 2: Usar o código do conferente da requisição diretamente
                    codigoConferente = conferenteCodigo;
                    console.log("Usando código do conferente da requisição como fallback final:", codigoConferente);
                }
            } catch (dbError) {
                console.error("Erro ao buscar conferente na tabela de usuários:", dbError);
                codigoConferente = conferenteCodigo; // Em caso de erro no DB, usa o código da requisição
            }
        } else {
            codigoConferente = responseConferente.data.responseBody.rows[0][0];
            console.log("Conferente encontrado na tabela Sankhya:", codigoConferente);
        }


        // 3. Atualizar o status na tabela CabecalhoNota (AD_CODIGO)
        // Mantido conforme o exemplo que você indicou que funciona
        const requestBodyADCodigo = {
            serviceName: "DatasetSP.save",
            requestBody: {
                entityName: "CabecalhoNota",
                standAlone: false,
                fields: ["AD_CODIGO", "AD_SEPARADORNEW"],
                records: [
                    {
                        pk: { NUNOTA: nunota },
                        values: {
                            "0": novoStatus, // Status 9 para devolução ao separador
                            "1": codigoSeparador // Salva o código do separador original
                        }
                    }
                ]
            }
        };

        // Fazendo a requisição à API da Sankhya para atualização do AD_CODIGO
        console.log('Tentando atualizar AD_CODIGO para status', novoStatus);
        const responseADCodigo = await axios.post(
            `${sankhyaApiUrl}?serviceName=DatasetSP.save&outputType=json`,
            requestBodyADCodigo,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'appkey': appkey // Incluindo appkey no header
                }
            }
        );
        console.log('Resposta da atualização do AD_CODIGO:', JSON.stringify(responseADCodigo.data));

        // 4. Registrar devolução ao separador (status 9) na tabela AD_TGFEXP
        // Usando o código do conferente que está devolvendo (conferenteCodigo)
        const dataAtual = formatarDataHora();
        const requestDevolucao = {
            serviceName: 'DatasetSP.save',
            requestBody: {
                entityName: "AD_TGFEXP",
                standAlone: false,
                fields: ["DATA", "NUNOTA", "STATUS", "OBS", "OPERADOR"],
                records: [
                    {
                        values: {
                            "0": dataAtual,
                            "1": nunota,
                            "2": "9", // Status 9 - Devolvido ao separador
                            "3": observacaoGeral || `Devolvido ao separador original (${codigoSeparador}) devido a problemas nos itens.`,
                            "4": conferenteCodigo // O operador que está registrando a devolução é o conferente
                        }
                    }
                ]
            }
        };

        console.log('Requisição de devolução (AD_TGFEXP):', JSON.stringify(requestDevolucao));
        const responseDevolucao = await axios.post(
            `${sankhyaApiUrl}?serviceName=DatasetSP.save&outputType=json`,
            requestDevolucao,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'appkey': appkey
                }
            }
        );
        console.log('Resposta do registro na AD_TGFEXP:', responseDevolucao.data);


        // 5. Registrar observações e CÓDIGO DE ERRO para cada item com problema na TGFITE
        const itensProcessados = [];
        let contadorAtualizados = 0;

        for (const item of itens) {
            try {
                 // Construindo o payload para atualizar o item na TGFITE (ItemNota)
                const payload = {
                    serviceName: "DatasetSP.save",
                    requestBody: {
                        entityName: "ItemNota",
                        standAlone: false,
                        // Campos a serem atualizados: Observação, Código de Erro, Número da Nota de Erro (se aplicável)
                        fields: ["AD_OBSCONF", "AD_LISTERR", "AD_NUNOTAERR"],
                        records: [
                            {
                                pk: {
                                    NUNOTA: nunota,
                                    SEQUENCIA: item.sequencia
                                },
                                values: {
                                    "0": item.observacao?.toString() || "Item com problema", // AD_OBSCONF
                                    "1": item.erroCodigo, // AD_LISTERR - Salvando o código de erro aqui
                                    "2": item.nunota // AD_NUNOTAERR (mantido conforme seu código original)
                                }
                            }
                        ]
                    }
                };

                console.log(`Requisição para atualizar item ${item.sequencia}:`, JSON.stringify(payload));

                const responseItem = await axios.post(
                    `${sankhyaApiUrl}?serviceName=DatasetSP.save&outputType=json`,
                    payload,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            'appkey': appkey
                        }
                    }
                );

                console.log(`Item ${item.sequencia} atualizado:`, responseItem.data);

                 // Verificar o status da resposta do item
                 if (responseItem.data?.status === '1') {
                    contadorAtualizados++;
                    itensProcessados.push({
                        sequencia: item.sequencia,
                        status: "ok",
                        observacao: item.observacao,
                        erroCodigo: item.erroCodigo // Inclui o código de erro no resultado
                    });
                 } else {
                    // Se o status não for '1', considera como erro na atualização do item
                    console.error(`Erro ao atualizar item ${item.sequencia}:`, responseItem.data);
                    itensProcessados.push({
                        sequencia: item.sequencia,
                        status: "erro",
                        observacao: item.observacao,
                        erroCodigo: item.erroCodigo, // Inclui o código de erro mesmo em caso de erro
                        erro: responseItem.data?.statusMessage || JSON.stringify(responseItem.data)
                    });
                 }

            } catch (itemError) {
                console.error(`Exceção ao atualizar item ${item.sequencia}:`, itemError);
                itensProcessados.push({
                    sequencia: item.sequencia,
                    status: "erro",
                    observacao: item.observacao,
                    erroCodigo: item.erroCodigo, // Inclui o código de erro mesmo em caso de exceção
                    erro: itemError.message,
                    stack: itemError.stack
                });
            }
        }

        // 6. Verificar se as observações e códigos de erro foram salvos corretamente
        // Adicionado AD_LISTERR na query de verificação
        const sqlVerificar = `
            SELECT NUNOTA, SEQUENCIA, AD_OBSCONF, AD_LISTERR, AD_NUNOTAERR
            FROM TGFITE
            WHERE NUNOTA = ${nunota}
            AND (AD_OBSCONF IS NOT NULL OR AD_LISTERR IS NOT NULL OR AD_NUNOTAERR IS NOT NULL)
        `;
        const requestVerificar = {
            serviceName: 'DbExplorerSP.executeQuery',
            requestBody: {
                sql: sqlVerificar
            }
        };
        console.log('Requisição de verificação após atualização dos itens:', sqlVerificar);
        const responseVerificar = await axios.post(
            `${sankhyaApiUrl}?serviceName=DbExplorerSP.executeQuery&outputType=json`,
            requestVerificar,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'appkey': appkey
                }
            }
        );
        console.log('Verificação após atualização dos itens:', JSON.stringify(responseVerificar.data));


        // Resposta final
        // Inclui detalhes sobre os itens processados e a verificação
        return res.status(200).json({
            mensagem: `Nota ${nunota} devolvida ao separador ${codigoSeparador} com sucesso.`,
            // Verifica se a atualização do cabeçalho e o registro na AD_TGFEXP foram bem sucedidos
            statusGeral: responseADCodigo.data?.status === '1' && responseDevolucao.data?.status === '1' ? 'ok' : 'parcial',
            totalItensEnviados: itens.length,
            itensAtualizadosComSucesso: contadorAtualizados,
            statusAtualNota: 9, // O status que foi definido para a nota
            detalhesItensProcessados: itensProcessados, // Detalhes de cada item (sucesso/erro)
            verificacaoItensSankhya: responseVerificar.data?.responseBody?.rows || [], // Resultado da query de verificação
            responseSankhyaCabecalho: responseADCodigo.data, // Resposta bruta da atualização do cabeçalho
            responseSankhyaADTGFEXP: responseDevolucao.data // Resposta bruta do registro na AD_TGFEXP
        });

    } catch (error) {
        console.error('Erro geral ao devolver itens ao separador:', error);
        // Retorna um erro 500 com detalhes em caso de falha geral (antes de processar itens ou na busca inicial)
        return res.status(500).json({
            error: 'Erro interno ao processar devolução de itens',
            detalhes: error.message,
            stack: error.stack,
            // Opcional: Incluir itensProcessados aqui se a falha ocorrer APÓS o loop de itens começar
            // itensProcessadosParciais: itensProcessados // Descomentar se necessário
        });
    }
};



export const retornarParaConferente = async (req, res) => {
    const { separadorCodigo } = req.params;
    const { nunota } = req.body;
    
    // Validações básicas
    if (!nunota) {
        return res.status(400).json({
            error: "Número único da nota é obrigatório"
        });
    }
    
    if (!separadorCodigo) {
        return res.status(400).json({ error: "Código do separador é obrigatório" });
    }
    
    try {
        // Buscar id_usuario com base no separadorCodigo
        const result = await db.query('SELECT id_usuario FROM usuario WHERE codsep = $1', [separadorCodigo]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Separador não encontrado." });
        }
        
        const id_usuario = result.rows[0].id_usuario;
        const token = await getBearerTokenFromDB(id_usuario);
        
        if (!token) {
            return res.status(500).json({ erro: 'Token de autenticação não encontrado para o usuário' });
        }
        
        const appkey = process.env.SANKHYA_APPKEY;
        
        // 1. Buscar o conferente que estava anteriormente com status 3 (conferência)
        // antes da devolução para o separador (antes do status 9)
        const sqlBuscarConferente = `
            SELECT OPERADOR AS conferente
            FROM AD_TGFEXP
            WHERE NUNOTA = ${nunota}
            AND STATUS = 3 -- Status de conferência
            AND DATA < (
                SELECT MAX(DATA)
                FROM AD_TGFEXP
                WHERE NUNOTA = ${nunota} AND STATUS = 9
            )
            ORDER BY DATA DESC
            FETCH FIRST 1 ROWS ONLY
        `;
        
        const requestBuscarConferente = {
            serviceName: 'DbExplorerSP.executeQuery',
            requestBody: {
                sql: sqlBuscarConferente
            }
        };
        
        console.log('Requisição para buscar conferente:', sqlBuscarConferente);
        
        const responseConferente = await axios.post(
            'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
            requestBuscarConferente,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'appkey': appkey
                }
            }
        );
        
        console.log('Resposta da busca pelo conferente:', JSON.stringify(responseConferente.data));
        
        // Verificar se encontrou o conferente
        let codigoConferente;
        if (!responseConferente.data?.responseBody?.rows ||
            responseConferente.data.responseBody.rows.length === 0) {
            
            // Plano B: Se não encontrar com a consulta específica, tentar uma mais ampla
            // para encontrar o último conferente com status 5
            const sqlBuscarConferenteAlt = `
                SELECT OPERADOR AS conferente
                FROM AD_TGFEXP
                WHERE NUNOTA = ${nunota}
                AND STATUS = 5 -- Status de conferência pós-devolução
                ORDER BY DATA DESC
                FETCH FIRST 1 ROWS ONLY
            `;
            
            const requestBuscarConferenteAlt = {
                serviceName: 'DbExplorerSP.executeQuery',
                requestBody: {
                    sql: sqlBuscarConferenteAlt
                }
            };
            
            console.log('Tentativa alternativa para buscar conferente:', sqlBuscarConferenteAlt);
            
            const responseConferenteAlt = await axios.post(
                'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
                requestBuscarConferenteAlt,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'appkey': appkey
                    }
                }
            );
            
            if (!responseConferenteAlt.data?.responseBody?.rows ||
                responseConferenteAlt.data.responseBody.rows.length === 0) {
                
                // Plano C: Última tentativa - buscar qualquer conferente no histórico
                const sqlBuscarConferenteFinal = `
                    SELECT OPERADOR AS conferente
                    FROM AD_TGFEXP
                    WHERE NUNOTA = ${nunota}
                    AND STATUS IN (3, 4, 5, 8)  -- Qualquer status relacionado a conferência
                    ORDER BY DATA DESC
                    FETCH FIRST 1 ROWS ONLY
                `;
                
                const requestBuscarConferenteFinal = {
                    serviceName: 'DbExplorerSP.executeQuery',
                    requestBody: {
                        sql: sqlBuscarConferenteFinal
                    }
                };
                
                const responseConferenteFinal = await axios.post(
                    'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
                    requestBuscarConferenteFinal,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            'appkey': appkey
                        }
                    }
                );
                
                if (!responseConferenteFinal.data?.responseBody?.rows ||
                    responseConferenteFinal.data.responseBody.rows.length === 0) {
                    return res.status(404).json({ error: "Conferente não encontrado no histórico da nota" });
                }
                
                codigoConferente = responseConferenteFinal.data.responseBody.rows[0][0];
            } else {
                codigoConferente = responseConferenteAlt.data.responseBody.rows[0][0];
            }
            
            console.log('Código do conferente encontrado (método alternativo):', codigoConferente);
        } else {
            codigoConferente = responseConferente.data.responseBody.rows[0][0];
            console.log('Código do conferente encontrado:', codigoConferente);
        }
        
        // 2. Atualizar o AD_CODIGO na tabela CabecalhoNota para 5 e AD_SEPARADORNEW para o código do CONFERENTE
        const requestBodyADCodigo = {
            serviceName: "DatasetSP.save",
            requestBody: {
                entityName: "CabecalhoNota",
                standAlone: false,
                fields: ["AD_CODIGO", "AD_SEPARADORNEW"],
                records: [
                    {
                        pk: { NUNOTA: nunota },
                        values: {
                            "0": "5", // Status 5 - Retorno para o conferente
                            "1": codigoConferente // Usar o código do conferente, não do separador
                        }
                    }
                ]
            }
        };
        
        // Fazendo a requisição à API da Sankhya para atualização do AD_CODIGO
        console.log('Tentando atualizar AD_CODIGO para status 5 e AD_SEPARADORNEW para', codigoConferente);
        const responseADCodigo = await axios.post(
            'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DatasetSP.save&outputType=json',
            requestBodyADCodigo,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'appkey': appkey
                }
            }
        );
        
        console.log('Resposta da atualização do AD_CODIGO:', JSON.stringify(responseADCodigo.data));
        
        // 3. Registrar retorno ao conferente (status 5) na tabela AD_TGFEXP
        const dataAtual = formatarDataHora();
        const requestRetorno = {
            serviceName: 'DatasetSP.save',
            requestBody: {
                entityName: "AD_TGFEXP",
                standAlone: false,
                fields: ["DATA", "NUNOTA", "STATUS", "OBS", "OPERADOR"],
                records: [
                    {
                        values: {
                            "0": dataAtual,
                            "1": nunota,
                            "2": "5", // Status 5 - Retornado ao conferente
                            "3": "Itens revisados pelo separador", // Observação padrão
                            "4": codigoConferente // Usar o código do conferente, não do separador
                        }
                    }
                ]
            }
        };
        
        console.log('Requisição de retorno ao conferente:', JSON.stringify(requestRetorno));
        
        const responseRetorno = await axios.post(
            'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DatasetSP.save&outputType=json',
            requestRetorno,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'appkey': appkey
                }
            }
        );
        
        console.log('Resposta do retorno ao conferente:', JSON.stringify(responseRetorno.data));
        
        return res.status(200).json({
            mensagem: `Nota ${nunota} retornada ao conferente ${codigoConferente} com sucesso.`,
            statusAtual: 5
        });
        
    } catch (error) {
        console.error('Erro ao retornar itens ao conferente:', error);
        return res.status(500).json({
            error: 'Erro ao retornar itens ao conferente',
            detalhes: error.message,
            stack: error.stack
        });
    }
};
