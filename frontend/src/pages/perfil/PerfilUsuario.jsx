// PerfilUsuario.js - com layout melhorado para pontuação e posição
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
        
        // Buscar o ranking completo primeiro
        let rankingCompleto = [];
        try {
          const rankingResponse = await axios.get(
            `${import.meta.env.VITE_API_URL}/api/v1/perfil/ranking`
          );
          if (rankingResponse.data?.ranking) {
            rankingCompleto = rankingResponse.data.ranking;
          }
        } catch (rankingError) {
          console.error("Erro ao carregar ranking completo:", rankingError);
        }

        // Buscar pontuação do separador
        try {
          const pontuacaoResponse = await axios.get(
            `${import.meta.env.VITE_API_URL}/api/v1/perfil/score/${codsep}`
          );
          if (pontuacaoResponse.data?.pontuacoes && pontuacaoResponse.data.pontuacoes.length > 0) {
            const dadosSeparador = pontuacaoResponse.data.pontuacoes.find(
              (p) => p.separador_codigo == codsep
            );
            
            if (dadosSeparador) {
              // Dados básicos do separador
              const dadosPontuacao = {
                total: dadosSeparador.pontuacao_total || 0,
                pedidos: dadosSeparador.pedidos_internos || 0,
                volumes: dadosSeparador.volumes || 0,
                produtos: dadosSeparador.produtos || 0,
                ranking: dadosSeparador.ranking || 0,
                posicao: dadosSeparador.posicao || `${dadosSeparador.ranking}º lugar`,
                diferencaProximo: dadosSeparador.pontos_atras || 0
              };

              // Se temos o ranking completo, vamos calcular a diferença de pontos
              if (rankingCompleto.length > 0) {
                // Encontrar a posição do separador no ranking
                const myIndex = rankingCompleto.findIndex(item =>
                  item.separador_codigo == codsep
                );
                
                if (myIndex !== -1) {
                  const myRank = myIndex + 1;
                  dadosPontuacao.ranking = myRank; // Garantir que o ranking está correto
                  
                  // Definir o texto da posição
                  switch (myRank) {
                    case 1:
                      dadosPontuacao.posicao = "Primeiro lugar";
                      break;
                    case 2:
                      dadosPontuacao.posicao = "Segundo lugar";
                      break;
                    case 3:
                      dadosPontuacao.posicao = "Terceiro lugar";
                      break;
                    default:
                      dadosPontuacao.posicao = `${myRank}º lugar`;
                      break;
                  }
                  
                  // Para quem não é o primeiro, calculamos a diferença para o próximo colocado acima
                  if (myRank > 1) {
                    const pontuacaoAtual = rankingCompleto[myIndex].pontuacao_total;
                    const pontuacaoSuperior = rankingCompleto[myIndex - 1].pontuacao_total;
                    dadosPontuacao.diferencaProximo = pontuacaoSuperior - pontuacaoAtual;
                  }
                }
              }
              
              setPontuacao(dadosPontuacao);
            }
          }
        } catch (pontuacaoError) {
          console.error("Erro ao carregar pontuação:", pontuacaoError);
          setPontuacao({ 
            total: 0, 
            pedidos: 0, 
            volumes: 0, 
            produtos: 0, 
            ranking: 0, 
            posicao: "Sem classificação", 
            diferencaProximo: 0 
          });
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

  // Função para formatar o texto de diferença de pontos
  const getDiferencaText = () => {
    if (!pontuacao || pontuacao.ranking <= 1) return '';
    return `${pontuacao.diferencaProximo} pontos para alcançar o ${pontuacao.ranking - 1}º lugar`;
  };

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
              <div className={`score-card ${pontuacao.ranking === 1 ? 'first-place' : ''}`}>
                {pontuacao.ranking === 1 && (
                  <div className="crown-badge">
                    <span className="crown">👑</span>
                  </div>
                )}
                
                <div className="score-header">
                  <span className="score-label">Pontuação do Mês</span>
                  <div className="score-value">{pontuacao.total}</div>
                </div>
                
                <div className="ranking-info">
                  <div className="position-badge">
                    <span className="position-number">{pontuacao.ranking}</span>
                    <span className="position-text">{pontuacao.posicao}</span>
                  </div>
                </div>
                
                <div className="score-footer">
                  {pontuacao.ranking === 1 ? (
                    <span className="first-place-text">Líder do ranking!</span>
                  ) : (
                    <div className="points-difference-container">
                      <div className="points-difference-value">{pontuacao.diferencaProximo}</div>
                      <div className="points-difference-text">
                        <span>pontos para alcançar</span>
                        <span className="next-position">{pontuacao.ranking - 1}º lugar</span>
                      </div>
                    </div>
                  )}
                </div>
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
