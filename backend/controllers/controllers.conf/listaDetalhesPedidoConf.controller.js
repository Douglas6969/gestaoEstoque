import axios from 'axios';
import dotenv from 'dotenv';
import { db } from '../../database/connection.database.js';
import { getBearerToken } from '.././auth.controller.js';
dotenv.config();

// Função para listar detalhes do pedido para conferente
export const listarDetalhesPedidoConferente = async (req, res) => {
    const { nroUnico, conferenteCodigo } = req.params;
    const conferenteCodigoInt = parseInt(conferenteCodigo, 10);
    
    if (!conferenteCodigo || isNaN(conferenteCodigoInt)) {
        return res.status(400).json({ error: "Código do conferente inválido." });
    }
    
    try {
        // Verificar se o conferente existe no banco
        const result = await db.query('SELECT id_usuario FROM usuario WHERE codsep = $1', [conferenteCodigoInt]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Conferente não encontrado." });
        }
        
        const id_usuario = result.rows[0].id_usuario;
        console.log('ID do usuário obtido:', id_usuario);
        
        // Obter token de autenticação
        const token = await getBearerToken(id_usuario);
        const appkey = process.env.SANKHYA_APPKEY;
        
        if (!token) {
            return res.status(500).json({ erro: 'Token de autenticação não encontrado' });
        }
        
        // Consulta SQL para obter os detalhes do pedido (mesma do separador)
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
        
        // Fazer requisição à API do Sankhya
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
                // Verificar se já existem tentativas registradas para este pedido/conferente
                const tentativasResult = await db.query(
                    'SELECT * FROM conferencia_tentativas WHERE nunota = $1 AND conferente_codigo = $2',
                    [nroUnico, conferenteCodigoInt]
                );
                
                // Criar estrutura para armazenar as tentativas por produto
                let tentativasPorProduto = {};
                
                // Se já existem registros, carregá-los
                if (tentativasResult.rows.length > 0) {
                    for (const tentativa of tentativasResult.rows) {
                        if (!tentativasPorProduto[tentativa.codprod]) {
                            tentativasPorProduto[tentativa.codprod] = {
                                tentativas: tentativa.tentativas,
                                acerto: tentativa.acerto
                            };
                        }
                    }
                }
                
                // Transformar os dados da resposta da API
                const result = rows.map((row) => {
                    const codProduto = row[1] || null;
                    const qtdReal = row[6] || null;
                    
                    // Verificar se existem tentativas para este produto
                    const tentativas = tentativasPorProduto[codProduto] || { tentativas: 0, acerto: false };
                    
                    // Criar objeto com informações do produto
                    return {
                        Nro_Unico: row[0] || null,
                        Codigo_Produto: codProduto,
                        Descricao_Produto: row[2] || null,
                        Marca: row[3] || null,
                        Uni: row[4] || null,
                        Lote: row[5] || null,
                        // Quantidade não é exibida - será usada apenas para validação
                        Quantidade_Real: qtdReal,
                        sequencia: row[7] || null,
                        Localizacao: row[8] || null,
                        Armazenagem: row[9] || null,
                        Controlado: row[10] || 'Não',
                        // Adicionando informações para controle de tentativas
                        tentativas_restantes: 2 - tentativas.tentativas,
                        acertou: tentativas.acerto,
                        bloqueado: tentativas.tentativas >= 2 && !tentativas.acerto
                    };
                });
                
                return res.json({
                    detalhes: result.map(item => {
                        // Remover a quantidade real da resposta
                        const { Quantidade_Real, ...itemSemQuantidade } = item;
                        return itemSemQuantidade;
                    })
                });
            } else {
                return res.status(404).json({ error: 'Nenhum detalhe encontrado para este pedido' });
            }
        } else {
            return res.status(500).json({ error: 'Erro ao processar a resposta da API do Sankhya' });
        }
    } catch (error) {
        console.error('Erro ao listar detalhes do pedido para conferente:', error.message);
        return res.status(500).json({ error: 'Erro ao listar detalhes do pedido para conferente' });
    }
};

// Função para verificar a quantidade informada pelo conferente
export const verificarQuantidadeConferente = async (req, res) => {
    const { nroUnico, codProduto, conferenteCodigo, lote } = req.params;
    const { quantidadeInformada } = req.body;
    const conferenteCodigoInt = parseInt(conferenteCodigo, 10);
    const codProdutoInt = parseInt(codProduto, 10);
    const quantidadeInformadaFloat = parseFloat(quantidadeInformada);
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
        // Verificar se o conferente existe
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

        // Consulta SQL para obter a quantidade real do produto com o lote específico
        const sqlQuery = `
            SELECT ITE.QTDNEG AS "Quantidade"
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

        // Fazer requisição à API do Sankhya
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
                const quantidadeReal = parseFloat(rows[0][0] || 0);
                
                // Verificar tentativas anteriores para este produto específico COM este lote específico
                const tentativasResult = await db.query(
                    'SELECT * FROM conferencia_tentativas WHERE nunota = $1 AND conferente_codigo = $2 AND codprod = $3 AND lote = $4',
                    [nroUnico, conferenteCodigoInt, codProdutoInt, loteTratado]
                );

                // Verificar se a quantidade informada é igual à real (com tolerância de 0.001 para números de ponto flutuante)
                const acertou = Math.abs(quantidadeInformadaFloat - quantidadeReal) < 0.001;

                // Se não há registro, criar um novo
                if (tentativasResult.rows.length === 0) {
                    try {
                        // Inserir novo registro com lote específico
                        await db.query(
                            'INSERT INTO conferencia_tentativas (nunota, conferente_codigo, codprod, lote, tentativas, acerto, quantidade_informada, quantidade_real) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                            [nroUnico, conferenteCodigoInt, codProdutoInt, loteTratado, 1, acertou, quantidadeInformadaFloat, quantidadeReal]
                        );
                    } catch (dbError) {
                        console.error("Erro ao inserir na tabela conferencia_tentativas:", dbError);
                        
                        // Se for erro de duplicação, tente atualizar em vez de inserir
                        if (dbError.code === '23505') {
                            await db.query(
                                'UPDATE conferencia_tentativas SET tentativas = 1, acerto = $1, quantidade_informada = $2, quantidade_real = $3 WHERE nunota = $4 AND conferente_codigo = $5 AND codprod = $6 AND lote = $7',
                                [acertou, quantidadeInformadaFloat, quantidadeReal, nroUnico, conferenteCodigoInt, codProdutoInt, loteTratado]
                            );
                        } else {
                            throw dbError;
                        }
                    }
                    
                    return res.json({
                        acerto: acertou,
                        tentativas_restantes: acertou ? 0 : 1,
                        bloqueado: false,
                        quantidade_real: acertou ? quantidadeReal : null
                    });
                }
                // Se já existe registro
                else {
                    const tentativasAnteriores = tentativasResult.rows[0];
                    const tentativas = tentativasAnteriores.tentativas;
                    const acertoAnterior = tentativasAnteriores.acerto;

                    // Se já acertou anteriormente ou esgotou tentativas (2 por item)
                    if (acertoAnterior || tentativas >= 2) {
                        return res.json({
                            acerto: acertoAnterior,
                            tentativas_restantes: 0,
                            bloqueado: !acertoAnterior,
                            quantidade_real: quantidadeReal // Mostrar a quantidade real independente de acerto ou erro
                        });
                    }

                    // Nova tentativa
                    const novasTentativas = tentativas + 1;

                    // Atualizar registro
                    await db.query(
                        'UPDATE conferencia_tentativas SET tentativas = $1, acerto = $2, quantidade_informada = $3 WHERE nunota = $4 AND conferente_codigo = $5 AND codprod = $6 AND lote = $7',
                        [novasTentativas, acertou, quantidadeInformadaFloat, nroUnico, conferenteCodigoInt, codProdutoInt, loteTratado]
                    );

                    // Na segunda tentativa, mostrar a quantidade real independente do acerto
                    const mostrarQuantidadeReal = novasTentativas >= 2 || acertou;

                    return res.json({
                        acerto: acertou,
                        tentativas_restantes: acertou || novasTentativas >= 2 ? 0 : 2 - novasTentativas,
                        bloqueado: !acertou && novasTentativas >= 2,
                        quantidade_real: mostrarQuantidadeReal ? quantidadeReal : null
                    });
                }
            } else {
                return res.status(404).json({ error: 'Produto com este lote não encontrado neste pedido' });
            }
        } else {
            return res.status(500).json({ error: 'Erro ao processar a resposta da API do Sankhya' });
        }
    } catch (error) {
        console.error('Erro ao verificar quantidade:', error);
        return res.status(500).json({ error: 'Erro ao verificar quantidade', detalhes: error.message });
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
