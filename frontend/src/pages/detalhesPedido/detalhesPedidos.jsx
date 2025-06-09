import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import ProdutoCard from "../../components/produtoCard/produtoCard";
import Header from "../../components/Header/Header";
import PopupDivergencia from "../../components/PopupDivergencia/PopupDivergencia";
import "./detalhesPedido.css";

const DetalhesPedido = () => {
    const { nroUnico } = useParams();
    const navigate = useNavigate();
    const [detalhes, setDetalhes] = useState([]);
    const [observacaoGeral, setObservacaoGeral] = useState(null);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState(null);
    const [popupAberto, setPopupAberto] = useState(false);
    const [produtoSelecionado, setProdutoSelecionado] = useState(null);
    const [motivoDivergencia, setMotivoDivergencia] = useState("");
    const [notificacao, setNotificacao] = useState(null);
    const [statusPedido, setStatusPedido] = useState(null);

    // Sistema de notificação inline
    const mostrarNotificacao = (mensagem, tipo = "info") => {
        setNotificacao({ mensagem, tipo });
        // Remover a notificação após 5 segundos
        setTimeout(() => setNotificacao(null), 5000);
    };

    const fetchOrdem = async () => {
        const separadorCodigo = localStorage.getItem("codsep");
        try {
            setLoading(true);
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/v1/detalhes/${nroUnico}/${separadorCodigo}`);
            
            // Armazenar detalhes dos produtos
            setDetalhes(response.data.detalhes);
            
            // Armazenar a observação geral do pedido (se existir)
            if (response.data.observacaoGeral) {
                setObservacaoGeral(response.data.observacaoGeral);
            }
            
            // Armazenar o status do pedido (se existir)
            if (response.data.status) {
                setStatusPedido(response.data.status);
            } else if (response.data.detalhes && response.data.detalhes.length > 0) {
                // Alternativa: tentar obter o status do primeiro item se disponível
                const statusFromItem = response.data.detalhes[0].AD_CODIGO;
                if (statusFromItem) {
                    setStatusPedido(statusFromItem);
                }
            }
            
            setLoading(false);
        } catch (error) {
            console.error("Erro ao buscar a ordem:", error);
            setErro("Não foi possível carregar os detalhes do pedido. Por favor, tente novamente mais tarde.");
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrdem();
    }, [nroUnico]);

    const finalizarSeparacao = async () => {
        const separadorCodigo = localStorage.getItem("codsep");
        if (!separadorCodigo) {
            mostrarNotificacao("Separador não encontrado no sistema. Faça login novamente.", "erro");
            return;
        }

        // Verificar se estamos em modo de correção (status 9/erro)
        const isCorrecao = statusPedido === 9 || statusPedido === "9" || detalhes.some(item => item.AD_CODIGO === 9 || item.AD_CODIGO === "9");

        try {
            let response;
            
            if (isCorrecao) {
                // Usar a rota de retorno ao conferente para pedidos com erro/devolvidos
                response = await axios.post(`${import.meta.env.VITE_API_URL}/api/v2/retorno-conferente/${separadorCodigo}`, 
                    { nunota: nroUnico }
                );
                
                if (response.status === 200) {
                    mostrarNotificacao("Correção finalizada e pedido retornado ao conferente!", "sucesso");
                    
                    // Redirecionando após curto delay para mostrar a notificação
                    setTimeout(() => {
                        navigate(`/home`);
                    }, 1500);
                } else {
                    mostrarNotificacao("Erro ao retornar o pedido ao conferente. Tente novamente.", "erro");
                    await fetchOrdem(); // Recarrega dados
                }
            } else {
                // Fluxo normal para separação sem erros
                // Primeira ação: Finalizar a separação
                response = await axios.put(`${import.meta.env.VITE_API_URL}/api/v1/separacao-finalizada/${nroUnico}`, 
                    { separadorCodigo }
                );
                
                // Verificando se a separação foi finalizada com sucesso
                if (response.data?.mensagem?.toLowerCase().includes("separação finalizada")) {
                    mostrarNotificacao("Separação finalizada com sucesso!", "sucesso");
                    
                    // Segunda ação: Atualizar o histórico
                    try {
                        const historicoResponse = await axios.put(`${import.meta.env.VITE_API_URL}/api/v1/historico/${nroUnico}/${separadorCodigo}`);
                        
                        if (!historicoResponse.data?.mensagem?.toLowerCase().includes("histórico atualizado")) {
                            console.warn("Aviso: Histórico não foi atualizado corretamente");
                        }
                        
                        // Redirecionando após curto delay para mostrar a notificação
                        setTimeout(() => {
                            navigate(`/home`);
                        }, 1500);
                    } catch (historicoError) {
                        console.error("Erro ao atualizar histórico:", historicoError);
                        mostrarNotificacao("Separação finalizada, mas houve um erro ao atualizar o histórico.", "aviso");
                        
                        // Mesmo com erro no histórico, redireciona após delay
                        setTimeout(() => {
                            navigate(`/home`);
                        }, 2000);
                    }
                } else {
                    mostrarNotificacao("Erro ao finalizar separação. Tente novamente.", "erro");
                    await fetchOrdem(); // Recarrega dados
                }
            }
        } catch (error) {
            console.error("Erro ao processar o pedido:", error);
            mostrarNotificacao(
                isCorrecao 
                    ? "Erro ao retornar correção ao conferente. Verifique sua conexão." 
                    : "Erro ao finalizar separação. Verifique sua conexão.", 
                "erro"
            );
        }
    };

    const handleVoltar = () => navigate("/lista");

    const handleAbrirPopup = (produto) => {
        setProdutoSelecionado(produto);
        setPopupAberto(true);
    };

    const handleConfirmarDivergencia = async () => {
        if (!motivoDivergencia.trim()) {
            mostrarNotificacao("Por favor, descreva o motivo da divergência.", "aviso");
            return;
        }
        if (!produtoSelecionado || !produtoSelecionado.sequencia) {
            mostrarNotificacao("Erro: Dados do produto incompletos.", "erro");
            return;
        }
        const { sequencia } = produtoSelecionado;
        const separadorCodigo = localStorage.getItem("codsep");

        try {
            // Registrar a divergência
            const divergenciaResponse = await axios.put(
                `${import.meta.env.VITE_API_URL}/api/v1/divergencia/${nroUnico}`,
                { separadorCodigo, divergencia: motivoDivergencia }
            );
            await axios.put(
                `${import.meta.env.VITE_API_URL}/api/v1/divergenciainput/${nroUnico}/${sequencia}`,
                { motivoDivergencia, separadorCodigo }
            );

            // Verificar se a divergência foi registrada com sucesso
            if (divergenciaResponse.status === 200) {
                // Atualizar o histórico
                try {
                    const historicoResponse = await axios.put(`${import.meta.env.VITE_API_URL}/api/v1/historico/${nroUnico}/${separadorCodigo}`);
                    // Sucesso nas duas operações
                    mostrarNotificacao("Divergência registrada com sucesso!", "sucesso");
                    setPopupAberto(false);
                    setMotivoDivergencia(""); // Limpar o motivo da divergência
                    // Atualizar a lista após registro
                    await fetchOrdem();
                } catch (historicoError) {
                    console.error("Erro ao atualizar histórico:", historicoError);
                    mostrarNotificacao("Divergência registrada, mas houve um erro ao atualizar o histórico.", "aviso");
                    setPopupAberto(false);
                    setMotivoDivergencia("");
                }
            } else {
                mostrarNotificacao("Erro ao registrar a divergência. Tente novamente.", "erro");
            }
        } catch (error) {
            console.error("Erro ao registrar a divergência:", error);
            mostrarNotificacao("Falha na comunicação com o servidor. Verifique sua conexão.", "erro");
        }
    };

    const handleCancelarDivergencia = () => {
        setPopupAberto(false);
        setMotivoDivergencia("");
    };

    if (loading) {
        return (
            <>
                <Header />
                <div className="loading-spinner">Carregando detalhes do pedido...</div>
            </>
        );
    }

    if (erro) {
        return (
            <>
                <Header />
                <div className="error-message">
                    <div>❌ {erro}</div>
                    <button
                        className="botao voltar"
                        style={{ marginTop: '20px', maxWidth: '200px' }}
                        onClick={handleVoltar}
                    >
                        Voltar
                    </button>
                </div>
            </>
        );
    }

    // Verifica se algum dos itens tem AD_CODIGO = 9 (devolvido)
    const temItemDevolvido = detalhes.some(item => item.AD_CODIGO === 9 || item.AD_CODIGO === "9");
    // Determina se estamos em modo de correção
    const isModoCorrecao = statusPedido === 9 || statusPedido === "9" || temItemDevolvido;

    return (
        <>
            <Header />
            {/* Notificação inline */}
            {notificacao && (
                <div className={`notificacao-card ${notificacao.tipo}`}>
                    <div className="notificacao-icon">
                        {notificacao.tipo === "sucesso" ? "✓" :
                         notificacao.tipo === "erro" ? "✕" : "ℹ️"}
                    </div>
                    <p className="notificacao-mensagem">{notificacao.mensagem}</p>
                    <button className="notificacao-fechar" onClick={() => setNotificacao(null)}>×</button>
                </div>
            )}

            <div className="detalhes-pedido-container">
                <h2 className="title">
                    {isModoCorrecao ? "Correção de Pedido" : "Detalhes do Pedido"}
                </h2>
                <p className="nro-unico">Nro Único: {nroUnico}</p>
                
                {/* Observação Geral do Pedido - exibido quando existe */}
                {observacaoGeral && (
                    <div className="observacao-geral-container">
                        <h3 className="observacao-titulo">Observação do Conferente:</h3>
                        <p className="observacao-texto">{observacaoGeral}</p>
                    </div>
                )}
                
                {/* Alerta de devolução */}
                
                
                <div className="produto-list-container">
                    {detalhes.length > 0 ? (
                        detalhes.map((item, index) => (
                            <ProdutoCard
                                key={index}
                                item={item}
                                nroUnico={nroUnico}
                                onAbrirPopup={handleAbrirPopup}
                                observacaoGeral={observacaoGeral} 
                                permitirDivergencia={isModoCorrecao} // Permitir divergência em itens devolvidos quando em modo correção
                            />
                        ))
                    ) : (
                        <div className="no-details-message">
                            Nenhum produto encontrado para este pedido.
                        </div>
                    )}
                </div>
                
                <div className="botoes-container">
                    <button 
                        className={`botao ${isModoCorrecao ? 'correcao' : 'finalizar'}`} 
                        onClick={finalizarSeparacao}
                    >
                        <span>{isModoCorrecao ? "↩" : "✓"}</span> 
                        {isModoCorrecao ? "Finalizar Correção" : "Finalizar Separação"}
                    </button>
                    <button className="botao voltar" onClick={handleVoltar}>
                        <span>←</span> Voltar
                    </button>
                </div>
            </div>
            
            <PopupDivergencia
                isOpen={popupAberto}
                motivoDivergencia={motivoDivergencia}
                setMotivoDivergencia={setMotivoDivergencia}
                onConfirmar={handleConfirmarDivergencia}
                onCancelar={handleCancelarDivergencia}
            />
        </>
    );
};

export default DetalhesPedido;
