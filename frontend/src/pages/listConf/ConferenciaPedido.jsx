import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import "./ConferenciaPedido.css";
import Header from "../../components/Header/Header";
import DevolucaoSeparadorPopup from "../../components/DevolucaoSeparadorPopup/DevolucaoSeparadorPopup";

const ConferenciaPedido = () => {
  const { nroUnico, conferenteCodigo } = useParams();
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState([]);
  const [produtosConferidos, setProdutosConferidos] = useState([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [quantidade, setQuantidade] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [notificacao, setNotificacao] = useState(null);
  // Estado para controlar popup de finalização
  const [showFinalizarPopup, setShowFinalizarPopup] = useState(false);
  const [qtdEtiquetas, setQtdEtiquetas] = useState(1);
  const [qtdVolumes, setQtdVolumes] = useState(1);
  // Estado para controlar itens selecionados para relatório
  const [itensSelecionados, setItensSelecionados] = useState({});
  const [mostrarRelatorio, setMostrarRelatorio] = useState(false);
  const relatorioRef = useRef(null);
  // Estado para controlar a quantidade indo no relatório
  const [quantidadesRelatorio, setQuantidadesRelatorio] = useState({});
  const [showDevolucaoPopup, setShowDevolucaoPopup] = useState(false);
const [devolucaoPopupItems, setDevolucaoPopupItems] = useState([]);
// Estado para controlar volumes e suas quantidades
const [volumesExpedicao, setVolumesExpedicao] = useState({}); // Define o estado para volumes e quantidades

  // Função para criar chave única para cada produto baseada no código e lote
  const getProdutoChaveUnica = (produto) => {
    return `${produto.Codigo_Produto}-${produto.Lote || 'sem-lote'}`;
  };

  // Função para salvar o estado atual no localStorage
  const salvarEstadoLocal = (produtosAtual, produtosConferidosAtual) => {
    const estadoParaSalvar = {
      produtos: produtosAtual,
      produtosConferidos: produtosConferidosAtual,
      timestamp: new Date().getTime()
    };
    localStorage.setItem(`conferencia_${nroUnico}_${conferenteCodigo}`, JSON.stringify(estadoParaSalvar));
  };

  // Função para recuperar o estado do localStorage
  const recuperarEstadoLocal = () => {
    const estadoSalvo = localStorage.getItem(`conferencia_${nroUnico}_${conferenteCodigo}`);
    if (estadoSalvo) {
      try {
        return JSON.parse(estadoSalvo);
      } catch (e) {
        console.error("Erro ao analisar dados salvos:", e);
        return null;
      }
    }
    return null;
  };

  const abrirDevolucaoSeparadorPopup = () => {
  // Aqui você define como pegar os itens que deverão aparecer no popup.
  // Eu vou usar todos os produtos do pedido (produtos + produtosConferidos). Ajuste se quiser só um desses:
 
  const itensPopup = [
    ...produtos.map(p => ({ ...p, origem: 'aConferir' })),
    ...produtosConferidos.map(p => ({ ...p, origem: 'conferidos' }))
  ];

  setDevolucaoPopupItems(itensPopup);
  setShowDevolucaoPopup(true);
};


  // Efeito para salvar o estado sempre que produtos ou produtosConferidos mudarem
  useEffect(() => {
    if (produtos.length > 0 || produtosConferidos.length > 0) {
      salvarEstadoLocal(produtos, produtosConferidos);
    }
  }, [produtos, produtosConferidos, nroUnico, conferenteCodigo]);

  // Carregar os produtos do pedido
  useEffect(() => {
    const carregarProdutos = async () => {
      try {
        setCarregando(true);
        // Primeiro, tenta recuperar o estado salvo
        const estadoSalvo = recuperarEstadoLocal();
        const agora = new Date().getTime();
        const umDiaEmMs = 24 * 60 * 60 * 1000;

        // Se existir um estado salvo e não for muito antigo (menos de 1 dia)
        if (estadoSalvo && (agora - estadoSalvo.timestamp) < umDiaEmMs) {
          setProdutos(estadoSalvo.produtos);
          setProdutosConferidos(estadoSalvo.produtosConferidos);
          setCarregando(false);
          mostrarNotificacao("Dados recuperados da sua sessão anterior", "info");
          return;
        }

        // Se não tiver dados salvos ou dados antigos, carrega da API
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/v2/conferencia/pedido/${nroUnico}/${conferenteCodigo}`);
        if (response.data && response.data.detalhes) {
          // Filtrar produtos já bloqueados (sem tentativas restantes)
          const produtosDisponiveis = response.data.detalhes.filter(p => !p.bloqueado);
          const produtosBloqueados = response.data.detalhes.filter(p => p.bloqueado);
          setProdutos(produtosDisponiveis);

          // Adicionar produtos já bloqueados à lista de conferidos (como erros)
          setProdutosConferidos(produtosBloqueados.map(p => ({
            ...p,
            status: 'erro',
            mensagem: 'Produto bloqueado após tentativas excedidas'
          })));
        }
      } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        setErro("Não foi possível carregar os produtos do pedido");
      } finally {
        setCarregando(false);
      }
    };
    carregarProdutos();
  }, [nroUnico, conferenteCodigo]);

  // Função para selecionar um produto para conferência
  const selecionarProduto = (produto) => {
    setProdutoSelecionado(produto);
    setQuantidade("");
  };
// --- Funções para gerenciar volumes de expedição ---
const handleVolumeSelection = (volNum) => {
  const volumeKey = String(volNum);
  setVolumesExpedicao(prev => {
    const newState = { ...prev };
    if (newState[volumeKey] !== undefined) {
      // Se já estava selecionado, desmarca e remove a quantidade
      delete newState[volumeKey];
    } else {
      // Se não estava selecionado, marca e inicializa a quantidade como 0
      newState[volumeKey] = 0;
    }
    return newState;
  });
};

const handleVolumeQuantityChange = (volNum, quantity) => {
  const volumeKey = String(volNum);
  const qtd = parseInt(quantity) || 0; // Garante que é um número inteiro, ou 0 se inválido
  setVolumesExpedicao(prev => ({
    ...prev,
    [volumeKey]: qtd
  }));
};
// --- Fim das funções de volume ---

  // Função para verificar a quantidade informada
  const verificarQuantidade = async () => {
    if (!produtoSelecionado || quantidade.trim() === '') {
      mostrarNotificacao("Informe uma quantidade válida", "aviso");
      return;
    }
    try {
      const qtd = parseFloat(quantidade.replace(',', '.'));
      if (isNaN(qtd)) {
        mostrarNotificacao("Informe um valor numérico válido", "erro");
        return;
      }

      // Modifica a filtragem para considerar tanto o código quanto o lote
      const novosProdutos = produtos.filter(p =>
        !(p.Codigo_Produto === produtoSelecionado.Codigo_Produto &&
          p.Lote === produtoSelecionado.Lote)
      );

      try {
        const response = await axios.post(
          // Modifique a linha para:
          `${import.meta.env.VITE_API_URL}/api/v2/conferencia/verificar/${nroUnico}/${produtoSelecionado.Codigo_Produto}/${encodeURIComponent(produtoSelecionado.Lote || "")}/${conferenteCodigo}`
          ,
          { quantidadeInformada: quantidade }
        );

        // Atualizar o produto na lista de conferidos
        const produtoConferido = {
          ...produtoSelecionado,
          quantidadeInformada: qtd,
          status: response.data.acerto ? 'sucesso' : 'erro',
          tentativas_restantes: response.data.tentativas_restantes,
          quantidade_real: response.data.quantidade_real,
          bloqueado: response.data.bloqueado,
          mensagem: response.data.acerto
            ? "Quantidade correta!"
            : response.data.bloqueado
              ? "Tentativas excedidas!"
              : `Quantidade incorreta! ${response.data.tentativas_restantes} tentativa(s) restante(s)`
        };

        // Atualizar estado
        setProdutos(novosProdutos);
        setProdutosConferidos(prev => [...prev, produtoConferido]);

        // Definir quantidade inicial para o relatório
        const chave = getProdutoChaveUnica(produtoConferido);
        setQuantidadesRelatorio(prev => ({
          ...prev,
          [chave]: qtd
        }));

        // Limpar seleção e campo de quantidade
        setProdutoSelecionado(null);
        setQuantidade("");

        // Mostrar notificação baseado no resultado
        if (response.data.acerto) {
          mostrarNotificacao("Quantidade conferida com sucesso!", "sucesso");
        } else {
          mostrarNotificacao(
            response.data.bloqueado
              ? "Produto bloqueado após tentativas excedidas!"
              : `Quantidade incorreta! Você tem ${response.data.tentativas_restantes} tentativa(s) restante(s)`,
            "erro"
          );
        }
      } catch (error) {
        console.error("Erro ao verificar quantidade:", error);
        mostrarNotificacao("Erro ao verificar quantidade", "erro");
      }
    } catch (error) {
      console.error("Erro ao processar quantidade:", error);
      mostrarNotificacao("Erro ao processar quantidade", "erro");
    }
  };












  // Adicionando estado para mensagens de divergência
const [mensagemDivergencia, setMensagemDivergencia] = useState(null);

// Função de registrar divergência ajustada
const registrarDivergenciaConferencia = async () => {
  try {
    // Mostrar status de carregamento
    setMensagemDivergencia({ tipo: "carregando", texto: "Registrando divergência..." });
    
    // URL correta - contém apenas o número único e o código do conferente
    const url = `${import.meta.env.VITE_API_URL}/api/v2/divergenciaConf/${nroUnico}/${conferenteCodigo}`;
    console.log(`Enviando requisição para: ${url}`);
    
    // Enviar requisição PUT
    const divergenciaResponse = await axios.put(url);
    
    // Verificar se a divergência foi registrada com sucesso
    if (divergenciaResponse.status === 200) {
      setMensagemDivergencia({
        tipo: "sucesso",
        texto: "Divergência registrada com sucesso!"
      });
      
      // Mostrar notificação
      mostrarNotificacao("Divergência registrada com sucesso!", "sucesso");
      return true;
    } else {
      throw new Error("Resposta inesperada do servidor");
    }
  } catch (error) {
    console.error("Erro ao registrar divergência:", error);
    const mensagemErro = error.response?.data?.error ||
                       "Não foi possível registrar a divergência. Tente novamente.";
    setMensagemDivergencia({ tipo: "erro", texto: mensagemErro });
    mostrarNotificacao(mensagemErro, "erro");
    return false;
  }
};

  // Função de editar produto conferido
  const editarProdutoConferido = (produto) => {
    // Verificar se o produto está bloqueado
    if (produto.bloqueado) {
      mostrarNotificacao("Este produto está bloqueado para edição", "aviso");
      return;
    }

    // Adicionar o produto de volta à lista de produtos a conferir
    setProdutos(prev => [...prev, produto]);

    // Remover da lista de produtos conferidos, usando código e lote
    setProdutosConferidos(prev => prev.filter(p =>
      !(p.Codigo_Produto === produto.Codigo_Produto && p.Lote === produto.Lote)
    ));

    // Remover da lista de itens selecionados
    setItensSelecionados(prev => {
      const chave = getProdutoChaveUnica(produto);
      const { [chave]: _, ...rest } = prev;
      return rest;
    });

    // Remover da lista de quantidades do relatório
    setQuantidadesRelatorio(prev => {
      const chave = getProdutoChaveUnica(produto);
      const { [chave]: _, ...rest } = prev;
      return rest;
    });

    // Selecionar o produto para conferência
    setProdutoSelecionado(produto);
    setQuantidade("");
  };

  // Função para mostrar notificações
  const mostrarNotificacao = (mensagem, tipo = "info") => {
    setNotificacao({ mensagem, tipo });
    setTimeout(() => setNotificacao(null), 5000);
  };

  // Manipulador de tecla Enter no input de quantidade
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      verificarQuantidade();
    }
  };

  // Função para abrir o popup de finalização
  const abrirFinalizarPopup = () => {
    setShowFinalizarPopup(true);
  };


  // Função para fechar o popup
  const fecharPopup = () => {
    setShowFinalizarPopup(false);
  };

  // Função para finalizar a conferência
  const finalizarConferencia = async () => {
    try {
      setCarregando(true);

      // 1. Preparar dados dos volumes de expedição
      const volumeData = Object.entries(volumesExpedicao).map(([volume, quantidade]) => ({
        volume: parseInt(volume), // Garante que o número do volume seja um número
        quantidade: quantidade // Quantidade já é número (ou 0)
      }));

      console.log(`Enviando dados de volumes de expedição:`, {
        url: `${import.meta.env.VITE_API_URL}/api/v2/volume-expedicao/conferente/${conferenteCodigo}/nota/${nroUnico}`,
        dados: volumeData
      });

      // 2. Enviar dados dos volumes de expedição (Nova requisição POST)
      const volumesResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/v2/volume-expedicao/conferente/${conferenteCodigo}/nota/${nroUnico}`,
        volumeData
      );
      console.log("Resposta da API (Volumes):", volumesResponse.data);

      // 3. Finalizar a conferência (Requisição PUT existente)
      console.log(`Enviando requisição para finalizar conferência:`, {
        url: `${import.meta.env.VITE_API_URL}/api/v2/volumes/${conferenteCodigo}/${nroUnico}`,
        dados: {
          qtdEtiquetas: parseInt(qtdEtiquetas),
          qtdVolumes: parseInt(qtdVolumes)
        }
      });

      const finalizarResponse = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/v2/volumes/${conferenteCodigo}/${nroUnico}`,
        {
          qtdEtiquetas: parseInt(qtdEtiquetas),
          qtdVolumes: parseInt(qtdVolumes)
        }
      );
      console.log("Resposta da API (Finalizar Conferência):", finalizarResponse.data);

      // Fechar o popup
      fecharPopup();
      // Mostrar notificação de sucesso
      mostrarNotificacao("Conferência finalizada com sucesso!", "sucesso");
      // Limpar dados locais visto que a conferência foi concluída
      localStorage.removeItem(`conferencia_${nroUnico}_${conferenteCodigo}`);
      // Redirecionar para a página de etiquetas
      navigate(`/etiquetas/${conferenteCodigo}/${nroUnico}`);
    } catch (error) {
      console.error("Erro ao finalizar conferência:", error);
      // Pode ser útil verificar qual requisição falhou para dar feedback mais específico
      const mensagemErro = error.response?.data?.mensagem || error.message;
      mostrarNotificacao(`Erro ao finalizar a conferência: ${mensagemErro}`, "erro");
    } finally {
      setCarregando(false);
    }
  };


  // Toggle de seleção para usar a chave composta
  const toggleItemSelecionado = (produto) => {
    const chave = getProdutoChaveUnica(produto);
    setItensSelecionados(prev => ({
      ...prev,
      [chave]: !prev[chave]
    }));
  };

  // Função para selecionar todos os itens
  const selecionarTodosItens = () => {
    const todosItens = {};
    produtosConferidos.forEach(produto => {
      const chave = getProdutoChaveUnica(produto);
      todosItens[chave] = true;

      // Inicializar quantidades do relatório se não existirem
      if (!quantidadesRelatorio[chave]) {
        setQuantidadesRelatorio(prev => ({
          ...prev,
          [chave]: produto.quantidadeInformada || 0
        }));
      }
    });
    setItensSelecionados(todosItens);
  };

  // Função para limpar seleção
  const limparSelecao = () => {
    setItensSelecionados({});
  };

  // Função para visualizar relatório
  const visualizarRelatorio = () => {
    // Inicializa as quantidades do relatório para itens selecionados que não têm valor
    const novasQuantidades = { ...quantidadesRelatorio };

    produtosConferidos.forEach(produto => {
      const chave = getProdutoChaveUnica(produto);
      if (itensSelecionados[chave] && !novasQuantidades[chave]) {
        novasQuantidades[chave] = produto.quantidadeInformada || 0;
      }
    });

    setQuantidadesRelatorio(novasQuantidades);
    setMostrarRelatorio(true);

    // Adiciona um timeout para imprimir após o componente ter sido renderizado
    setTimeout(() => {
      window.print();
      // Restaura a visualização após a impressão
      setMostrarRelatorio(false);
    }, 500);
  };

  // Função para manipular mudança de quantidade no relatório
  const handleQuantidadeRelatorioChange = (produto, valor) => {
    const chave = getProdutoChaveUnica(produto);
    setQuantidadesRelatorio(prev => ({
      ...prev,
      [chave]: valor
    }));
  };

  // Estilo condicional para ocultar elementos durante a impressão
  const estiloNaoImprimivel = mostrarRelatorio ? { display: 'none' } : {};
  const estiloImprimivel = !mostrarRelatorio ? { display: 'none' } : {};

  return (
    <div className="app-container">
      <Header />
      {/* Conteúdo para impressão (somente visível durante impressão) */}
      <div style={estiloImprimivel} className="relatorio-impressao" ref={relatorioRef}>
        <div className="relatorio-cabecalho">
          <h1>Declaração de Conteudo</h1>
        </div>
        <table className="relatorio-tabela">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição</th>
              <th>Quantidade</th>
              <th>Unidade</th>
              <th>Lote</th>
            </tr>
          </thead>
          <tbody>
            {produtosConferidos
              .filter(produto => {
                const chave = getProdutoChaveUnica(produto);
                return itensSelecionados[chave];
              })
              .map(produto => {
                const chaveUnica = getProdutoChaveUnica(produto);
                return (
                  <tr key={chaveUnica}>
                    <td>{produto.Codigo_Produto}</td>
                    <td>{produto.Descricao_Produto}</td>
                    <td>{quantidadesRelatorio[chaveUnica] || 0}</td>
                    <td>{produto.Uni !== null && produto.Uni !== undefined ? produto.Uni : 'N/A'}</td>
                    <td>{produto.Lote || 'N/A'}</td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>
      {/* Conteúdo principal (não visível durante impressão) */}
      <div className="main-content" style={estiloNaoImprimivel}>
        <div className="dashboard-header">
          <div className="page-title-container">
            <h1 className="page-title">Conferência de Pedido</h1>
            <span className="pedido-numero">#{nroUnico}</span>
            <span className="title-decoration"></span>
            <button className="finalizar-conferencia-btn" onClick={abrirFinalizarPopup}>
              Finalizar Conferência
            </button>

           

<button
  className="devolucao-separador-btn"
  onClick={abrirDevolucaoSeparadorPopup}
  style={{ marginLeft: 8 }}
>
  Devolução p/ Separador
</button>


<DevolucaoSeparadorPopup
  isOpen={showDevolucaoPopup}
  onClose={() => setShowDevolucaoPopup(false)}
  nunota={nroUnico}
  conferenteCodigo={conferenteCodigo}
  items={devolucaoPopupItems}
  onSuccess={() => {
    // Você pode adicionar tratamento de sucesso se quiser recarregar produtos, mostrar mensagem, etc.
  }}
  onError={() => {}}
/>


          </div>
        </div>
        {/* Notificação */}
        {notificacao && (
          <div className={`notificacao ${notificacao.tipo}`}>
            <span className="notificacao-icon">
              {notificacao.tipo === "sucesso" ? "✓" : notificacao.tipo === "erro" ? "✕" : "ℹ️"}
            </span>
            <span className="notificacao-mensagem">{notificacao.mensagem}</span>
          </div>
        )}
        {/* Botões de Ação */}
        {erro ? (
          <div className="erro-container">
            <div className="erro-icon">⚠️</div>
            <div className="erro-mensagem">{erro}</div>
          </div>
        ) : carregando ? (
          <div className="loading-container">
            <div className="loading-animation">
              <div className="loading-circle"></div>
              <div className="loading-circle"></div>
              <div className="loading-circle"></div>
            </div>
            <p className="loading-text">Carregando produtos...</p>
          </div>
        ) : (
          <>
            {/* Layout de três colunas para conferência */}
            <div className="conferencia-layout">
              {/* Coluna 1: Lista de produtos a conferir */}
              <div className="conferencia-painel">
                <div className="painel-header">
                  <h2 className="painel-title">Produtos a Conferir</h2>
                  <div className="painel-stats">
                    <div className="stat-item">Total: <strong>{produtos.length}</strong></div>
                  </div>
                </div>
                {produtos.length > 0 ? (
                  <div className="produtos-lista">
                    {produtos.map((produto, index) => {
                      const chaveUnica = getProdutoChaveUnica(produto);
                      return (
                        <div
                          key={`${chaveUnica}-${index}`}
                          className={`produto-card ${produtoSelecionado?.Codigo_Produto === produto.Codigo_Produto &&
                            produtoSelecionado?.Lote === produto.Lote  &&
                            produtoSelecionado?.sequencia === produto.sequencia ?'selecionado' : ''}`}
                          onClick={() => selecionarProduto(produto)}
                        >
                          <div className="produto-card-header">
                            <span className="produto-codigo">{produto.Codigo_Produto}</span>
                            {produto.Controlado === 'Sim' && (
                              <span className="produto-controlado">Controlado</span>
                            )}
                          </div>
                          <div className="produto-card-descricao">
                            {produto.Descricao_Produto}
                          </div>
                          {produto.Lote && (
                            <div className="produto-card-lote">
                              <span className="lote-label">Lote:</span>
                              <span className="lote-value">{produto.Lote}</span>
                            </div>
                          )}
                          <div className="produto-card-footer">
                            <span className="produto-card-info">
                              <span className="info-label">Marca:</span>
                              <span className="info-value">{produto.Marca || 'N/A'}</span>
                            </span>
                            <span className="produto-card-info">
                              <span className="info-label">Unidade:</span>
                              <span className="info-value">{produto.Uni}</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">✓</div>
                    <h3 className="empty-text">Todos os produtos foram conferidos!</h3>
                    <p className="empty-subtext">Verifique os resultados na coluna direita</p>
                  </div>
                )}
              </div>
              {/* Coluna 2: Área de conferência atual */}
              <div className="produto-conferencia-container">
                {produtoSelecionado ? (
                  <>
                    <div className="painel-header">
                      <h2 className="painel-title">Conferindo produto</h2>
                    </div>
                    <div className="produto-conferencia">
                      <div className="produto-header">
                        <span className="produto-codigo-badge">{produtoSelecionado.Codigo_Produto}</span>
                        {produtoSelecionado.Controlado === 'Sim' && (
                          <span className="produto-controlado-badge">Controlado</span>
                        )}
                      </div>
                      <h3 className="produto-descricao">{produtoSelecionado.Descricao_Produto}</h3>
                      <div className="produto-detalhes">
                        <div className="detalhes-grupo">
                          <div className="detalhe-item">
                            <span className="detalhe-label">Marca:</span>
                            <span className="detalhe-valor">{produtoSelecionado.Marca || 'N/A'}</span>
                          </div>
                          <div className="detalhe-item">
                            <span className="detalhe-label">Unidade:</span>
                            <span className="detalhe-valor">{produtoSelecionado.Uni}</span>
                          </div>
                        </div>
                        <div className="detalhes-grupo">
                          <div className="detalhe-item">
                            <span className="detalhe-label">Lote:</span>
                            <span className="detalhe-valor">{produtoSelecionado.Lote || 'N/A'}</span>
                          </div>
                          <div className="detalhe-item">
                            <span className="detalhe-label">Localização:</span>
                            <span className="detalhe-valor destaque">{produtoSelecionado.Localizacao || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="quantidade-container">
                        <div className="quantidade-header">
                          <label className="quantidade-label">Digite a quantidade encontrada:</label>
                          <div className="quantidade-dica">Informe a quantidade exata conforme contagem</div>
                        </div>
                        <div className="quantidade-input-group">
                          <input
                            type="text"
                            className="quantidade-input"
                            value={quantidade}
                            onChange={(e) => setQuantidade(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="0,00"
                            autoFocus
                          />
                          <span className="unidade-badge">{produtoSelecionado.Uni}</span>
                        </div>
                        <button
                          className="confirmar-button no-loading"
                          onClick={verificarQuantidade}
                        >
                          Confirmar
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="selecione-produto-container">
                    <div className="selecione-produto-mensagem">
                      <div className="selecione-icon">👈</div>
                      <h3 className="selecione-texto">Selecione um produto</h3>
                      <p className="selecione-subtexto">Escolha um item da lista à esquerda para iniciar a conferência</p>
                    </div>
                  </div>
                )}
              </div>
              {/* Coluna 3: Produtos já conferidos */}
              <div className="produtos-conferidos-painel">
                <div className="produtos-conferidos-header">
                  <h2 className="produtos-conferidos-title">Produtos Conferidos <span className="badge">{produtosConferidos.length}</span></h2>
                  {/* Botões para selecionar todos e gerar relatório */}
                  {produtosConferidos.length > 0 && (
                    <div className="acoes-selecao">
                      <button
                        className="botao-selecionar-todos"
                        onClick={selecionarTodosItens}
                      >
                        Selecionar Todos
                      </button>
                      <button
                        className="botao-limpar-selecao"
                        onClick={limparSelecao}
                      >
                        Limpar Seleção
                      </button>
                      <button
                        className="botao-visualizar-relatorio"
                        onClick={visualizarRelatorio}
                      >
                        <span className="icone-imprimir">🖨️</span> Visualizar Relatório
                      </button>
                    </div>
                  )}
                </div>
                {produtosConferidos.length > 0 ? (
                  <div className="produtos-conferidos-lista">
                    {produtosConferidos.map((produto) => {
                      const chaveUnica = getProdutoChaveUnica(produto);
                      return (
                        <div
                          key={chaveUnica}
                          className={`produto-conferido-card ${produto.status} ${itensSelecionados[chaveUnica] ? 'selecionado' : ''}`}
                        >
                          {/* Checkbox para seleção */}
                          <div className="produto-checkbox-container">
                            <input
                              type="checkbox"
                              id={`check-${chaveUnica}`}
                              className="produto-checkbox"
                              checked={!!itensSelecionados[chaveUnica]}
                              onChange={() => toggleItemSelecionado(produto)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <label htmlFor={`check-${chaveUnica}`} className="produto-checkbox-label"></label>
                          </div>
                          <div className="produto-conferido-info">
                            <div className="produto-conferido-header">
                              <span className="produto-codigo">{produto.Codigo_Produto}</span>
                              <span className={`produto-conferido-status ${produto.status}`}>
                                {produto.status === 'sucesso' ? '✓ Correto' : '✕ Incorreto'}
                              </span>
                            </div>
                            <div className="produto-conferido-descricao">
                              {produto.Descricao_Produto}
                            </div>
                            <div className="produto-conferido-detalhes">
                              <div className="detalhes-row">
                                <span className="detalhe-label">Informado:</span>
                                <span className="detalhe-valor">
                                  {produto.quantidadeInformada?.toLocaleString('pt-BR')} {produto.Uni}
                                </span>
                              </div>

                              {produto.quantidade_real !== null && (
                                <div className="detalhes-row">
                                  <span className="detalhe-label">Real:</span>
                                  <span className="detalhe-valor">
                                    {produto.quantidade_real?.toLocaleString('pt-BR')} {produto.Uni}
                                  </span>

                                </div>

                              )}
                              <div>
                                <span className="detalhe-label">Lote: </span>
                                <span className="detalhe-valor">
                                  {produto.Lote.toLocaleString('pt-BR')}
                                </span>
                                {produto.mensagem && (
                                  <div className="produto-mensagem">
                                    {produto.mensagem}
                                  </div>
                                )}
                              </div>
                              {/* Input para especificar quantidade indo no relatório */}
                              <div className="detalhes-row">
                                <span className="detalhe-label">Declaração de Conteúdo:</span>
                                <input
                                  type="number"
                                  className="quantidade-relatorio-input"
                                  value={quantidadesRelatorio[chaveUnica] || ''}
                                  onChange={(e) => handleQuantidadeRelatorioChange(produto, e.target.value)}
                                  min="0"
                                />
                              </div>
                            </div>
                          </div>
                          {!produto.bloqueado && (
                            <button
                              className="editar-button"
                              onClick={() => editarProdutoConferido(produto)}
                            >
                              Editar
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📋</div>
                    <h3 className="empty-text">Nenhum produto conferido</h3>
                    <p className="empty-subtext">Confira os produtos da lista à esquerda</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Popup de Finalização */}
        {showFinalizarPopup && (
          <div className="popup-overlay">
            <div className="popup-container">
              <div className="popup-header">
                <h3 className="popup-titulo">Finalizar Conferência</h3>
                <button className="popup-fechar" onClick={fecharPopup}>×</button>
              </div>
              <div className="popup-content">
                <p>
                  Antes de finalizar a conferência, informe a quantidade de volumes e etiquetas:
                </p>
                <div>
                  <div className="popup-form-group">
                    <label htmlFor="qtdVolumes">Quantidade de Volumes:</label>
                    <input
                      type="number"
                      id="qtdVolumes"
                      className="popup-input"
                      value={qtdVolumes}
                      onChange={(e) => setQtdVolumes(parseInt(e.target.value) )}
                    />
                  </div>
                  <div className="popup-form-group">
                    <label htmlFor="qtdEtiquetas">Quantidade de Etiquetas:</label>
                    <input
                      type="number"
                      id="qtdEtiquetas"
                      className="popup-input"
                      value={qtdEtiquetas}
                      onChange={(e) => setQtdEtiquetas(parseInt(e.target.value) )}
                    />
                  </div>
                  {/* NOVO: Seleção de Volumes e Quantidades */}
<div className="popup-form-group volumes-expedicao-group">
  <label className="popup-label">Volumes:</label>
  <div className="volumes-list">
    {/* Array com os textos dos labels na ordem desejada */}
    {
      [
        "Modelo 001",
        "Modelo 002",
        "Modelo 003",
        "Modelo 004",
        "Modelo 008",
        "Modelo 009"
      ].map((volumeLabelText, index) => {

        const volNum = index + 1;

        return (
          <div key={`vol-${volNum}`} className="volume-item">
            <input
              type="checkbox"
              id={`vol-${volNum}`}
              checked={!!volumesExpedicao[String(volNum)]}
              onChange={() => handleVolumeSelection(volNum)}
            />
            {/* Usamos o texto do array para o label */}
            <label htmlFor={`vol-${volNum}`}>{volumeLabelText}</label>

            {/* Mostra input se o volume estiver selecionado, usando o volNum original (1-6) */}
            {volumesExpedicao[String(volNum)] !== undefined && (
              <input
                type="number"
                className="volume-quantidade-input"
                value={volumesExpedicao[String(volNum)]}
                onChange={(e) => handleVolumeQuantityChange(volNum, e.target.value)}
                min=" "
                placeholder="Qtd"
              />
            )}
          </div>
        );
      })
    }
  </div>
</div>
                </div>
                {produtos.length > 0 && (
                  <div className="estado-vazio">
                    <div>⚠️</div>
                    <div>
                      <strong>Atenção!</strong> Ainda existem {produtos.length} produtos não conferidos.
                      É necessário conferir todos os produtos antes de finalizar.
                    </div>
                  </div>
                )}
              </div>
              <div className="popup-footer">
                <button className="popup-cancelar" onClick={fecharPopup}>Cancelar</button>
                <button
                  className={`popup-confirmar ${produtos.length > 0 ? 'disabled' : ''}`}
                  onClick={finalizarConferencia}
                  disabled={produtos.length > 0}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
};

export default ConferenciaPedido;

