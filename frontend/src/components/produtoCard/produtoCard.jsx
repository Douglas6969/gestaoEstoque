import React, { useState } from "react";
import "./produtoCard.css";

const ProdutoCard = ({ item, onAbrirPopup }) => {
  const [selecionado, setSelecionado] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  
  // Sistema de notificação inline para o card
  const mostrarMensagem = (texto, tipo = "info") => {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem(null), 3000);
  };

  const handleCheckboxChange = () => {
    setSelecionado(!selecionado);
    
    // Feedback visual ao usuário
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

  return (
    <div className={`produto-card ${selecionado ? 'selecionado' : ''}`}>
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
            />
            <span className="checkmark"></span>
            <span className="checkbox-text">Produto Separado</span>
          </label>
        </div>
        
        <button
          className="botao divergencia"
          onClick={handleAbrirPopup}
        >
          <span className="btn-icon">⚠️</span>
          <span className="btn-text">Divergência</span>
        </button>
      </div>
    </div>
  );
};

export default ProdutoCard;
