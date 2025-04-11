import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, LogOut, User } from "lucide-react"; // Ícones
import "./Header.css"; // Estilos
import logo from "../../assets/png04.png"; // Importando a imagem

const Header = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Voltar para a página anterior
  const handleBack = () => {
    navigate("/perfil");
  };

  // Redirecionar para a página inicial (/home)
  const handleHome = () => {
    navigate("/home");
  };

  // Logout e redirecionamento para Login (/)
  const handleLogout = async () => {
    if (window.confirm("Tem certeza que deseja sair?")) {
      navigate("/");
      setLoading(true);
      try {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/logout`);
      } catch (error) {
        console.error("Erro ao fazer logout:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  // Redirecionar para a página do usuário
  const handleUserProfile = () => {
    navigate("/perfil"); // Substitua "/perfil" pela rota correta do perfil
  };

  return (
    <header className="header">
        <div className="header-left">
            <button className="icon-button back" onClick={handleBack}>
                <ArrowLeft size={24} />
            </button>
        </div>
        
        <button className="header-logo-button" onClick={handleHome}>
            <img src={logo} alt="Logo" className="header-logo" />
        </button>
        
        <div className="header-right">
            <button className="icon-button user" onClick={handleUserProfile}>
                <User size={24} />
            </button>
            <button className="icon-button logout" onClick={handleLogout} disabled={loading}>
                <LogOut size={24} />
            </button>
        </div>
    </header>
);

 
};

export default Header;
