import React from 'react';
import './ConfirmLogoutModal.css'; // Crie um arquivo CSS para estilizar o modal

const ConfirmLogoutModal = ({ isOpen, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Confirmar Logout</h2>
                <p>Tem certeza que deseja sair?</p>
                <div className="modal-buttons">
                    <button className="modal-button confirm" onClick={onConfirm}>Sim</button>
                    <button className="modal-button cancel" onClick={onCancel}>Não</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmLogoutModal;
