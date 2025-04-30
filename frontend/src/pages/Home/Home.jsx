import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Lottie from "lottie-react";
import successListAnimation from "../../assets/successlist.json";
import { FaBoxOpen, FaClipboardCheck } from "react-icons/fa"; // Ícones para separação e conferência
import { motion } from "framer-motion"; // Para animações sutis
import "./home.css";
import Header from "../../components/Header/Header";

const Home = () => {
  const navigate = useNavigate();
  const [showAnimation, setShowAnimation] = useState(false);
  const [erro, setErro] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState(null); // Para controlar qual ação está em progresso

  const handleSeparacaoClick = async () => {
    const separadorCodigo = localStorage.getItem("codsep");
    setErro("");
    setIsLoading(true);
    setActiveAction("separacao");
    
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

  const handleConferenciaClick = async () => {
    const conferenteCodigo = localStorage.getItem("codsep");
    setErro("");
    setIsLoading(true);
    setActiveAction("conferencia");
    
    try {
      // Verificar se o usuário é conferente
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/v2/is-conf/${conferenteCodigo}`
      );
      
      if (response.data.isConferente) {
        setShowAnimation(true);
        setTimeout(() => {
          navigate(`/iniciar-conferencia/${conferenteCodigo}`);
        }, 1200);
      } else {
        setErro("Você não tem permissão para acessar a área de conferência.");
      }
    } catch (error) {
      console.error("Erro ao verificar permissão de conferente:", error);
      if (error.response) {
        setErro(error.response.data.message || "Acesso negado à área de conferência.");
      } else if (error.request) {
        setErro("Sem resposta do servidor. Verifique sua conexão.");
      } else {
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
          <h1 className="home-title">Sistema de Gestão de Estoque</h1>
          <p className="home-description">
            Selecione abaixo a operação que deseja realizar.
          </p>
          
          {erro && (
            <motion.div 
              className="error-message"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {erro}
            </motion.div>
          )}
          
          {showAnimation ? (
            <Lottie
              animationData={successListAnimation}
              loop={false}
              className="success-animation"
            />
          ) : (
            <div className="action-buttons-container">
              <motion.button
                className={`action-button separacao-button ${activeAction === "separacao" ? "active" : ""}`}
                onClick={handleSeparacaoClick}
                disabled={isLoading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="button-icon">
                  <FaBoxOpen size={28} />
                </div>
                <div className="button-content">
                  <span className="button-title">Separação</span>
                  <span className="button-subtitle">Iniciar processo de separação de pedidos</span>
                </div>
                {isLoading && activeAction === "separacao" && (
                  <div className="button-loader"></div>
                )}
              </motion.button>

              <motion.button
                className={`action-button conferencia-button ${activeAction === "conferencia" ? "active" : ""}`}
                onClick={handleConferenciaClick}
                disabled={isLoading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="button-icon">
                  <FaClipboardCheck size={28} />
                </div>
                <div className="button-content">
                  <span className="button-title">Conferência</span>
                  <span className="button-subtitle">Iniciar processo de conferência de pedidos</span>
                </div>
                {isLoading && activeAction === "conferencia" && (
                  <div className="button-loader"></div>
                )}
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Home;
