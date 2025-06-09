// src/components/GlobalListModal/GlobalListModal.jsx
import React, { useEffect } from 'react';
import './GlobalListModal.css';

const GlobalListModal = ({ isOpen, title, list, onClose }) => {
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


    if (!isOpen) {
        return null;
    }

    return (
        <div className="modal-overlay" onClick={onClose} aria-hidden={!isOpen}>
            <div className="modal-content" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose} aria-label="Fechar modal">×</button>
                {/* Título do modal global (ex: "Ordens Status 1 (Aguardando Separação)") */}
                <h3>{title || 'Lista de Ordens'} ({list && Array.isArray(list) ? list.length : 0})</h3>

                {/* Lista de NUNOTAs */}
                {list && Array.isArray(list) && list.length > 0 ? (
                    <ul className="nunota-list modal-global-list">
                        {list.map((nunota, index) => (
                            <li key={index} className="nunota-item">{nunota}</li>
                        ))}
                    </ul>
                ) : (
                    <p>Nenhuma ordem encontrada para este status.</p>
                )}
            </div>
        </div>
    );
};

export default GlobalListModal;
