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
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState(null);

    const [popupAberto, setPopupAberto] = useState(false);
    const [produtoSelecionado, setProdutoSelecionado] = useState(null);
    const [motivoDivergencia, setMotivoDivergencia] = useState("");

    const fetchOrdem = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/detalhes/${nroUnico}`);
            setDetalhes(response.data.detalhes);
        } catch (error) {
            console.error("Erro ao buscar a ordem:", error);
        }
    };

    useEffect(() => {
        fetchOrdem();
        setLoading(false);
    }, [nroUnico]);

    const finalizarSeparacao = async () => {
        const separadorCodigo = localStorage.getItem("codsep");
        if (!separadorCodigo) {
            alert("Erro: Separador não encontrado no sistema.");
            return;
        }
        try {
            // Primeira ação: Finalizar a separação
            const response = await axios.put(`${import.meta.env.VITE_API_URL}/api/v1/separacao-finalizada/${nroUnico}`, { separadorCodigo });
            console.log("Resposta completa da API:", response.data); // Verifique a resposta completa
            
            // Verificando se a separação foi finalizada com sucesso
            if (response.data?.mensagem?.toLowerCase().includes("separação finalizada")) {
                alert("✅ Separação finalizada com sucesso!");
    
                // Segunda ação: Atualizar o histórico
                const historicoResponse = await axios.put(`${import.meta.env.VITE_API_URL}/api/v1/historico/${nroUnico}`);
                console.log("Resposta do histórico:", historicoResponse.data);
    
                if (historicoResponse.data?.mensagem?.toLowerCase().includes("histórico atualizado")) {
                   
                } else {
                    alert("❌ Erro ao atualizar o histórico.");
                }
    
                // Recarregar os detalhes da ordem
                await fetchOrdem();
                navigate(`/lista`);
            } else {
                alert("❌ Erro ao finalizar separação. Recarregando pedidos...");
                await fetchOrdem();
            }
        } catch (error) {
            console.error("Erro ao finalizar separação:", error);
            alert("Erro ao finalizar separação.");
        }
    };
    
    const handleVoltar = () => navigate("/Home");

    const handleAbrirPopup = (produto) => {
        setProdutoSelecionado(produto);
        setPopupAberto(true);
    };

    const handleConfirmarDivergencia = async () => {
        if (!motivoDivergencia.trim()) {
            alert("Por favor, descreva o motivo da divergência.");
            return;
        }
        if (!produtoSelecionado || !produtoSelecionado.sequencia) {
            alert("Erro: Sequência do produto não encontrada.");
            return;
        }
        const { sequencia } = produtoSelecionado;
        try {
            // Registrar a divergência
            const divergenciaResponse = await axios.put(`${import.meta.env.VITE_API_URL}/api/divergencia/${nroUnico}`, { motivoDivergencia });
            await axios.put(`${import.meta.env.VITE_API_URL}/api/divergenciainput/${nroUnico}/${sequencia}`, { motivoDivergencia });
        
            // Verificar se a divergência foi registrada com sucesso
            if (divergenciaResponse.status === 200) {
                console.log("Divergência registrada com sucesso!");
        
                // Atualizar o histórico se a divergência for bem-sucedida
                const historicoResponse = await axios.put(`${import.meta.env.VITE_API_URL}/api/v1/historico/${nroUnico}`);
                console.log("Resposta do histórico:", historicoResponse.data);
        
                if (historicoResponse.data?.mensagem?.toLowerCase().includes("histórico atualizado")) {
                    // Sucesso ao atualizar o histórico
                    console.log("Histórico atualizado com sucesso!");
                    setPopupAberto(false);
                    setMotivoDivergencia(""); // Limpar o motivo da divergência
                } else {
                    // Erro ao atualizar o histórico
                    alert("❌ Erro ao atualizar o histórico.");
                }
            } else {
                // Erro ao registrar a divergência
                alert("❌ Erro ao registrar a divergência.");
            }
        } catch (error) {
            console.error("Erro ao registrar a divergência:", error);
            alert("Erro ao registrar a divergência. Tente novamente.");
        }
    };

    const handleCancelarDivergencia = () => {
        setPopupAberto(false);
        setMotivoDivergencia("");
    };

    if (loading) return <div className="loading-spinner">Carregando...</div>;
    if (erro) return <p className="error-message">{erro}</p>;

    return (
        <>
            <Header />
            <div className="detalhes-pedido-container">
                <h2 className="title">Detalhes do Pedido</h2>
                <p className="nro-unico">Nro Único: {nroUnico}</p>
                <div className="produto-list-container">
                    {detalhes.length > 0 ? (
                        detalhes.map((item, index) => (
                            <ProdutoCard key={index} item={item} nroUnico={nroUnico} onAbrirPopup={handleAbrirPopup} />
                        ))
                    ) : (
                        <div className="no-details-message">Nenhum detalhe encontrado.</div>
                    )}
                </div>
                <div className="botoes-container">
                    <button className="botao finalizar" onClick={finalizarSeparacao}>Finalizar Separação</button>
                    <button className="botao voltar" onClick={handleVoltar}>❌ Voltar</button>
                </div>
            </div>
            <PopupDivergencia isOpen={popupAberto} motivoDivergencia={motivoDivergencia} setMotivoDivergencia={setMotivoDivergencia} onConfirmar={handleConfirmarDivergencia} onCancelar={handleCancelarDivergencia} />
        </>
    );
};

export default DetalhesPedido;
