import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Lottie from "lottie-react";
import successListAnimation from "../../assets/successlist.json";
import "./home.css";
import Header from "../../components/Header/Header"; // Importando o Header

const Home = () => {
  const navigate = useNavigate();
  const [showAnimation, setShowAnimation] = useState(false);
  const [erro, setErro] = useState(""); // Para armazenar mensagens de erro, se houver

  const handleSeparacaoClick = async () => {
    const separadorCodigo = localStorage.getItem("codsep"); // Recupera o CODSEP do usuário logado

    try {
      const response = await axios.get(
        `http://10.10.10.33:5000/api/v1/verificar-separacao/${separadorCodigo}`
      );

      if (response.data.message === 'Você pode iniciar uma nova separação.') {
        setShowAnimation(true);
        setTimeout(() => {
          navigate("/lista"); // Mostra a animação antes de ir para a próxima tela
        }, 1200);
      } else {
        setErro(response.data.error); // Exibe o erro caso não seja possível iniciar a separação
      }
    } catch (error) {
      setErro("Erro ao verificar se pode iniciar a separação.");
      console.log("Token usado na requisição:", armazenadoBearerToken);
      console.error(error);
    }
  };

  return (
    <>
      <Header />
      <div className="home-container">
        <div className="home-content">
          <h1 className="home-title">Bem-vindo ao Sistema de Separação</h1>
          <p className="home-description">
            Clique no botão abaixo para iniciar o processo de separação.
          </p>

          {erro && <p className="error-message">{erro}</p>}

          {showAnimation ? (
            <Lottie animationData={successListAnimation} loop={false} className="success-animation" />
          ) : (
            <button className="separacao-button" onClick={handleSeparacaoClick}>
              Iniciar Separação
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default Home;
