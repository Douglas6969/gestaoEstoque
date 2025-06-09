// controllers/salvarVolumesExpedicao.controller.js
import axios from 'axios';
import { db } from '../../database/connection.database.js'; // Assumindo que o caminho está correto
import dotenv from 'dotenv';
// Importe a função getBearerToken. Certifique-se de que o caminho está correto.
// Esta função é responsável por obter o token de autenticação para o usuário especificado.
import { getBearerToken } from '../auth.controller.js'; // Assumindo que o caminho está correto

dotenv.config();

// Controlador para salvar volumes de expedição na tabela AD_VOLEXP
// AGORA ESPERA no corpo da requisição um ARRAY de objetos como:
// [ { "volume": 1, "quantidade": 5 }, { "volume": 2, "quantidade": 3 }, ... ]
// onde "volume" é o número sequencial da caixa física e "quantidade" é a qtde de itens nela.
// Aceita também um array vazio [] no corpo, neste caso, nenhuma operação é feita na Sankhya.
export const salvarVolumesExpedicao = async (req, res) => {
    const { codigoConferente, nunota } = req.params;
    // Pega o ARRAY de volumes do corpo da requisição
    const volumesData = req.body; // Agora espera um ARRAY: [{ volume: number, quantidade: number }, ...]

    console.log("📦 Recebida requisição para salvar volumes:", { codigoConferente, nunota, body: volumesData });

    try {
        // 1. Validação dos parâmetros da URL
        if (!codigoConferente) {
            return res.status(400).json({ erro: 'Parâmetro codigoConferente é obrigatório na URL.' });
        }
        const codigoConferenteInt = parseInt(codigoConferente, 10);
        if (isNaN(codigoConferenteInt)) {
            return res.status(400).json({ erro: 'Código do conferente inválido na URL.' });
        }

        if (!nunota) {
            return res.status(400).json({ erro: 'Parâmetro nunota é obrigatório na URL.' });
        }
        const nunotaInt = parseInt(nunota, 10);
        if (isNaN(nunotaInt)) {
            return res.status(400).json({ erro: 'Número único da nota (nunota) inválido na URL.' });
        }

        // 2. Validação do corpo da requisição
        // Verifica se o corpo é um array. Se não for, é um formato inválido (400).
        if (!Array.isArray(volumesData)) {
             console.log('Corpo da requisição não é um array. Retornando 400.');
             return res.status(400).json({
                 erro: "Corpo da requisição inválido.",
                 detalhe: `O corpo deve ser um array de objetos, como [ { "volume": 1, "quantidade": 5 }, ... ]. Dados recebidos: ${JSON.stringify(volumesData)}`
             });
        }

        // 3. Verifica se o array de volumes está vazio. Se estiver, não há nada para salvar.
        // Retorna sucesso (200 OK) sem chamar a API Sankhya.
        if (volumesData.length === 0) {
            console.log(`✅ Nenhum volume fornecido no corpo da requisição para o pedido ${nunotaInt}. Nenhuma operação na Sankhya.`);
            return res.json({
                mensagem: `Nenhum volume fornecido para o pedido ${nunotaInt}. Nenhuma operação de salvamento realizada.`,
                volumesProcessados: [] // Retorna array vazio para indicar que nada foi processado
            });
        }

        // 4. Se o array não está vazio, valida cada item dentro dele
        for (const item of volumesData) {
            if (item.volume === undefined || item.quantidade === undefined ||
                typeof item.volume !== 'number' || !Number.isInteger(item.volume) || item.volume <= 0 ||
                typeof item.quantidade !== 'number' || item.quantidade < 0
            ) {
                console.log('Dados de volume inválidos em um dos itens do array. Retornando 400.');
                return res.status(400).json({
                    erro: "Dados de volume inválidos em um dos itens do array.",
                    detalhe: `Cada item do array deve ser um objeto como { "volume": 1, "quantidade": 5 }. Verifique se 'volume' é um número inteiro positivo (> 0) e 'quantidade' é um número não negativo (>= 0). Item inválido encontrado: ${JSON.stringify(item)}`
                });
            }
        }

        // 5. Busca usuário pelo código do conferente para obter o ID
        // Esta etapa é necessária para obter o id_usuario que será usado para buscar o token.
        let id_usuario;
        try {
            const userResult = await db.query(
                'SELECT id_usuario FROM usuario WHERE codsep = $1',
                [codigoConferenteInt]
            );
            if (userResult.rows.length === 0) {
                console.log('Conferente não encontrado na base local. Retornando 404.');
                return res.status(404).json({ erro: "Conferente não encontrado na base local." });
            }
            id_usuario = userResult.rows[0].id_usuario;
            if (!id_usuario) {
                 console.log('Usuário encontrado via conferente, mas id_usuario é nulo/inválido. Retornando 404.');
                return res.status(404).json({ erro: 'Usuário não encontrado via conferente (ID nulo).' });
            }
            console.log('👤 ID do usuário obtido:', id_usuario);
        } catch (dbErr) {
            console.error('❌ Erro ao buscar usuário pelo conferente:', dbErr);
            return res.status(500).json({ erro: 'Erro ao buscar usuário pelo conferente', detalhes: dbErr.message });
        }

        // 6. Obtém o token de autenticação
        // Esta função (getBearerToken) deve ser responsável por gerar ou buscar um token
        // válido para o id_usuario obtido.
        const bearerToken = await getBearerToken(id_usuario);
        if (!bearerToken) {
             console.log('Token de autenticação não encontrado para o usuário. Retornando 500.');
            return res.status(500).json({
                erro: 'Token de autenticação não encontrado para o usuário.',
                detalhe: 'Não foi possível obter um token Bearer válido para o conferente.'
            });
        }
        console.log('🔑 Token Bearer obtido com sucesso.');

        // 7. Preparar os registros para enviar à API Sankhya (DatasetSP.save para AD_VOLEXP)
        // Mapeamos cada item do array recebido para um registro no array recordsParaSankhya
        const sankhyaFields = ["QUANTIDADE"]; // Campos que serão enviados nos 'values'
        const recordsParaSankhya = volumesData.map(item => ({
            pk: {
                NUNOTA: nunotaInt, // Usando o nunota parseado como inteiro
                VOLUME: item.volume // Usando o 'volume' de cada item do array
            },
            values: {
                "0": item.quantidade // Usando a 'quantidade' de cada item do array
            }
        }));

        // 8. Construir e enviar a requisição para a API Sankhya (DatasetSP.save)
        const sankhyaRequestBody = {
            serviceName: "DatasetSP.save",
            requestBody: {
                entityName: "AD_VOLEXP", // Tabela de Volume Expedição
                standAlone: false, // Geralmente false para operações transacionais
                fields: sankhyaFields, // Usando a lista de campos definida acima (["QUANTIDADE"])
                records: recordsParaSankhya // Agora pode conter múltiplos registros (um para cada volume no array)
            }
        };

        console.log("🔄 Enviando request para salvar Volumes (Sankhya):", JSON.stringify(sankhyaRequestBody, null, 2));

        const sankhyaResponse = await axios.post(
            "https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DatasetSP.save&outputType=json",
            sankhyaRequestBody,
            {
                headers: {
                    'Authorization': `Bearer ${bearerToken}`,
                    'Content-Type': 'application/json',
                    'appkey': process.env.SANKHYA_APPKEY // Certifique-se de que SANKHYA_APPKEY está nas suas variáveis de ambiente
                }
            }
        );

        // 9. Verificar a resposta da API Sankhya
        if (sankhyaResponse.data?.status !== "1") {
            console.error("❌ Erro na resposta da API Sankhya ao salvar volumes:", sankhyaResponse.data);
            const sankhyaErrorMessage = sankhyaResponse.data?.responseBody?.saveResponse?.entities?.entity?.statusMessage
                                         || sankhyaResponse.data?.statusMessage
                                         || 'Resposta de erro desconhecida do Sankhya';
            return res.status(400).json({ // Geralmente 400 para erros de negócio da API externa
                erro: "Erro ao registrar volumes de expedição na Sankhya.",
                motivo: sankhyaErrorMessage,
                detalhes: sankhyaResponse.data
            });
        }

        // 10. Finaliza OK
        console.log(`✅ ${recordsParaSankhya.length} Volume(s) físico(s) registrado(s) com sucesso para o pedido ${nunotaInt} na Sankhya.`);
        return res.json({
            mensagem: `${recordsParaSankhya.length} Volume(s) físico(s) registrado(s) com sucesso para o pedido ${nunotaInt}.`,
            volumesProcessados: recordsParaSankhya.map(rec => ({ numeroCaixaFisica: rec.pk.VOLUME, quantidadeItens: rec.values["0"] })) // Retorna os dados processados
        });

    } catch (error) {
        // 11. Tratamento de Erro Geral
        console.error("🔥 Erro geral ao salvar volumes de expedição:", error.response?.data || error.message || error);

        let detalhesErro = 'Erro interno no servidor';
        let statusCode = 500; // Padrão para erros internos

        if (axios.isAxiosError(error)) {
            detalhesErro = error.response?.data || error.message;
            // Se for um erro do Axios, podemos tentar usar o status code da resposta,
            // a menos que seja um erro de rede (request não enviada), que ainda seria 500.
             if (error.response) {
                statusCode = error.response.status;
             }
        } else if (error instanceof Error) {
            detalhesErro = error.message;
        } else {
            detalhesErro = String(error);
        }

        // Ajuste o status code se for um erro conhecido que não seja 500
        // Por exemplo, se a busca no DB falhar de uma forma específica, pode ser 500.
        // Mas se for um erro de validação não pego antes, talvez 400.
        // Aqui, tratamos erros gerais como 500, a menos que o erro do axios tenha um status code.

        return res.status(statusCode).json({
            erro: "Ocorreu um erro inesperado ao salvar os volumes de expedição.",
            detalhes: detalhesErro
        });
    }
};
