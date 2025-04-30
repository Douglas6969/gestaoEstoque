import React, { useState } from "react";
import { Popover, OverlayTrigger, Tooltip } from "react-bootstrap";
import { Link } from "react-router-dom"; // Importando Link para navegação
import "./OrdemCard.css";
import "bootstrap/dist/css/bootstrap.min.css";

const OrdemCard = ({ ordem, iniciarConferencia }) => {
  const [notificacao, setNotificacao] = useState(null);

  // Sistema de notificação inline (em vez de alerts)
  const mostrarNotificacao = (mensagem, tipo = "info") => {
    setNotificacao({ mensagem, tipo });
    setTimeout(() => setNotificacao(null), 5000);
  };

  const motivoPopover = (
    <Popover id="popover-basic" className="motivo-popover">
      <Popover.Header as="h3">Motivo da Divergência</Popover.Header>
      <Popover.Body>{ordem?.Motivo || "Não há detalhes disponíveis sobre o motivo."}</Popover.Body>
    </Popover>
  );

  const handleIniciarConferencia = () => {
    const codsep = localStorage.getItem("codsep");
    if (codsep) {
      iniciarConferencia(ordem.Nro_Unico);
    } else {
      mostrarNotificacao("Separador não encontrado. Por favor, faça login novamente.", "erro");
    }
  };

  // Verificar se pode iniciar a conferência
  const podeIniciarConferencia = ordem?.Status === "Liberado para Separação";
  
  // Verificar se pode ver o pedido de acordo com os status
  const podeVerPedido = ["Separação Iniciada", "Divergência Encontrada", "Conferencia Iniciada"].includes(
    ordem?.Status?.trim()
  );

  // Determinar a URL para o botão "Ver Pedido" baseado no status
  const getPedidoUrl = () => {
    const conferenteCodigo = localStorage.getItem("codsep") || "0";
    
    if (ordem?.Status?.trim() === "Conferencia Iniciada") {
      return `/conferencia/${ordem.Nro_Unico}/${conferenteCodigo}`;
    } else {
      return `/detalhes/${ordem.Nro_Unico}`;
    }
  };

  return (
    <div className="ordem-card">
      {/* Notificação inline */}
      {notificacao && (
        <div className={`notificacao-card ${notificacao.tipo}`}>
          <div className="notificacao-icon">
            {notificacao.tipo === "sucesso" ? "✓" : notificacao.tipo === "erro" ? "✕" : "ℹ️"}
          </div>
          <p className="notificacao-mensagem">{notificacao.mensagem}</p>
          <button className="notificacao-fechar" onClick={() => setNotificacao(null)}>×</button>
        </div>
      )}
      <div className="ordem-header">
        <div className="ordem-numero">#{ordem?.Nro_Unico}</div>
        <div className={`ordem-status-badge ${ordem?.Status?.toLowerCase().replace(/\s+/g, '-')}`}>
          {ordem?.Status || "Sem status"}
        </div>
      </div>
      <div className="ordem-content">
        <div className="ordem-info-grid">
          {[
            { label: "Cliente", value: ordem?.Cliente, icon: "👤" },
            { label: "Prioridade", value: ordem?.Des_Prioridade, icon: "🔔" },
            { label: "Qtd. Volumes", value: ordem?.Qtd_Vol, icon: "📦" },
            { label: "Data Pedido", value: ordem?.Data, icon: "📅" },
            { label: "Ordem", value: ordem?.Ordem || "Sem ordem", icon: "⏱️" },
            { label: "Usuario", value: ordem?.Nome_Separador, icon: "👷" },
          ].map((item, index) => (
            <div className="ordem-info-item" key={index}>
              <div className="ordem-info-icon">{item.icon}</div>
              <div className="ordem-info-content">
                <span className="ordem-info-label">{item.label}</span>
                <span className="ordem-info-value">{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="ordem-actions">
        {ordem?.Motivo && (
          <OverlayTrigger
            trigger="click"
            placement="top"
            overlay={motivoPopover}
            rootClose
          >
            <button className="ordem-btn motivo-btn">
              <span className="btn-icon">⚠️</span>
              <span className="btn-text">Ver Motivo</span>
            </button>
          </OverlayTrigger>
        )}
        {podeIniciarConferencia && (
          <button
            className="ordem-btn iniciar-btn"
            onClick={handleIniciarConferencia}
          >
            <span className="btn-icon">▶️</span>
            <span className="btn-text">Iniciar Separação</span>
          </button>
        )}
        {podeVerPedido && (
          <Link
            to={getPedidoUrl()}
            className="ordem-btn ver-btn"
          >
            <span className="btn-icon">👁️</span>
            <span className="btn-text">Ver Pedido</span>
          </Link>
        )}
      </div>
    </div>
  );
};

export default OrdemCard;
