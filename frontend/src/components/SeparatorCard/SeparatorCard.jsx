// src/components/SeparatorCard/SeparatorCard.jsx
import React from 'react';
import './SeparatorCard.css';

const SeparatorCard = ({ separator, onClick }) => {
    // Certifica-se de que separator e suas propriedades existem antes de acessar
    if (!separator) {
        return null; // Ou renderize um placeholder de erro/carregamento
    }

    const {
        posicao,
        ranking,
        nome_separador,
        pontuacao_total,
        pontos_atras,
        pedidos_internos,
        volumes,
        produtos,
        erros_com_status_9,
        ordens_status_2 // Lista de NUNOTAs para este separador
    } = separator;

    // Determina a classe do badge de posição
    const posicaoClass = posicao <= 3 ? `posicao-${posicao}` : 'posicao-outros';

    return (
        <div className="separator-card" onClick={onClick} title={`Clique para ver detalhes de ${nome_separador}`}>
            <div className="card-header">
                {/* Badge de Posição */}
                <div className={`posicao-badge ${posicaoClass}`}>
                    {posicao}º
                </div>
                {/* Nome do Separador */}
                <h3 className="separator-name">{nome_separador}</h3>
                {/* Pontuação Total */}
                <div className="total-score">
                    Pontuação Total: <span className="score-value">{pontuacao_total ? pontuacao_total.toFixed(2) : 'N/A'}</span>
                </div>
            </div>
            <div className="card-details">
                {/* Detalhes da Pontuação */}
                <div className="detail-item">
                    <strong>Ranking:</strong> <span>{ranking !== undefined ? ranking : 'N/A'}</span>
                </div>
                <div className="detail-item">
                    <strong>Pontos Atrás:</strong> <span>{pontos_atras !== undefined ? pontos_atras.toFixed(2) : 'N/A'}</span>
                </div>

                {/* Métricas de Produção */}
                <div className="metrics-section">
                    <h4>Métricas de Produção</h4> {/* Ícone pode ser adicionado via CSS ou um componente de ícone */}
                    <div className="metrics-grid">
                        <div className="metric-item">
                            <span>Pedidos:</span> <strong>{pedidos_internos !== undefined ? pedidos_internos : 'N/A'}</strong>
                        </div>
                        <div className="metric-item">
                            <span>Volumes:</span> <strong>{volumes !== undefined ? volumes : 'N/A'}</strong>
                        </div>
                        <div className="metric-item">
                            <span>Produtos:</span> <strong>{produtos !== undefined ? produtos : 'N/A'}</strong>
                        </div>
                    </div>
                </div>

                {/* Informações de Erros/Pendências */}
                <div className="errors-section">
                     <h4>Erros e Pendências</h4> {/* Ícone pode ser adicionado via CSS ou um componente de ícone */}
                    <div className="detail-item">
                        <strong>Erros Status 9:</strong> <span className="error-count">{erros_com_status_9 !== undefined ? erros_com_status_9 : 'N/A'}</span>
                    </div>
                     {/* A contagem de Status 2 no card individual NÃO abre o modal global */}
                     {/* A lista completa de ordens Status 2 para este separador individual será mostrada no modal de detalhes do separador */}
                    <div className="detail-item">
                        <strong>Ordens Status 2:</strong>
                        <span className="ordens-status-2-count">
                            {ordens_status_2 && Array.isArray(ordens_status_2) ? ordens_status_2.length : 0} ordem(ns)
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SeparatorCard;
