import React, { useState, useEffect } from "react";
import axios from "axios";
import OrdemCard from "../../components/OrdemCard/OrdemCard";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header";
import "./PerfilUsuario.css";

const PerfilUsuario = () => {
  const [ordens, setOrdens] = useState([]);
  const [pontuacao, setPontuacao] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const codsep = localStorage.getItem("codsep");

  useEffect(() => {
    if (!codsep) {
      setError("Erro: Separador não encontrado.");
      navigate("/");
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Busca a pontuação primeiro para garantir que ela esteja disponível
        try {
          const pontuacaoResponse = await axios.get(
            `${import.meta.env.VITE_API_URL}/api/v1/perfil/score/${codsep}`
          );
          if (pontuacaoResponse.data?.pontuacoes && pontuacaoResponse.data.pontuacoes.length > 0) {
            const dadosSeparador = pontuacaoResponse.data.pontuacoes.find(
              (p) => p.separador_codigo == codsep
            );
            if (dadosSeparador) {
              setPontuacao({
                total: dadosSeparador.pontuacao_total || 0,
                pedidos: dadosSeparador.pedidos_internos || 0,
                volumes: dadosSeparador.volumes || 0,
                produtos: dadosSeparador.produtos || 0
              });
            }
          }
        } catch (pontuacaoError) {
          console.error("Erro ao carregar pontuação:", pontuacaoError);
          // Não tratamos como erro geral para permitir carregar os pedidos mesmo sem pontuação
          setPontuacao({ total: 0, pedidos: 0, volumes: 0, produtos: 0 });
        }

        // Busca os pedidos
        const ordensResponse = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/v1/perfil/${codsep}`
        );
        if (ordensResponse.data?.ordens) {
          setOrdens(ordensResponse.data.ordens);
          localStorage.setItem("temPedidos", "true");
        } else {
          setOrdens([]);
          localStorage.setItem("temPedidos", "false");
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        setError("Ocorreu um erro ao carregar os dados. Tente novamente mais tarde.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [codsep, navigate]);

  return (
    <div className="app-container">
      <Header />
      <main className="main-content">
        <div className="dashboard-header">
          <div className="page-title-container">
            <h1 className="page-title">Pedidos para separação</h1>
            <div className="title-decoration"></div>
          </div>
          {/* Pontuação sempre exibida quando disponível, independente se há pedidos ou não */}
          {pontuacao && (
            <div className="score-dashboard">
              <div className="score-card">
                <div className="score-header">
                  <span className="score-label">Pontuação do Mês</span>
                  <div className="score-value">{pontuacao.total}</div>
                </div>
                <div className="score-footer">pontos</div>
              </div>
            </div>
          )}
        </div>
        {error ? (
          <div className="error-container">
            <div className="error-icon">!</div>
            <p className="error-message">{error}</p>
          </div>
        ) : loading ? (
          <div className="loading-container">
            <div className="loading-animation">
              <div className="loading-circle"></div>
              <div className="loading-circle"></div>
              <div className="loading-circle"></div>
            </div>
            <p className="loading-text">Carregando pedidos...</p>
          </div>
        ) : (
          <>
            {ordens.length > 0 ? (
              <div className="pedidos-container">
                {ordens.map((ordem) => (
                  <OrdemCard key={ordem.Nro_Unico} ordem={ordem} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <p className="empty-text">Nenhum pedido de separação encontrado</p>
                <p className="empty-subtext">Novos pedidos aparecerão aqui quando disponíveis</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default PerfilUsuario;
