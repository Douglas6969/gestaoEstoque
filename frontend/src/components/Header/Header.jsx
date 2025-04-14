import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, LogOut, User } from "lucide-react";
import ConfirmLogoutModal from "../ConfirmLogoutModal/ConfirmLogoutModal"; // Importando o modal de confirmação
import "./Header.css";
import logo from "../../assets/png04.png";

const Header = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Voltar para a página anterior
    const handleBack = () => {
        navigate("/perfil");
    };

    // Redirecionar para a página inicial (/home)
    const handleHome = () => {
        navigate("/home");
    };

    // Confirmar logout
    const handleLogoutConfirm = async () => {
        const separadorCodigo = localStorage.getItem("codsep");
        if (!separadorCodigo) {
            console.error("ID do usuário não encontrado no localStorage");
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/logout/${separadorCodigo}`);
            localStorage.removeItem("codsep");
            localStorage.removeItem("id_usuario");
            navigate("/");
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
        } finally {
            setLoading(false);
            setIsModalOpen(false);
        }
    };

    // Cancelar logout
    const handleLogoutCancel = () => {
        setIsModalOpen(false);
    };

    // Abrir modal de confirmação de logout
    const handleLogout = () => {
        setIsModalOpen(true);
    };

    // Redirecionar para a página do usuário
    const handleUserProfile = () => {
        navigate("/perfil");
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
            <ConfirmLogoutModal
                isOpen={isModalOpen}
                onConfirm={handleLogoutConfirm}
                onCancel={handleLogoutCancel}
            />
        </header>
    );
};

export default Header;
