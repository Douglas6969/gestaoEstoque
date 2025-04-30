import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Header from "../../components/Header/Header";
import "./iniciarconferencia.css";

const IniciarConferencia = () => {
  const [nroUnico, setNroUnico] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();
  const codigoConferente = localStorage.getItem("codsep");

  useEffect(() => {
    // Verificar se o usuário está autenticado
    if (!codigoConferente) {
      navigate("/");
    }
  }, [codigoConferente, navigate]);

  // Função para lidar com a mudança no input
  const handleInputChange = (e) => {
    const value = e.target.value;
    // Aceitar apenas números
    if (/^\d*$/.test(value)) {
      setNroUnico(value);
      setError("");
    }
  };

  // Função para simular leitura de código de barras/QR Code
  const handleScanClick = () => {
    // Em um cenário real, isso acionaria a câmera ou um scanner
    // Para fins de demonstração, vamos apenas inserir um valor de exemplo
    alert("Em um ambiente de produção, esta função ativaria o scanner de código de barras ou QR Code.");
    
    // Valor de exemplo para demonstração
    const exampleNumber = "12345678";
    setNroUnico(exampleNumber);
    setError("");
  };

  // Função para iniciar a conferência
  const handleIniciarConferencia = async () => {
    if (!nroUnico) {
      setError("Por favor, informe o número único do pedido");
      return;
    }

    try {
      setLoading(true);
      setError("");
      
      // Chamada para a API
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/v2/iniciar/${codigoConferente}`,
        { nroUnico: nroUnico }
      );

      // Exibir mensagem de sucesso antes de redirecionar
      setSuccess(true);
      setSuccessMessage(response.data?.mensagem || "Conferência iniciada com sucesso!");
      
      // Aguardar um curto período para mostrar a mensagem de sucesso
      setTimeout(() => {
        // Redirecionar para a página de conferência
        navigate(`/conferencia/${nroUnico}/${codigoConferente}`);
      }, 1500);
    } catch (error) {
      console.error("Erro ao iniciar conferência:", error);
      if (error.response?.data?.erro) {
        setError(error.response.data.erro);
      } else if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError("Erro ao iniciar conferência. Verifique o número e tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="iniciar-conferencia-container">
      <Header />
      <div className="conferencia-content">
        <div className="conferencia-card">
          <div className="conferencia-header">
            <h1 className="conferencia-title">Iniciar Conferência</h1>
            <p className="conferencia-subtitle">
              Digite ou escaneie o número único do pedido a ser conferido
            </p>
          </div>
          <div className="conferencia-body">
            <div className="input-group">
              <label className="input-label">
                <span className="input-icon">🔢</span> Número Único do Pedido
              </label>
              <input
                type="text"
                className="conferencia-input"
                placeholder="Digite o número único..."
                value={nroUnico}
                onChange={handleInputChange}
                disabled={loading || success}
              />
              {error && (
                <div className="error-message">
                  <span>⚠️</span> {error}
                </div>
              )}
            </div>

            <div className="button-group">
              <button
                className="scan-button"
                onClick={handleScanClick}
                disabled={loading || success}
              >
                <span>📷</span> Escanear
              </button>
              <button
                className="iniciar-button"
                onClick={handleIniciarConferencia}
                disabled={!nroUnico || loading || success}
              >
                {loading ? (
                  <div className="loading-spinner"></div>
                ) : (
                  <>
                    <span>✓</span> Iniciar
                  </>
                )}
              </button>
            </div>
            
            {success && (
              <div className="success-message">
                <span className="success-icon">✓</span>
                {successMessage}
              </div>
            )}
          </div>
        </div>

        <div className="info-card">
          <h3 className="info-title">
            <span className="info-icon">ℹ️</span> Como funciona
          </h3>
          <div className="info-step">
            <div className="step-number">1</div>
            <p className="step-text">
              Digite ou escaneie o número único do pedido que precisa ser conferido.
            </p>
          </div>
          <div className="info-step">
            <div className="step-number">2</div>
            <p className="step-text">
              Clique em "Iniciar" para começar o processo de conferência deste pedido.
            </p>
          </div>
          <div className="info-step">
            <div className="step-number">3</div>
            <p className="step-text">
              Você será direcionado para a tela de conferência, onde poderá verificar os itens do pedido.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IniciarConferencia;
