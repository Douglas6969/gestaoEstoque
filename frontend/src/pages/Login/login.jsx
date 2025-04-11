import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaUser, FaLock, FaEye, FaEyeSlash } from "react-icons/fa"; // Ícones
import Lottie from "react-lottie-player";
import loadingAnimation from "../../assets/loading.json"; // Animação de carregamento
import "./Login.css"; // Importando o CSS



const Login = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async () => {
        if (!username || !password) {
            setError("Preencha todos os campos!");
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/v1/users/login`, {
                ds_usuario: username,
                ds_senha: password,
            });

            if (response.data.ok) {
                localStorage.setItem("token", response.data.token);
                localStorage.setItem("codsep", response.data.codsep); // Salva o CODSEP

                setTimeout(() => {
                    setLoading(false);
                    setSuccess(true);
                    setTimeout(() => {
                        setSuccess(false);
                        navigate("/home");
                    }, 2000);
                }, 1500);
            } else {
                setLoading(false);
                setError("Credenciais incorretas! Tente novamente.");
            }
        } catch (error) {
            console.error(error);
            setLoading(false);
            setError("Erro ao autenticar. Verifique sua conexão.");
        }
    };


    return (
        <div className="login-container">
            <h1 className="title">Login</h1>

            {error && <p className="error-message">{error}</p>}

            {/* Campo Usuário */}
            <div className="input-container">
                <FaUser className="icon" />
                <input
                    type="text"
                    placeholder="Nome de usuário"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input"
                />
            </div>

            {/* Campo Senha */}
            <div className="input-container">
                <FaLock className="icon" />
                <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                />
                <button
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
            </div>

            {/* Botão de Login */}
            <button className="login-button" onClick={handleSubmit}>
                Entrar
            </button>

            {/* Overlay de Carregamento */}
            {loading && (
                <div className="loading-overlay">
                    <div className="loading-content">
                        <Lottie
                            animationData={loadingAnimation}
                            play={loading}
                            style={{ width: 150, height: 150 }}
                            rendererSettings={{
                                preserveAspectRatio: 'xMidYMid slice'
                            }}
                        />
                        <p className="loading-text">Validando Usuário...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Login;