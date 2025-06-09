import axios from 'axios';
import dotenv from 'dotenv';
import { db } from '../../database/connection.database.js';
import { getBearerToken } from '.././auth.controller.js';
dotenv.config();


// Função para listar detalhes do pedido para conferência, agrupando por produto e lote
export const listarDetalhesPedidoConferente = async (req, res) => {
    const { nroUnico, conferenteCodigo } = req.params;
    const conferenteCodigoInt = parseInt(conferenteCodigo, 10);

    if (!conferenteCodigo || isNaN(conferenteCodigoInt)) {
        return res.status(400).json({ error: "Código do conferente inválido." });
    }

    try {
        // Verificar se o conferente existe no banco
        const userResult = await db.query('SELECT id_usuario FROM usuario WHERE codsep = $1', [conferenteCodigoInt]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "Conferente não encontrado." });
        }
        const id_usuario = userResult.rows[0].id_usuario;
        console.log('ID do usuário obtido:', id_usuario);

        // Obter token de autenticação
        const token = await getBearerToken(id_usuario);
        const appkey = process.env.SANKHYA_APPKEY;

        if (!token) {
            return res.status(500).json({ erro: 'Token de autenticação não encontrado' });
        }

        // Consulta SQL para obter os detalhes do pedido
        // Esta consulta traz as linhas individuais, o agrupamento será feito no backend
        const sqlQuery = `
            SELECT
                ITE.NUNOTA AS "Nro_Unico",
                PRO.CODPROD AS "Codigo_Produto",
                PRO.DESCRPROD AS "Descricao_Produto",
                PRO.MARCA AS "Marca",
                PRO.CODVOL AS "Uni",
                ITE.CONTROLE AS "Lote",
                ITE.QTDNEG AS "Quantidade", -- Quantidade individual da linha
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

        // Fazer requisição à API do Sankhya
        const response = await axios.post(
            `https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`,
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
                // Agrupar os itens por Codigo_Produto e Lote
                const groupedItems = rows.reduce((acc, row) => {
                    const codProduto = row[1] || null;
                    const lote = row[5] || ''; // Lote pode ser null, tratar como string vazia
                    const chaveGrupo = `${codProduto}-${lote}`;

                    if (!acc[chaveGrupo]) {
                        acc[chaveGrupo] = {
                            Nro_Unico: row[0] || null,
                            Codigo_Produto: codProduto,
                            Descricao_Produto: row[2] || null,
                            Marca: row[3] || null,
                            Uni: row[4] || null,
                            Lote: lote,
                            Quantidade_Real_Total: 0, // Inicializa a soma
                            sequencias: [], // Para manter as sequências originais se necessário
                            Localizacao: row[8] || null, // Pega a localização do primeiro item do grupo (pode variar)
                            Armazenagem: row[9] || null, // Pega a armazenagem do primeiro item do grupo (pode variar)
                            Controlado: row[10] || 'Não',
                            // Propriedades de controle de conferência serão adicionadas depois
                        };
                    }

                    // Soma a quantidade individual à quantidade total do grupo
                    acc[chaveGrupo].Quantidade_Real_Total += parseFloat(row[6] || 0);
                    acc[chaveGrupo].sequencias.push(row[7] || null); // Adiciona a sequência individual

                    return acc;
                }, {});

                // Converter o objeto agrupado de volta para um array
                const groupedItemsArray = Object.values(groupedItems);

                // Verificar tentativas registradas para cada grupo (codprod, lote)
                const tentativasResult = await db.query(
                    'SELECT codprod, lote, tentativas, acerto FROM conferencia_tentativas WHERE nunota = $1 AND conferente_codigo = $2',
                    [nroUnico, conferenteCodigoInt]
                );

                // Mapear tentativas por grupo (codprod-lote)
                let tentativasPorGrupo = {};
                if (tentativasResult.rows.length > 0) {
                    for (const tentativa of tentativasResult.rows) {
                         const chaveGrupo = `${tentativa.codprod}-${tentativa.lote || ''}`;
                         tentativasPorGrupo[chaveGrupo] = {
                            tentativas: tentativa.tentativas,
                            acerto: tentativa.acerto
                         };
                    }
                }

                // Adicionar informações de tentativa a cada item agrupado
                const result = groupedItemsArray.map(item => {
                    const chaveGrupo = `${item.Codigo_Produto}-${item.Lote}`;
                    const tentativasInfo = tentativasPorGrupo[chaveGrupo] || { tentativas: 0, acerto: false };

                    const tentativasRestantes = 2 - tentativasInfo.tentativas;
                    const bloqueado = tentativasInfo.tentativas >= 2 && !tentativasInfo.acerto;

                    return {
                        Nro_Unico: item.Nro_Unico,
                        Codigo_Produto: item.Codigo_Produto,
                        Descricao_Produto: item.Descricao_Produto,
                        Marca: item.Marca,
                        Uni: item.Uni,
                        Lote: item.Lote,
                        // Não envia a quantidade real total na listagem inicial por segurança
                        // Quantidade_Real_Total: item.Quantidade_Real_Total,
                        // sequencias: item.sequencias, // Opcional: enviar as sequências individuais
                        Localizacao: item.Localizacao,
                        Armazenagem: item.Armazenagem,
                        Controlado: item.Controlado,
                        tentativas_restantes: tentativasRestantes,
                        acertou: tentativasInfo.acerto,
                        bloqueado: bloqueado
                    };
                });

                return res.json({
                    detalhes: result
                });

            } else {
                 // Verificar se o pedido existe, mas não tem itens (pode acontecer)
                 // Uma forma simples é tentar buscar a nota no Sankhya
                 const notaCheckQuery = `SELECT NUNOTA FROM TGFCAB WHERE NUNOTA = '${nroUnico}'`;
                 const notaCheckBody = {
                     serviceName: 'DbExplorerSP.executeQuery',
                     requestBody: { sql: notaCheckQuery }
                 };
                 const notaCheckResponse = await axios.post(
                     `https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`,
                     notaCheckBody,
                     { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'appkey': appkey } }
                 );

                 if (notaCheckResponse.data?.status === '1' && notaCheckResponse.data.responseBody?.rows?.length > 0) {
                     // Pedido existe, mas não tem itens (ou todos foram removidos/cancelados)
                     return res.status(200).json({ detalhes: [], message: 'Pedido encontrado, mas sem itens para conferir.' });
                 } else {
                     // Pedido não encontrado
                     return res.status(404).json({ error: 'Pedido não encontrado.' });
                 }
            }
        } else {
            console.error('Erro na resposta da API Sankhya:', response.data);
            // Tentar extrair mensagem de erro da API se disponível
            const sankhyaError = response.data?.statusMessage || response.data?.status || 'Erro desconhecido na API do Sankhya';
            return res.status(500).json({ error: 'Erro ao obter detalhes do pedido da API do Sankhya', detalhes: sankhyaError });
        }
    } catch (error) {
        console.error('Erro ao listar detalhes do pedido para conferente:', error);
         // Tratar erro 404 específico do axios se a URL não for encontrada (embora a URL da API seja fixa)
         if (axios.isAxiosError(error) && error.response && error.response.status === 404) {
             return res.status(404).json({ error: 'Recurso da API não encontrado.', detalhes: error.message });
         }
        return res.status(500).json({ error: 'Erro interno ao listar detalhes do pedido para conferente', detalhes: error.message });
    }
};

// Função para verificar a quantidade informada pelo conferente para um grupo (produto + lote)
export const verificarQuantidadeConferente = async (req, res) => {
    const { nroUnico, codProduto, conferenteCodigo, lote } = req.params;
    const { quantidadeInformada } = req.body;

    const conferenteCodigoInt = parseInt(conferenteCodigo, 10);
    const codProdutoInt = parseInt(codProduto, 10);
    const quantidadeInformadaFloat = parseFloat(String(quantidadeInformada).replace(',', '.')); // Tratar vírgula como separador decimal
    const loteTratado = lote || ""; // Tratar lote vazio como string vazia

    // Validações básicas
    if (!conferenteCodigo || isNaN(conferenteCodigoInt)) {
        return res.status(400).json({ error: "Código do conferente inválido." });
    }
    if (!codProduto || isNaN(codProdutoInt)) {
        return res.status(400).json({ error: "Código do produto inválido." });
    }
    if (isNaN(quantidadeInformadaFloat)) {
        return res.status(400).json({ error: "Quantidade informada inválida." });
    }

    try {
        // Verificar se o conferente existe (opcional, já feito na listagem, mas boa prática para esta rota individual)
        const userResult = await db.query('SELECT id_usuario FROM usuario WHERE codsep = $1', [conferenteCodigoInt]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "Conferente não encontrado." });
        }
        const id_usuario = userResult.rows[0].id_usuario;

        // Obter token de autenticação
        const token = await getBearerToken(id_usuario);
        const appkey = process.env.SANKHYA_APPKEY;

        if (!token) {
            return res.status(500).json({ erro: 'Token de autenticação não encontrado' });
        }

        // Consulta SQL para obter a SOMA das quantidades de todos os itens
        // com o mesmo CODPROD e LOTE neste pedido
        const sqlQuery = `
            SELECT SUM(ITE.QTDNEG) AS "QuantidadeTotal"
            FROM TGFITE ITE
            WHERE ITE.NUNOTA = '${nroUnico}'
            AND ITE.CODPROD = ${codProdutoInt}
            AND ITE.CONTROLE = '${loteTratado}'
        `;

        const requestBody = {
            serviceName: 'DbExplorerSP.executeQuery',
            requestBody: {
                sql: sqlQuery
            }
        };

        // Fazer requisição à API do Sankhya para obter a soma da quantidade real
        const response = await axios.post(
            `https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`,
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

            if (Array.isArray(rows) && rows.length > 0 && rows[0][0] !== null) {
                const quantidadeRealTotal = parseFloat(rows[0][0] || 0); // A quantidade real é a soma

                // Verificar tentativas anteriores para este grupo (codprod, lote)
                const tentativasResult = await db.query(
                    'SELECT tentativas, acerto FROM conferencia_tentativas WHERE nunota = $1 AND conferente_codigo = $2 AND codprod = $3 AND lote = $4',
                    [nroUnico, conferenteCodigoInt, codProdutoInt, loteTratado]
                );

                const tentativasAnteriores = tentativasResult.rows.length > 0 ? tentativasResult.rows[0] : { tentativas: 0, acerto: false };
                const tentativasAtuais = tentativasAnteriores.tentativas;
                const acertoAnterior = tentativasAnteriores.acerto;

                 // Se já acertou anteriormente ou esgotou tentativas (2 por grupo)
                 // Não permite nova tentativa para este grupo
                 if (acertoAnterior || tentativasAtuais >= 2) {
                     // Retorna o status atual do grupo
                     return res.json({
                         acerto: acertoAnterior,
                         tentativas_restantes: 0,
                         bloqueado: !acertoAnterior, // Bloqueado se não acertou na última tentativa (e já esgotou)
                         quantidade_real: quantidadeRealTotal // Sempre mostra a quantidade real total após o bloqueio
                     });
                 }


                // Verificar se a quantidade informada é igual à real total (com tolerância para ponto flutuante)
                const acertou = Math.abs(quantidadeInformadaFloat - quantidadeRealTotal) < 0.001;

                const novasTentativas = tentativasAtuais + 1;

                // Atualizar ou inserir o registro na tabela conferencia_tentativas para o grupo (codprod, lote)
                await db.query(
                    `INSERT INTO conferencia_tentativas (nunota, conferente_codigo, codprod, lote, tentativas, acerto, quantidade_informada, quantidade_real)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     ON CONFLICT (nunota, conferente_codigo, codprod, lote)
                     DO UPDATE SET
                        tentativas = EXCLUDED.tentativas,
                        acerto = EXCLUDED.acerto,
                        quantidade_informada = EXCLUDED.quantidade_informada,
                        quantidade_real = EXCLUDED.quantidade_real;`,
                    [nroUnico, conferenteCodigoInt, codProdutoInt, loteTratado, novasTentativas, acertou, quantidadeInformadaFloat, quantidadeRealTotal]
                );

                // Determinar se o grupo está bloqueado após esta tentativa
                const bloqueado = !acertou && novasTentativas >= 2;

                // Na última tentativa (ou se acertou), mostrar a quantidade real total
                const mostrarQuantidadeReal = acertou || novasTentativas >= 2;

                return res.json({
                    acerto: acertou,
                    tentativas_restantes: acertou || bloqueado ? 0 : 2 - novasTentativas, // Restantes são 0 se acertou ou foi bloqueado
                    bloqueado: bloqueado,
                    quantidade_real: mostrarQuantidadeReal ? quantidadeRealTotal : null // Só mostra a real na última tentativa ou se acertou
                });

            } else {
                // Isso pode acontecer se o produto/lote não existir no pedido (embora a listagem já deveria filtrar)
                // Ou se a soma for NULL (improvável para quantidade)
                return res.status(404).json({ error: 'Produto com este lote não encontrado neste pedido ou quantidade real zero.' });
            }
        } else {
             console.error('Erro na resposta da API Sankhya ao buscar quantidade:', response.data);
             const sankhyaError = response.data?.statusMessage || response.data?.status || 'Erro desconhecido na API do Sankhya';
            return res.status(500).json({ error: 'Erro ao obter quantidade real da API do Sankhya', detalhes: sankhyaError });
        }
    } catch (error) {
        console.error('Erro ao verificar quantidade:', error);
        return res.status(500).json({ error: 'Erro interno ao verificar quantidade', detalhes: error.message });
    }
};

// Função para resetar as tentativas de conferência para um produto específico ou todo o pedido
export const resetarTentativasConferencia = async (req, res) => {
    const { nroUnico, conferenteCodigo } = req.params;
    const { codProduto } = req.query; // Opcional: se fornecido, reseta apenas o produto específico
    
    try {
        if (codProduto) {
            // Reseta apenas o produto específico
            await db.query(
                'DELETE FROM conferencia_tentativas WHERE nunota = $1 AND conferente_codigo = $2 AND codprod = $3',
                [nroUnico, conferenteCodigo, codProduto]
            );
            
            return res.json({
                message: `Tentativas de conferência do produto ${codProduto} resetadas com sucesso`,
                success: true
            });
        } else {
            // Reseta todo o pedido
            await db.query(
                'DELETE FROM conferencia_tentativas WHERE nunota = $1 AND conferente_codigo = $2',
                [nroUnico, conferenteCodigo]
            );
            
            return res.json({
                message: 'Todas as tentativas de conferência deste pedido foram resetadas com sucesso',
                success: true
            });
        }
    } catch (error) {
        console.error('Erro ao resetar tentativas:', error);
        return res.status(500).json({ error: 'Erro ao resetar tentativas de conferência' });
    }
};
