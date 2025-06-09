// src/components/SeparatorDetailModal/SeparatorDetailModal.jsx
import React, { useEffect } from 'react';
import './SeparatorDetailModal.css';

const SeparatorDetailModal = ({ isOpen, separator, onClose }) => {
    // Efeito para fechar o modal com a tecla Escape
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]); // Depende de isOpen e onClose

    if (!isOpen || !separator) {
        return null;
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

    return (
        <div className="modal-overlay" onClick={onClose} aria-hidden={!isOpen}>
            <div className="modal-content" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose} aria-label="Fechar modal">×</button>
                <h3>Detalhes de {nome_separador || 'Separador'}</h3>

                <div className="modal-details-grid">
                    <div className="modal-detail-item">
                        <strong>Posição:</strong> <span>{posicao !== undefined ? posicao + 'º' : 'N/A'}</span>
                    </div>
                    <div className="modal-detail-item">
                        <strong>Ranking:</strong> <span>{ranking !== undefined ? ranking : 'N/A'}</span>
                    </div>
                    <div className="modal-detail-item">
                        <strong>Pontuação Total:</strong> <span>{pontuacao_total !== undefined ? pontuacao_total.toFixed(2) : 'N/A'}</span>
                    </div>
                    <div className="modal-detail-item">
                        <strong>Pontos Atrás:</strong> <span>{pontos_atras !== undefined ? pontos_atras.toFixed(2) : 'N/A'}</span>
                    </div>
                    <div className="modal-detail-item">
                        <strong>Pedidos:</strong> <span>{pedidos_internos !== undefined ? pedidos_internos : 'N/A'}</span>
                    </div>
                    <div className="modal-detail-item">
                        <strong>Volumes:</strong> <span>{volumes !== undefined ? volumes : 'N/A'}</span>
                    </div>
                    <div className="modal-detail-item">
                        <strong>Produtos:</strong> <span>{produtos !== undefined ? produtos : 'N/A'}</span>
                    </div>
                     <div className="modal-detail-item">
                        <strong>Erros Status 9:</strong> <span className="error-count">{erros_com_status_9 !== undefined ? erros_com_status_9 : 'N/A'}</span>
                    </div>
                </div>

                {/* Lista de Ordens Status 2 para este separador */}
                <div className="modal-ordens-status-2">
                    <h4>Ordens Status 2 ({ordens_status_2 && Array.isArray(ordens_status_2) ? ordens_status_2.length : 0})</h4>
                    {ordens_status_2 && Array.isArray(ordens_status_2) && ordens_status_2.length > 0 ? (
                        <ul className="nunota-list">
                            {ordens_status_2.map((nunota, index) => (
                                <li key={index} className="nunota-item">{nunota}</li>
                            ))}
                        </ul>
                    ) : (
                        <p>Nenhuma ordem com Status 2 para este separador.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SeparatorDetailModal;
