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
            const response = await axios.get(`http://10.10.10.33:5000/api/detalhes/${nroUnico}`);
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
            const response = await axios.put(`http://10.10.10.33:5000/api/v1/separacao-finalizada/${nroUnico}`, { separadorCodigo });
            console.log("Resposta completa da API:", response.data); // Verifique a resposta completa
            
            // Verificando se a mensagem contém "separação"
            if (response.data?.mensagem?.includes("separação")) {
                alert("✅ Separação finalizada com sucesso!");
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
            await axios.put(`http://10.10.10.33:5000/api/divergencia/${nroUnico}`, { motivoDivergencia });
            await axios.put(`http://10.10.10.33:5000/api/divergenciainput/${nroUnico}/${sequencia}`, { motivoDivergencia });
            console.log("Divergência registrada com sucesso!");
            setPopupAberto(false);
            setMotivoDivergencia("");
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
