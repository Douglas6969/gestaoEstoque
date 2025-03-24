import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import OrdemCard from "../../components/OrdemCard/OrdemCard";
import "./listaseparacao.css";
import Header from "../../components/Header/Header";

const ListaSeparacao = () => {
  const [ordemAtual, setOrdemAtual] = useState(null);
  const navigate = useNavigate();

  const fetchOrdem = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/v1/ordem-carga`);
      const ordensDisponiveis = response.data.ordens?.filter((ordem) => ordem.Status === "Liberado para Separação") || [];
      setOrdemAtual(ordensDisponiveis[0] || null);
    } catch (error) {
      console.error("Erro ao buscar ordens:", error);
      alert("Erro ao buscar ordens.");
    }
  };

  useEffect(() => {
    fetchOrdem(); // Busca inicial

    // Atualiza a cada 5 segundos
    const interval = setInterval(fetchOrdem, 5000);

    // Cleanup do intervalo ao desmontar o componente
    return () => clearInterval(interval);
  }, []);

  
  const iniciarConferencia = async (nroUnico) => {
    const separadorCodigo = localStorage.getItem("codsep");
  
    if (!separadorCodigo) {
      alert("Erro: Separador não encontrado no sistema.");
      return;
    }
  
    if (ordemAtual.Status !== "Liberado para Separação") {
      alert("A ordem não está mais disponível para separação.");
      return;
    }
  
    try {
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/v1/ordem-carga/iniciar-conferencia/${nroUnico}`,
        { separadorCodigo }
      );
  
      // Verificar a mensagem exata da resposta
      if (response.data?.mensagem?.includes("Status do pedido")) {
        await axios.put(
         // `${import.meta.env.VITE_API_URL}/api/v1/imprimir/${nroUnico}`,
          { separadorCodigo }
        );
        
        

        fetchOrdem();
        navigate(`/detalhes/${nroUnico}`);
      } else {
        alert("❌ Ordem já iniciada por outro separador. Recarregando pedidos...");
        fetchOrdem();
      }
    } catch (error) {
      console.error("Erro ao iniciar separação:", error);
      alert("Erro ao iniciar separação.");
    }
  };
  
  
  

  const handleConfirmarDivergencia = async (dadosDivergencia) => {
    console.log("dadosDivergencia:", dadosDivergencia);

    if (!dadosDivergencia.nroUnico || !dadosDivergencia.codigoProduto) {
      alert("Erro: Número único ou código do produto está faltando!");
      return;
    }

    try {
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/v1/divergenciainput/${dadosDivergencia.nroUnico}/${dadosDivergencia.codigoProduto}`,
        {
          quantidade: dadosDivergencia.quantidade,
          motivoDivergencia: dadosDivergencia.motivoDivergencia,
        }
      );

      console.log("Resposta da API:", response.data);

      if (response.data?.status === "sucesso") {
        alert("Divergência registrada com sucesso!");
      } else {
        alert("Erro ao registrar divergência.");
      }
    } catch (error) {
      console.error("Erro ao registrar divergência:", error);
      alert("Erro ao registrar divergência. Verifique os dados e tente novamente.");
    }
  };

  return (
    <>
      <Header />
      <div className="lista-container">
        <div className="lista-content">
          <h1 className="lista-title">Pedido de Separação</h1>
          {ordemAtual ? (
            <OrdemCard
              ordem={ordemAtual}
              iniciarConferencia={iniciarConferencia}
              onConfirmarDivergencia={handleConfirmarDivergencia} // Passando a função de divergência
            />
          ) : (
            <p className="lista-no-data">Nenhum pedido disponível no momento.</p>
          )}
        </div>
      </div>
    </>
  );
};

export default ListaSeparacao;
