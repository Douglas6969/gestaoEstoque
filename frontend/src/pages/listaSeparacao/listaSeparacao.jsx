import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import OrdemCard from "../../components/OrdemCard/OrdemCard";
import Header from "../../components/Header/Header";
import "./listaseparacao.css";

const ListaSeparacao = () => {
  const [ordemAtual, setOrdemAtual] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [notificacao, setNotificacao] = useState(null);
  const [atualizandoSilenciosamente, setAtualizandoSilenciosamente] = useState(false);
  const ordemAnteriorRef = useRef(null);
  const navigate = useNavigate();

  // Função para mostrar notificações temporárias
  const mostrarNotificacao = (mensagem, tipo) => {
    setNotificacao({ mensagem, tipo });
    setTimeout(() => setNotificacao(null), 5000);
  };

  const fetchOrdem = async (silencioso = false) => {
    try {
      if (!silencioso) {
        setLoading(true);
      } else {
        setAtualizandoSilenciosamente(true);
      }
      const separadorCodigo = localStorage.getItem("codsep");
      
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/v1/ordem-carga/${separadorCodigo}`);
      const ordensDisponiveis = response.data.ordens?.filter(
        (ordem) => ordem.Status === "Liberado para Separação"
      ) || [];
      
      const novaOrdem = ordensDisponiveis[0] || null;
      
      // Só atualiza o estado se a ordem for diferente da anterior para evitar re-renderizações
      if (JSON.stringify(novaOrdem) !== JSON.stringify(ordemAnteriorRef.current)) {
        ordemAnteriorRef.current = novaOrdem;
        setOrdemAtual(novaOrdem);
      }
      
      setErro(null);
    } catch (error) {
      console.error("Erro ao buscar ordens:", error);
      if (!silencioso) {
        setErro("Não foi possível carregar pedidos no momento. Tente novamente mais tarde.");
      }
    } finally {
      if (!silencioso) {
        setLoading(false);
      } else {
        setAtualizandoSilenciosamente(false);
      }
    }
  };

  useEffect(() => {
    fetchOrdem(); // Busca inicial
    
    // Atualiza silenciosamente a cada 5 segundos (intervalo maior para evitar problemas)
    const interval = setInterval(() => fetchOrdem(true), 5000);
    
    // Cleanup do intervalo ao desmontar o componente
    return () => clearInterval(interval);
  }, []);

  // ADICIONADAS AS FUNÇÕES QUE ESTAVAM FALTANDO
  const iniciarConferencia = async (nroUnico) => {
    const separadorCodigo = localStorage.getItem("codsep");
    
    if (!separadorCodigo) {
      mostrarNotificacao("Separador não encontrado no sistema. Por favor, faça login novamente.", "erro");
      return;
    }
    
    if (ordemAtual.Status !== "Liberado para Separação") {
      mostrarNotificacao("Esta ordem não está mais disponível para separação.", "aviso");
      fetchOrdem();
      return;
    }
    
    setLoading(true);
    
    try {
      // Verificação do separador
      const verificacaoResponse = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/v1/verificar-separacao/${separadorCodigo}`
      );
      
      // Se a verificação for bem-sucedida, continua com o processo
      if (verificacaoResponse.status === 200) {
        try {
          const response = await axios.put(
            `${import.meta.env.VITE_API_URL}/api/v1/ordem-carga/iniciar-conferencia/${nroUnico}`,
            { separadorCodigo }
          );
          
          if (response.data?.mensagem?.includes("Status do pedido")) {
            await axios.put(
              `${import.meta.env.VITE_API_URL}/api/v1/imprimir/${nroUnico}/${separadorCodigo}`,
              { separadorCodigo }
            );
            fetchOrdem();
            navigate(`/detalhes/${nroUnico}/${separadorCodigo}`);
          } else {
            mostrarNotificacao("Pedido já iniciado por outro separador.", "aviso");
            fetchOrdem();
          }
        } catch (innerError) {
          console.error("Erro ao iniciar separação:", innerError);
          mostrarNotificacao("Erro ao iniciar a separação. Tente novamente mais tarde.", "erro");
        }
      } else {
        mostrarNotificacao("Você já possui pedidos em aberto. Finalize-os antes de iniciar um novo.", "aviso");
        fetchOrdem();
      }
    } catch (outerError) {
      console.error("Erro ao verificar separação:", outerError);
      mostrarNotificacao("Não foi possível verificar se você pode iniciar a separação. Verifique se não há pedidos em aberto.", "erro");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarDivergencia = async (dadosDivergencia) => {
    if (!dadosDivergencia.nroUnico || !dadosDivergencia.codigoProduto) {
      mostrarNotificacao("Número único ou código do produto está faltando!", "erro");
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/v1/divergenciainput/${dadosDivergencia.nroUnico}/${dadosDivergencia.codigoProduto}`,
        {
          quantidade: dadosDivergencia.quantidade,
          motivoDivergencia: dadosDivergencia.motivoDivergencia,
        }
      );
      
      if (response.data?.status === "sucesso") {
        mostrarNotificacao("Divergência registrada com sucesso!", "sucesso");
      } else {
        mostrarNotificacao("Não foi possível registrar a divergência.", "erro");
      }
    } catch (error) {
      console.error("Erro ao registrar divergência:", error);
      mostrarNotificacao("Erro ao registrar divergência. Verifique os dados e tente novamente.", "erro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <Header />
      <main className="main-content">
        <div className="dashboard-header">
          <div className="page-title-container">
            <h1 className="page-title">Pedido de Separação</h1>
            <div className="title-decoration"></div>
          </div>
        </div>
        
        {/* Sistema de notificação */}
        {notificacao && (
          <div className={`notificacao ${notificacao.tipo}`}>
            <div className="notificacao-icon">
              {notificacao.tipo === 'sucesso' ? '✓' : notificacao.tipo === 'erro' ? '✕' : '⚠️'}
            </div>
            <p className="notificacao-mensagem">{notificacao.mensagem}</p>
            <button className="notificacao-fechar" onClick={() => setNotificacao(null)}>×</button>
          </div>
        )}
        
        {/* Estado de carregamento - apenas mostrado no carregamento inicial */}
        {loading ? (
          <div className="loading-container">
            <div className="loading-animation">
              <div className="loading-circle"></div>
              <div className="loading-circle"></div>
              <div className="loading-circle"></div>
            </div>
            <p className="loading-text">Buscando pedidos disponíveis...</p>
          </div>
        ) : erro ? (
          /* Estado de erro */
          <div className="error-container">
            <div className="error-icon">!</div>
            <p className="error-message">{erro}</p>
            <button className="retry-button" onClick={() => fetchOrdem()}>
              Tentar novamente
            </button>
          </div>
        ) : ordemAtual ? (
          /* Pedido disponível */
          <div className="ordem-container">
            {/* Não mostrar indicador de atualização para evitar piscar */}
            <OrdemCard
              ordem={ordemAtual}
              iniciarConferencia={iniciarConferencia}
              onConfirmarDivergencia={handleConfirmarDivergencia}
            />
          </div>
        ) : (
          /* Nenhum pedido disponível */
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p className="empty-text">Nenhum pedido disponível no momento</p>
            <p className="empty-subtext">Novos pedidos aparecerão automaticamente quando disponíveis</p>
            <div className="pulse-animation"></div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ListaSeparacao;
