import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Lottie from "lottie-react";
import successListAnimation from "../../assets/successlist.json";
import "./home.css";
import Header from "../../components/Header/Header";

const Home = () => {
  const navigate = useNavigate();
  const [showAnimation, setShowAnimation] = useState(false);
  const [erro, setErro] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSeparacaoClick = async () => {
    const separadorCodigo = localStorage.getItem("codsep");
    setErro("");
    setIsLoading(true);

    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/v1/verificar-separacao/${separadorCodigo}`
      );

      if (response.data.message === 'Você pode iniciar uma nova separação.') {
        setShowAnimation(true);
        setTimeout(() => {
          navigate("/lista");
        }, 1200);
      } else {
        setErro(response.data.error || "Não foi possível iniciar a separação.");
      }
    } catch (error) {
      console.error("Erro ao verificar separação:", error);
      
      if (error.response) {
        // O servidor respondeu com um status de erro
        setErro(error.response.data.message || "Erro no servidor. Tente novamente.");
      } else if (error.request) {
        // A requisição foi feita, mas não houve resposta
        setErro("Sem resposta do servidor. Verifique sua conexão.");
      } else {
        // Algo aconteceu ao configurar a requisição
        setErro("Erro ao processar a solicitação. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header />
      <div className="home-container">
        <div className="home-content">
          <h1 className="home-title">Sistema de Separação</h1>
          <p className="home-description">
            Clique no botão abaixo para iniciar o processo de separação de pedidos.
          </p>
          
          {erro && <div className="error-message">{erro}</div>}
          
          {showAnimation ? (
            <Lottie 
              animationData={successListAnimation} 
              loop={false} 
              className="success-animation" 
            />
          ) : (
            <button 
              className="separacao-button" 
              onClick={handleSeparacaoClick}
              disabled={isLoading}
            >
              {isLoading ? 'Carregando...' : 'Iniciar Separação'}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default Home;
