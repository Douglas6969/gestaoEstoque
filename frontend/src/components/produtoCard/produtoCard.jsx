import React, { useState } from "react";
import "./ProdutoCard.css";

const ProdutoCard = ({ item, onAbrirPopup }) => {
  const [selecionado, setSelecionado] = useState(false);

  const handleCheckboxChange = () => {
    setSelecionado(!selecionado);
  };

  const handleAbrirPopup = () => {
    if (onAbrirPopup) {
      onAbrirPopup(item); // Passa o item selecionado para o componente pai
    }
  };

  return (
    <div className={`produto-card ${selecionado ? 'selecionado' : ''}`}>
      <div className="produto-row">
        <span className="produto-label">Código:</span>
        <span className="produto-value">{item.Codigo_Produto}</span>
      </div>
      <div className="produto-row">
        <span className="produto-label">Descrição:</span>
        <span className="produto-value">{item.Descricao_Produto}</span>
      </div>
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
        <span className="produto-value">{item.Quantidade}</span>
      </div>
      <div className="produto-row">
        <span className="produto-label">Localização:</span>
        <span className="produto-value">{item.Localizacao}</span>
      </div>
      

      {/* Checkbox para selecionar o produto */}
      <div className="produto-checkbox">
        <label>
          <input
            type="checkbox"
            checked={selecionado}
            onChange={handleCheckboxChange}
          />
          Selecionar
        </label>
      </div>

      {/* Botão para abrir o popup de divergência */}
      <button 
        className="botao divergencia" 
        onClick={handleAbrirPopup} 
        style={{ marginLeft: 'auto' }}
      >
        Divergência Encontrada
      </button>
    </div>
  );
};

export default ProdutoCard;
