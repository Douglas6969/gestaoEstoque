// Importações...
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Etiquetas.css';
import bascel from './logo/bascel.png';
import jt from './logo/jt.png';
import destra from './logo/destra.png';
import mg2 from './logo/mg2.png';
import Header from '../../components/Header/Header';

const Etiquetas = () => {
  const { conferenteCodigo, nroUnico } = useParams();
  const navigate = useNavigate();
  const [pedidoDetalhes, setPedidoDetalhes] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [finalizando, setFinalizando] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);
  const [notificacao, setNotificacao] = useState(null);

  useEffect(() => {
    const carregarDetalhesPedido = async () => {
      try {
        setCarregando(true);
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/v2/pedidos/${conferenteCodigo}/${nroUnico}/detalhes`
        );
        setPedidoDetalhes(response.data.detalhes);
      } catch (error) {
        console.error("Erro ao carregar detalhes do pedido:", error);
        setErro(`Erro ao carregar detalhes do pedido: ${error.response?.data?.detalhes || error.message}`);
      } finally {
        setCarregando(false);
      }
    };
    carregarDetalhesPedido();
  }, [conferenteCodigo, nroUnico]);

  // Função para mostrar notificação
  const mostrarNotificacao = (mensagem, tipo) => {
    setNotificacao({ mensagem, tipo });
    // Limpa a notificação após alguns segundos
    setTimeout(() => {
      setNotificacao(null);
    }, 3000);
  };

  // Função para voltar para a página de conferência
  const voltarParaConferencia = () => {
    navigate(`/conferencia-pedido/${nroUnico}/${conferenteCodigo}`);
  };

  const imprimir = () => {
    try {
      // Prepara para impressão
      setImprimindo(true);
      // Função que executa a impressão após um pequeno delay
      setTimeout(() => {
        window.print();
        setImprimindo(false);
      }, 300);
    } catch (error) {
      console.error("Erro ao imprimir:", error);
      setImprimindo(false);
      setErro("Erro ao imprimir relatório");
    }
  };

  // Função para finalizar a conferência
  const finalizar = async () => {
    try {
      setFinalizando(true);
      // Chamando a API de finalização
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/v2/finalizar/${conferenteCodigo}`,
        { nroUnico: nroUnico }
      );
      mostrarNotificacao("Conferência finalizada com sucesso!", "sucesso");
      // Após finalizar, redireciona para a página inicial de conferência
      setTimeout(() => {
        navigate(`/iniciar-conferencia/${conferenteCodigo}`);
      }, 1000); // Pequeno delay para garantir que a notificação seja vista
    } catch (error) {
      console.error("Erro ao finalizar conferência:", error);
      setErro(`Erro ao finalizar conferência: ${error.response?.data?.detalhes || error.message}`);
    } finally {
      setFinalizando(false);
    }
  };

  const getLogoSrc = (empresaNome) => {
    switch (empresaNome.toLowerCase()) {
      case 'bascel soluções ltda':
        return bascel;
      case 'jt medicamentos ltda':
        return jt;
      case 'mg2 distribuidora de medicamentos ltda':
        return mg2;
      case ' destra distr. de medicamentos ltda':
        return destra;
      default:
        return null;
    }
  };

  if (carregando) {
    return (
      <div className="etiquetas-container carregando">
        <div className="spinner"></div>
        <p>Carregando detalhes do pedido...</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="etiquetas-container erro">
        <div className="erro-mensagem">
          <h2>Erro</h2>
          <p>{erro}</p>
          <button className="botao-voltar" onClick={voltarParaConferencia}>
            Voltar para conferência
          </button>
        </div>
      </div>
    );
  }

  if (!pedidoDetalhes) {
    return (
      <div className="etiquetas-container erro">
        <div className="erro-mensagem">
          <h2>Pedido não encontrado</h2>
          <p>Não foi possível encontrar os detalhes do pedido.</p>
          <button className="botao-voltar" onClick={voltarParaConferencia}>
            Voltar para conferência
          </button>
        </div>
      </div>
    );
  }

  const dadosExemplo = {
    numeroPedido: "114149",
    empresaNome: "JT MEDICAMENTOS LTDA",
    empresaEndereco: "R BAHIA, 69 - Presidente Kennedy",
    empresaCidade: "Francisco Beltrão - PR",
    clienteNome: "CONSÓRCIO INTERMUNICIPAL DO VALE DO RIO CAI (CIS-CAI)",
    clienteEndereco: "R OSVALDO ARANHA, 4520",
    clienteCidadeUf: "MONTENEGRO - RS",
    clienteCep: "92512640",
    qtdEtiquetas: 4
  };

  const dadosEtiqueta = {
    numeroPedido: pedidoDetalhes.nroUnico || dadosExemplo.nroUnico,
    empresaNome: pedidoDetalhes.empresaNome || dadosExemplo.empresaNome,
    empresaEndereco: pedidoDetalhes.empresaEndereco || dadosExemplo.empresaEndereco,
    empresaCidade: pedidoDetalhes.empresaCidadeUfCep?.split(' - ')[0] || dadosExemplo.empresaCidade,
    clienteNome: pedidoDetalhes.clienteNome || dadosExemplo.clienteNome,
    clienteEndereco: pedidoDetalhes.clienteEndereco || dadosExemplo.clienteEndereco,
    clienteCidadeUf: pedidoDetalhes.clienteCidadeUfCep?.split(' - ')[0] + ' - ' + pedidoDetalhes.clienteCidadeUfCep?.split(' - ')[1] || dadosExemplo.clienteCidadeUf,
    clienteCep: pedidoDetalhes.clienteCidadeUfCep?.split(' - ')[2] || dadosExemplo.clienteCep,
    qtdEtiquetas: pedidoDetalhes.qtdEtiquetas || dadosExemplo.qtdEtiquetas
  };

  const totalEtiquetas = parseInt(dadosEtiqueta.qtdEtiquetas) || 4;
  const etiquetas = Array.from({ length: totalEtiquetas }, (_, index) => index + 1);
  const logoSrc = getLogoSrc(dadosEtiqueta.empresaNome);

  return (
    <div className="etiquetas-pagina">
      <div className="no-print"><Header /></div>
      
      {notificacao && (
        <div className={`notificacao ${notificacao.tipo}`}>
          {notificacao.mensagem}
        </div>
      )}
      
      <div className="etiquetas-header no-print">
        <h1>Etiquetas para Impressão</h1>
        <div className="etiquetas-acoes">
          <button
            className="botao-imprimir"
            onClick={imprimir}
            disabled={finalizando || imprimindo}
          >
            {imprimindo ? "Imprimindo..." : "🖨️ Imprimir"}
          </button>
          <button
            className="botao-imprimir"
            onClick={finalizar}
            disabled={finalizando}
          >
            {finalizando ?
              <span><span className="spinner"></span> Finalizando...</span> :
              "✓ Finalizar Conferência"
            }
          </button>
        </div>
      </div>
      
      <div className="etiquetas-container">
        {etiquetas.map((numero) => (
          <div key={numero} className="etiqueta">
            <div className="etiqueta-titulo">
              <div className="logo-esquerda">
                {logoSrc && (
                  <img src={logoSrc} alt={`${dadosEtiqueta.empresaNome} Logo`} className="empresa-logo" />
                )}
              </div>
              <div className="titulo-direita">
                <div className="titulo-pedido">PEDIDO</div>
                <div className="numero-pedido">{dadosEtiqueta.numeroPedido}</div>
              </div>
            </div>
            <div className="etiqueta-empresa">
              <div className="empresa-nome">{dadosEtiqueta.empresaNome}</div>
              <div className="empresa-endereco">{dadosEtiqueta.empresaEndereco + ' ' + dadosEtiqueta.empresaCidade}</div>
            </div>
            <div className="etiqueta-cliente">
              <div className="label">CLIENTE:</div>
              <div className="valor">{dadosEtiqueta.clienteNome}</div>
            </div>
            <div className="etiqueta-endereco">
              <div className="label">ENDEREÇO:</div>
              <div className="valor">
                {dadosEtiqueta.clienteEndereco}
                <br />
                {dadosEtiqueta.clienteCidadeUf} - {dadosEtiqueta.clienteCep}
              </div>
            </div>
            <div className="etiqueta-volume">
              <div className="label">VOLUME:</div>
              <div className="valor">{numero} de {totalEtiquetas}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Etiquetas;
