import React, { useState } from "react";
import "./produtoCard.css";

const ProdutoCard = ({ item, onAbrirPopup, observacaoGeral, permitirDivergencia = false }) => {
  const [selecionado, setSelecionado] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  // Verificar se o item está com status de devolução (AD_CODIGO = 9)
  const isDevolvido = item.AD_CODIGO === 9 || item.AD_CODIGO === "9";

  const mostrarMensagem = (texto, tipo = "info") => {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem(null), 3000);
  };

  const handleCheckboxChange = () => {
    setSelecionado(!selecionado);
   
    if (!selecionado) {
      mostrarMensagem("Produto selecionado com sucesso", "sucesso");
    }
  };

  const handleAbrirPopup = () => {
    if (onAbrirPopup) {
      onAbrirPopup(item);
    } else {
      mostrarMensagem("Não foi possível registrar divergência", "erro");
    }
  };

  // Função para determinar o prefixo da divergência com base no código de erro
    const getDivergenciaPrefix = (errorCode) => {
   
    const code = String(errorCode || '').replace(/^0+/, ''); 
    switch (code) {
      case "1": 
        return "Faltou";
      case "2": 
        return "Sobrou:";
      case "3": // Alterado de "03"
        return "Lote Errado:";
      default:
        
        return "Divergência:";
    }
  };


  // ESTA LINHA ESTÁ ATIVA PARA DEPURARMOS OS DADOS RECEBIDOS
  console.log("Dados do item no ProdutoCard:", item);

  return (
    <div className={`produto-card ${selecionado ? 'selecionado' : ''} ${isDevolvido ? 'devolvido' : ''}`}>
      {/* Notificação inline */}
      {mensagem && (
        <div className={`produto-mensagem ${mensagem.tipo}`}>
          <span className="mensagem-icone">
            {mensagem.tipo === "sucesso" ? "✓" :
             mensagem.tipo === "erro" ? "✕" : "ℹ️"}
          </span>
          <span className="mensagem-texto">{mensagem.texto}</span>
          <button className="mensagem-fechar" onClick={() => setMensagem(null)}>×</button>
        </div>
      )}

      {/* Badge de devolvido quando AD_CODIGO = 9 */}
      {isDevolvido && (
        <div className="badge-devolvido">Produto Devolvido</div>
      )}

      <div className="produto-header">
        <div className="codigo-container">
          <span className="produto-codigo-label">Código</span>
          <span className="produto-codigo-value">{item.Codigo_Produto}</span>
        </div>
        <div className={`produto-status ${item.Controlado === 'Sim' ? 'controlado' : ''}`}>
          {item.Controlado === 'Sim' ? 'Controlado' : 'Normal'}
        </div>
      </div>

      <div className="produto-descricao">
        <span className="descricao-label">Descrição</span>
        <span className="descricao-valor">{item.Descricao_Produto}</span>
      </div>
       {isDevolvido && item.AD_OBSCONF && (
          <div className="produto-row observacao-row">
            {/* Usa a função para obter o prefixo correto com base em AD_LISTERR e o torna negrito */}
            <span className="produto-label">
                {/* Aqui chamamos a função que traduz AD_LISTERR para o prefixo */}
                <strong>Descrição do erro:</strong>
            </span>
            {/* Aqui exibimos o texto da observação */}
            <span className="produto-value observacao"> {getDivergenciaPrefix(item.AD_LISTERR)}  {item.AD_OBSCONF}</span>
          </div>
        )}


      <div className="produto-grid">
        <div className="produto-row">
          <span className="produto-label">Marca:</span>
          <span className="produto-value">{item.Marca}</span>
        </div>
        <div className="produto-row">
          <span className="produto-label">Unidade:</span>
          <span className="produto-value">{item.Uni}</span>
        </div>
        <div className="produto-row">
          <span className="produto-label">Lote:</span>
          <span className="produto-value">{item.Lote}</span>
        </div>
        <div className="produto-row">
          <span className="produto-label">Quantidade:</span>
          <span className="produto-value">{Number(item.Quantidade).toLocaleString("pt-BR")}</span>
        </div>
        <div className="produto-row destaque-row">
          <span className="produto-label">Localização:</span>
          <span className="produto-value destaque">{item.Localizacao}</span>
        </div>
        <div className="produto-row">
          <span className="produto-label">Armazenagem:</span>
          <span className="produto-value">{item.Armazenagem}</span>
        </div>
        <div className="produto-row">
          <span className="produto-label">Controlado:</span>
          <span className="produto-value">{item.Controlado}</span>
        </div>

      </div>

      <div className="produto-acoes">
        <div className="produto-checkbox">
          <label className="checkbox-container">
            <input
              type="checkbox"
              checked={selecionado}
              onChange={handleCheckboxChange}
              disabled={isDevolvido && !permitirDivergencia} 
            />
            <span className="checkmark"></span>
            <span className="checkbox-text">Produto Separado</span>
          </label>
        </div>
        <div></div> {/* Espaço flexível */}
        <div>
          <button
            className="botao divergencia"
            onClick={handleAbrirPopup}
            // Nunca desabilitar o botão de divergência, mesmo para itens devolvidos
          >
            <span className="btn-icon">⚠️</span>
            <span className="btn-text">Divergência</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProdutoCard;
