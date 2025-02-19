import axios from 'axios';
import { getBearerToken } from './auth.controller.js'; // Importando a função getBearerToken que busca o token do banco de dados

// Função para verificar se o separador pode pegar outra separação
export const verificarSePodeSeparar = async (req, res) => {
  try {
    // Pegando o token diretamente do banco de dados
    const token = await getBearerToken(); // Agora ele pega o token do banco, não do .env
    const appkey = process.env.SANKHYA_APPKEY; // AppKey
    const { separadorCodigo } = req.params; // Pegando o código do separador da URL

    console.log('Valor do separador recebido:', separadorCodigo);

    // Verificação de parâmetros
    if (!separadorCodigo || isNaN(parseInt(separadorCodigo, 10))) {
      return res.status(400).json({ error: "Código do separador inválido." });
    }

    // SQL para contar as ordens com AD_STATUSDACONFERENCIA = 7 (Conferência iniciada)
    const sqlQuery = `
      SELECT COUNT(CAB.NUNOTA) AS "Qtd_Ordens_Conferencia_Iniciada"
      FROM TGFCAB CAB
      WHERE CAB.AD_SEPARADORNEW = ${separadorCodigo} 
        AND CAB.AD_STATUSDACONFERENCIA = 7
    `;

    const requestBody = {
      serviceName: 'DbExplorerSP.executeQuery',
      requestBody: { sql: sqlQuery, parameters: { separadorCodigo: parseInt(separadorCodigo, 10) } }
    };

    // Faz a requisição para o Sankhya
    const response = await axios.post(
      'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json',
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${token}`, // Usando o token dinâmico
          'Content-Type': 'application/json',
          'appkey': appkey
        }
      }
    );

    // Verificando a resposta da API
    console.log('Resposta da API:', response.data);

    // Garantindo que a resposta tenha dados válidos e interpretando o formato correto
    if (response.data?.status === '1' && response.data.responseBody?.rows?.length > 0) {
      const rows = response.data.responseBody.rows;
      const qtdOrdens = rows[0][0]; // Modificado para pegar o valor correto dentro do array

      console.log('Quantidade de ordens em conferência iniciada:', qtdOrdens);

      // Verificando a lógica de separação
      if (qtdOrdens > 0) {
        // Se houver ao menos uma ordem com status 7 (Conferência Iniciada), bloqueia a separação
        return res.status(400).json({ error: 'Você não pode iniciar outra separação enquanto houver ordens em Conferência iniciada.' });
      } else {
        // Se não houver ordens em Conferência iniciada, permite iniciar uma nova separação
        return res.json({ message: 'Você pode iniciar uma nova separação.' });
      }
    } else {
      return res.status(500).json({ error: 'Erro ao processar a resposta da API, dados inválidos.' });
    }
  } catch (error) {
    console.error('Erro ao verificar separador:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Erro ao verificar separador', details: error.response?.data || error.message });
  }
};
