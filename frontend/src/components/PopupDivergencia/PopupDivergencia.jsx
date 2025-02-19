import React from "react";
import './PopupDivergencia.css';

const PopupDivergencia = ({ isOpen, motivoDivergencia, setMotivoDivergencia, onConfirmar, onCancelar }) => {
  if (!isOpen) return null;

  return (
    <div className="popup-overlay">
      <div className="popup-divergencia-container">
        <h3>Registrar Divergência</h3>
        <textarea
          placeholder="Descreva o motivo da divergência..."
          value={motivoDivergencia}
          onChange={(e) => setMotivoDivergencia(e.target.value)}
        />
        <div className="popup-divergencia-buttons">
          <button className="botao confirmar" onClick={onConfirmar}>
            ✅ Confirmar
          </button>
          <button className="botao cancelar" onClick={onCancelar}>
            ❌ Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PopupDivergencia;
