import React, { useState, useEffect } from "react";
import axios from "axios";
import OrdemCard from "../../components/OrdemCard/OrdemCard";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header";
import "./PerfilUsuario.css"
const PerfilUsuario = () => {
  const [ordens, setOrdens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const codsep = localStorage.getItem("codsep"); // Recupera o CODSEP do usuário logado

  useEffect(() => {
    if (!codsep) {
      setError("Erro: Separador não encontrado.");
      navigate("/"); // Redireciona se o codsep não estiver presente
      return;
    }

    const fetchOrdens = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await axios.get(`http://10.10.10.33:5000/api/ordens-carga?separadorCodigo=${codsep}`);
        if (response.data?.ordens) {
          setOrdens(response.data.ordens);
          localStorage.setItem("temPedidos", "true"); // Armazena que existem pedidos
        } else {
          setOrdens([]);
          localStorage.setItem("temPedidos", "false"); // Armazena que não existem pedidos
        }
      } catch (error) {
        setError("Ocorreu um erro ao carregar as ordens de carga. Tente novamente mais tarde.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrdens();
  }, [codsep, navigate]);

  return (
    <div className="per" >
    <div className="perfil-container">
      <Header />
      <h1>Ordens de Carga</h1>
      {error && <p className="error-message">{error}</p>}
      {loading ? (
        <p>Carregando...</p>
      ) : ordens.length > 0 ? (
        <div className="lista-content">
          {ordens.map((ordem) => (
            <OrdemCard key={ordem.Nro_Unico} ordem={ordem} />
          ))}
        </div>
      ) : (
        <p>Nenhuma ordem de carga encontrada.</p>
      )}

    </div>
    </div>
  );
};

export default PerfilUsuario;
