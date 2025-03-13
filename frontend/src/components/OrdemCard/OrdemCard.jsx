import React from "react";
import { Popover, OverlayTrigger } from "react-bootstrap";
import "./OrdemCard.css";
import "bootstrap/dist/css/bootstrap.min.css";

const OrdemCard = ({ ordem, iniciarConferencia }) => {
  const motivoPopover = (
    <Popover id="popover-basic">
      <Popover.Header as="h3">Motivo</Popover.Header>
      <Popover.Body>{ordem?.Motivo || "Sem motivo disponível"}</Popover.Body>
    </Popover>
  );

  const podeIniciarConferencia = ordem?.Status === "Liberado para Separação";
  const podeVerPedido = ["Separação Iniciada", "Divergência Encontrada"].includes(
    ordem?.Status?.trim()
  );

  return (
    <div className="ordem-card">
      {[
        { label: "Nº Único", value: ordem?.Nro_Unico },
        { label: "Status", value: ordem?.Status || "Sem status" },
        { label: "Prioridade", value: ordem?.Des_Prioridade },
        { label: "Cliente", value: ordem?.Cliente },
        { label: "Quantidade volumes", value: ordem?.Qtd_Vol },
        { label: "Data Pedido", value: ordem?.Data },
        { label: "Ordem", value: ordem?.Ordem || "Sem ordem disponível" },
        { label: "Separador", value: ordem?.Nome_Separador },
      ].map((item, index) => (
        <div className="ordem-detail" key={index}>
          <span className="ordem-title">{item.label}:</span>
          <span className="ordem-text">{item.value}</span>
        </div>
      ))}

      {ordem?.Motivo && (
        <div className="popover-container">
          <OverlayTrigger trigger="click" placement="bottom" overlay={motivoPopover} rootClose>
            <button className="popover-btn btn-danger">Ver Motivo</button>
          </OverlayTrigger>
        </div>
      )}

      {podeIniciarConferencia && (
        <button
          className="btn btn-success iniciar-conferencia"
          onClick={() => {
            const codsep = localStorage.getItem("codsep");
            if (codsep) {
              iniciarConferencia(ordem.Nro_Unico);
            } else {
              console.error("Erro: separador não encontrado no localStorage");
            }
          }}
        >
          Iniciar Separação
        </button>
      )}

      {podeVerPedido && (
        <div className="access-details-bottom">
          <a href={`http://10.10.10.33:5173/detalhes/${ordem.Nro_Unico}`} className="btn btn-primary">
            Ver Pedido
          </a>
        </div>
      )}
    </div>
  );
};

export default OrdemCard;
