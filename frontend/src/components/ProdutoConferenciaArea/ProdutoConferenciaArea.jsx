// src/components/ProdutoConferenciaArea/ProdutoConferenciaArea.jsx
import React from 'react';
import './ProdutoConferenciaArea.css'; // Crie este arquivo CSS

const ProdutoConferenciaArea = ({
  produtoSelecionado,
  quantidade,
  setQuantidade,
  onVerificarQuantidade,
  onKeyDown
}) => {
  if (!produtoSelecionado) {
    return (
      <div className="selecione-produto-container">
        <div className="selecione-produto-mensagem">
          <div className="selecione-icon">👈</div>
          <h3 className="selecione-texto">Selecione um produto</h3>
          <p className="selecione-subtexto">Escolha um item da lista à esquerda para iniciar a conferência</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="painel-header">
        <h2 className="painel-title">Conferindo produto</h2>
      </div>
      <div className="produto-conferencia">
        <div className="produto-header">
          <span className="produto-codigo-badge">{produtoSelecionado.Codigo_Produto}</span>
          {produtoSelecionado.Controlado === 'Sim' && (
            <span className="produto-controlado-badge">Controlado</span>
          )}
        </div>
        <h3 className="produto-descricao">{produtoSelecionado.Descricao_Produto}</h3>
        <div className="produto-detalhes">
          <div className="detalhes-grupo">
            <div className="detalhe-item">
              <span className="detalhe-label">Marca:</span>
              <span className="detalhe-valor">{produtoSelecionado.Marca || 'N/A'}</span>
            </div>
            <div className="detalhe-item">
              <span className="detalhe-label">Unidade:</span>
              <span className="detalhe-valor">{produtoSelecionado.Uni}</span>
            </div>
          </div>
          <div className="detalhes-grupo">
            <div className="detalhe-item">
              <span className="detalhe-label">Lote:</span>
              <span className="detalhe-valor">{produtoSelecionado.Lote || 'N/A'}</span>
            </div>
            <div className="detalhe-item">
              <span className="detalhe-label">Localização:</span>
              <span className="detalhe-valor destaque">{produtoSelecionado.Localizacao || 'N/A'}</span>
            </div>
          </div>
        </div>
        <div className="quantidade-container">
          <div className="quantidade-header">
            <label className="quantidade-label">Digite a quantidade encontrada:</label>
            <div className="quantidade-dica">Informe a quantidade exata conforme contagem</div>
          </div>
          <div className="quantidade-input-group">
            <input
              type="text"
              className="quantidade-input"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="0,00"
              autoFocus
            />
            <span className="unidade-badge">{produtoSelecionado.Uni}</span>
          </div>
          <button
            className="confirmar-button no-loading"
            onClick={onVerificarQuantidade}
          >
            Confirmar
          </button>
        </div>
      </div>
    </>
  );
};

export default ProdutoConferenciaArea;
