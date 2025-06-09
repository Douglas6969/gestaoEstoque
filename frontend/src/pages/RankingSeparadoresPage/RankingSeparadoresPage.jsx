// src/pages/rankingSeparadores/RankingSeparadoresPage.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header/Header';
// import ModalOverlay from "../../components/ModalOverlay/ModalOverlay"; // <-- COMENTADO
import './RankingSeparadoresPage.css'; // Importa o CSS para esta página
// Importa ícones FontAwesome se estiver usando a biblioteca
// Certifique-se de ter a biblioteca instalada (ex: npm install @fortawesome/fontawesome-free)
// ou inclua o CDN no seu index.html
// import '@fortawesome/fontawesome-free/css/all.min.css'; // <-- Se estiver usando o CSS, certifique-se que esta ou a CDN estão ativas
// Se estiver usando a biblioteca React FontAwesome:
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'; // <-- COMENTADO (se não for usar o componente)
// import { faCrown, faMedal, faInfoCircle, faChartBar, faExclamationTriangle, faClipboardList, faSpinner } from "@fortawesome/free-solid-svg-icons"; // <-- COMENTADO (se não for usar o componente)

const API_BASE_URL = import.meta.env.VITE_API_URL;

const RankingSeparadoresPage = () => {
    const navigate = useNavigate();
    const [rankingData, setRankingData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notificacao, setNotificacao] = useState(null);

    // Estado para controlar o modal de detalhes do separador individual
    const [isSeparatorModalOpen, setIsSeparatorModalOpen] = useState(false);
    const [selectedSeparator, setSelectedSeparator] = useState(null);

    // Estado para controlar o modal das listas globais de NUNOTas
    const [globalListModal, setGlobalListModal] = useState({
        isOpen: false,
        title: '',
        list: []
    });

    // Função para formatar a data de yyyy/mm/dd para dd/mm/yyyy
    const formatarDataParaDDMMYYYY = (dataInput) => {
        console.log("formatarDataParaDDMMYYYY - Input recebido:", dataInput); // <-- CONSOLE.LOG 2

        // Verifica se a entrada é uma string e se parece com o formato esperado yyyy/mm/dd
        // Usamos uma regex para ser mais preciso nesse formato
        const yyyy_mm_dd_regex = /^\d{4}\/\d{2}\/\d{2}$/;

        if (typeof dataInput === 'string' && yyyy_mm_dd_regex.test(dataInput)) {
            console.log("formatarDataParaDDMMYYYY - Input corresponde ao formato yyyy/mm/dd"); // <-- CONSOLE.LOG 3a
            // Divide a string nas partes (ano, mês, dia)
            const partes = dataInput.split('/');
            const ano = partes[0];
            const mes = partes[1];
            const dia = partes[2];
            // Retorna a data no formato dd/mm/yyyy
            return `${dia}/${mes}/${ano}`;
        } else {
             console.log("formatarDataParaDDMMYYYY - Input NÃO corresponde ao formato yyyy/mm/dd. Tentando fallback com new Date()."); // <-- CONSOLE.LOG 3b
             // Tenta parsear com new Date como fallback, caso o formato seja outro válido
             const fallbackDate = new Date(dataInput);
              if (!isNaN(fallbackDate.getTime())) {
                  console.log("formatarDataParaDDMMYYYY - Fallback com new Date() bem-sucedido."); // <-- CONSOLE.LOG 3c
                  const dia = fallbackDate.getDate();
                  const mes = fallbackDate.getMonth() + 1; // getMonth() é 0-indexed
                  const ano = fallbackDate.getFullYear();
                  // Formata dia e mês com dois dígitos
                  const diaFormatado = dia < 10 ? '0' + dia : dia;
                  const mesFormatado = mes < 10 ? '0' + mes : mes;
                  return `${diaFormatado}/${mesFormatado}/${ano}`;
              } else {
                  console.error("formatarDataParaDDMMYYYY - Não foi possível formatar a data.", dataInput); // <-- CONSOLE.LOG 3d
                  return "Data inválida"; // Retorna um texto indicativo de erro
              }
        }
    };


    const mostrarNotificacao = (mensagem, tipo = "info") => {
        setNotificacao({ mensagem, tipo });
        setTimeout(() => setNotificacao(null), 5000);
    };

    useEffect(() => {
        const fetchRanking = async () => {
            try {
                setLoading(true);
                setError(null);
                // Ajuste a URL da API conforme necessário, mantendo a versão v3
                const apiUrl = `${API_BASE_URL}/api/v3/separadores/ranking`;
                console.log('Chamando API de Ranking:', apiUrl);
                const response = await axios.get(apiUrl);

                console.log("Dados brutos da API recebidos:", response.data); // <-- CONSOLE.LOG 1

                if (response.data) {
                    // Verifica se a resposta contém os dados esperados, incluindo os novos totais e listas
                    // Adiciona a verificação para data_referencia também
                    if (response.data.pontuacoes && Array.isArray(response.data.pontuacoes) &&
                        response.data.data_referencia !== undefined && // Verifica se data_referencia existe
                        response.data.total_ordens_status_1_count !== undefined &&
                        response.data.total_ordens_status_2_count !== undefined &&
                        response.data.total_ordens_status_9_count !== undefined &&
                        response.data.total_ordens_status_1_list !== undefined &&
                        response.data.total_ordens_status_2_list !== undefined &&
                        response.data.total_ordens_status_9_list !== undefined) {
                        setRankingData(response.data);
                    } else if (response.data.error) {
                        setError(response.data.error);
                        setRankingData(null);
                    } else {
                        setError("Formato de dados da API de ranking inesperado ou incompleto.");
                        setRankingData(null);
                        console.error("Dados recebidos:", response.data);
                    }
                } else {
                    setError("Resposta da API vazia.");
                    setRankingData(null);
                }
            } catch (err) {
                console.error("Erro ao buscar ranking:", err);
                setError("Não foi possível carregar o ranking. Verifique sua conexão ou tente novamente.");
                setRankingData(null);
            } finally {
                setLoading(false);
            }
        };
        fetchRanking();
    }, []); // Dependência vazia para rodar apenas uma vez ao montar

    const handleVoltar = () => {
        navigate("/home");
    };

    // Função para abrir o modal de detalhes do separador individual
    const handleOpenSeparatorModal = (separator) => {
        setSelectedSeparator(separator);
        setIsSeparatorModalOpen(true);
    };

    // Função para fechar o modal de detalhes do separador individual
    const handleCloseSeparatorModal = () => {
        setIsSeparatorModalOpen(false);
        setSelectedSeparator(null);
    };

    // Função para abrir o modal das listas globais
    const handleOpenGlobalListModal = (title, list) => {
        setGlobalListModal({
            isOpen: true,
            title: title,
            list: list
        });
    };

    // Função para fechar o modal das listas globais
    const handleCloseGlobalListModal = () => {
        setGlobalListModal({
            isOpen: false,
            title: '',
            list: []
        });
    };

    // Função auxiliar para determinar a classe do badge de posição
    const getPosicaoBadgeClass = (posicao) => {
        if (posicao === 1) return 'posicao-1';
        if (posicao === 2) return 'posicao-2';
        if (posicao === 3) return 'posicao-3';
        return ''; // Sem classe especial para outras posições
    };

    // Função auxiliar para renderizar o ícone de ranking
    const getRankingIcon = (posicao) => {
        // Se estiver usando a biblioteca FontAwesome React:
        /*
        if (posicao === 1) {
            return <FontAwesomeIcon icon={faCrown} className="ranking-icon posicao-1" />;
        }
        if (posicao === 2) {
            return <FontAwesomeIcon icon={faMedal} className="ranking-icon posicao-2" />; // Medalha para 2º e 3º
        }
        if (posicao === 3) {
            return <FontAwesomeIcon icon={faMedal} className="ranking-icon posicao-3" />;
        }
        */
        // Se estiver usando apenas o CSS do FontAwesome (incluído via CDN ou import direto):
        if (posicao === 1) {
            return <i className="fas fa-crown ranking-icon posicao-1"></i>;
        }
        if (posicao === 2) {
            return <i className="fas fa-medal ranking-icon posicao-2"></i>; // Medalha para 2º e 3º
        }
        if (posicao === 3) {
            return <i className="fas fa-medal ranking-icon posicao-3"></i>;
        }
        return null; // Nenhum ícone para outras posições
    };

    if (loading) {
        return (
            <>
                <Header />
                <div className="loading-spinner">
                    {/* Se estiver usando FontAwesome React: <FontAwesomeIcon icon={faSpinner} spin /> */}
                    {/* Se estiver usando FontAwesome CSS: */}
                    <i className="fas fa-spinner fa-spin"></i>
                    Carregando ranking dos separadores...
                </div>
            </>
        );
    }

    if (error) {
        return (
            <>
                <Header />
                <div className="error-message">
                    <div>❌ {error}</div>
                    <button
                        className="botao voltar"
                        style={{ marginTop: '20px', maxWidth: '200px' }}
                        onClick={handleVoltar}
                    >
                        Voltar
                    </button>
                </div>
            </>
        );
    }

    // Verifica se rankingData e os campos de totais/listas existem antes de desestruturar
    // Adiciona a verificação para data_referencia aqui também
    if (!rankingData || !rankingData.pontuacoes || rankingData.pontuacoes.length === 0 ||
        rankingData.data_referencia === undefined || // Verifica se data_referencia existe
        rankingData.total_ordens_status_1_count === undefined ||
        rankingData.total_ordens_status_2_count === undefined ||
        rankingData.total_ordens_status_9_count === undefined ||
        rankingData.total_ordens_status_1_list === undefined ||
        rankingData.total_ordens_status_2_list === undefined ||
        rankingData.total_ordens_status_9_list === undefined) {
        return (
            <>
                <Header />
                <div className="ranking-container">
                    <h2 className="title">Ranking de Separadores</h2>
                    <p className="no-data-message">Nenhum dado de ranking encontrado para o período ou dados incompletos.</p>
                    <div className="botoes-container">
                        <button className="botao voltar" onClick={handleVoltar}>
                            <span>←</span> Voltar
                        </button>
                    </div>
                </div>
            </>
        );
    }

    // Desestrutura os dados do ranking, incluindo os novos totais e listas
    const {
        periodo, // 'periodo' não está sendo usado no JSX atual, mas mantido na desestruturação
        data_referencia,
        total_separadores,
        pontuacoes,
        total_ordens_status_1_count,
        total_ordens_status_1_list,
        total_ordens_status_2_count,
        total_ordens_status_2_list,
        total_ordens_status_9_count,
        total_ordens_status_9_list
    } = rankingData;

    return (
        <>
            <Header />
            {/* Notificação */}
            {notificacao && (
                <div className={`notificacao-card ${notificacao.tipo}`}>
                    <div className="notificacao-icon">
                        {notificacao.tipo === "sucesso" ? "✓" :
                         notificacao.tipo === "erro" ? "✕" : "ℹ️"}
                    </div>
                    <p className="notificacao-mensagem">{notificacao.mensagem}</p>
                    <button className="notificacao-fechar" onClick={() => setNotificacao(null)}>×</button>
                </div>
            )}
            <div className="ranking-container">
                <h2 className="title">Ranking de Separadores</h2>
                <div className="ranking-info">
                    {/* Aplica a função de formatação aqui */}
                  <p>Período: <span className="info-value">{data_referencia}</span></p>

                    <p> Separadores: <span className="info-value">{total_separadores}</span></p>
                </div>

                {/* SEÇÃO: TOTAIS GERAIS DE STATUS */}
                <div className="status-totals-section">
                    <h3>
                        {/* Se estiver usando FontAwesome React: <FontAwesomeIcon icon={faInfoCircle} /> */}
                        {/* Se estiver usando FontAwesome CSS: */}
                        <i className="fas fa-info-circle"></i>
                        Status Gerais das Ordens
                    </h3>
                    <div className="status-grid">
                        <div className="status-item status-1">
                            <h4>
                                {/* Se estiver usando FontAwesome React: <FontAwesomeIcon icon={faClipboardList} /> */}
                                {/* Se estiver usando FontAwesome CSS: */}
                                <i className="fas fa-clipboard-list"></i>
                                Status 1 (Aguardando Separação)
                            </h4>
                            {total_ordens_status_1_list && total_ordens_status_1_list.length > 0 ? (
                                <span
                                    className="clickable-count"
                                    onClick={() => handleOpenGlobalListModal('Ordens Status 1', total_ordens_status_1_list)}
                                    title="Clique para ver a lista de ordens aguardando separação"
                                >
                                    {total_ordens_status_1_count} ordem(ns)
                                </span>
                            ) : (
                                <span>{total_ordens_status_1_count} ordem(ns)</span>
                            )}
                        </div>
                        <div className="status-item status-2">
                            <h4>
                                {/* Se estiver usando FontAwesome React: <FontAwesomeIcon icon={faBoxOpen} /> */}
                                {/* Se estiver usando FontAwesome CSS: */}
                                <i className="fas fa-box-open"></i>
                                Status 2 (Em Separação)
                            </h4>
                             {total_ordens_status_2_list && total_ordens_status_2_list.length > 0 ? (
                                <span
                                    className="clickable-count"
                                    onClick={() => handleOpenGlobalListModal('Ordens Status 2', total_ordens_status_2_list)}
                                    title="Clique para ver a lista de ordens em separação"
                                >
                                    {total_ordens_status_2_count} ordem(ns)
                                </span>
                            ) : (
                                <span>{total_ordens_status_2_count} ordem(ns)</span>
                            )}
                        </div>
                        <div className="status-item status-9">
                            <h4>
                                {/* Se estiver usando FontAwesome React: <FontAwesomeIcon icon={faExclamationTriangle} /> */}
                                {/* Se estiver usando FontAwesome CSS: */}
                                <i className="fas fa-exclamation-triangle"></i>
                                Status 9 (Erro)
                            </h4>
                             {total_ordens_status_9_list && total_ordens_status_9_list.length > 0 ? (
                                <span
                                    className="clickable-count error-count" // Adiciona a classe error-count para cor
                                    onClick={() => handleOpenGlobalListModal('Ordens Status 9 (Erro)', total_ordens_status_9_list)}
                                    title="Clique para ver a lista de ordens com erro"
                                >
                                    {total_ordens_status_9_count} ordem(ns)
                                </span>
                            ) : (
                                <span className="error-count">{total_ordens_status_9_count} ordem(ns)</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* SEÇÃO: RANKING INDIVIDUAL DOS SEPARADORES */}
                <div className="ranking-list-section">
                    <h3>
                        {/* Se estiver usando FontAwesome React: <FontAwesomeIcon icon={faChartBar} /> */}
                        {/* Se estiver usando FontAwesome CSS: */}
                        <i className="fas fa-chart-bar"></i>
                        Ranking Individual
                    </h3>
                    <div className="ranking-list">
                        {pontuacoes.map((separador, index) => (
                            <div
                                key={separador.id_separador}
                                className={`separator-card ${getPosicaoBadgeClass(index + 1)}`}
                                onClick={() => handleOpenSeparatorModal(separador)} // Adiciona o onClick para abrir o modal
                                title={`Clique para ver detalhes de ${separador.nome_separador}`}
                            >
                                <div className="card-header">
                                    <div className={`posicao-badge ${getPosicaoBadgeClass(index + 1)}`}>
                                        {getRankingIcon(index + 1) || (index + 1)}
                                    </div>
                                    <div className="separator-info">
                                        <span className="separator-name">{separador.nome_separador}</span>
                                        <span className="separator-id">ID: {separador.id_separador}</span>
                                    </div>
                                    <div className="total-score">
                                        Pontuação: <span className="score-value">{separador.pontuacao_total}</span>
                                    </div>
                                </div>
                                {/* Detalhes chave visíveis no card */}
                                <div className="card-details">
                                    <span className="detail-item">
                                        {/* Se estiver usando FontAwesome React: <FontAwesomeIcon icon={faClipboardList} /> */}
                                        {/* Se estiver usando FontAwesome CSS: */}
                                        <i className="fas fa-clipboard-list"></i>
                                        Pedidos Separados (Status 3): {separador.pedidos_internos}
                                    </span>
                                    <span className="detail-item">
                                        {/* Se estiver usando FontAwesome React: <FontAwesomeIcon icon={faExclamationTriangle} /> */}
                                        {/* Se estiver usando FontAwesome CSS: */}
                                        <i className="fas fa-exclamation-triangle"></i>
                                        Erros (Status 9): <span className="error-count">{separador.erros_com_status_9}</span>
                                    </span>
                                    {/* Novos detalhes de pontos adicionados aqui */}
                                    {separador.detalhamento && (
                                        <>
                                            <span className="detail-item">
                                                {/* Ícone para Pedidos (opcional, se estiver usando FontAwesome React) */}
                                                {/* <FontAwesomeIcon icon={faClipboardList} /> */}
                                                {/* Ícone para Pedidos (opcional, se estiver usando FontAwesome CSS) */}
                                                <i className="fas fa-clipboard-list"></i>
                                                Pontos por Pedidos: {separador.detalhamento.pontos_pedidos}
                                            </span>
                                            <span className="detail-item">
                                                {/* Ícone para Volumes (opcional) */}
                                                {/* <FontAwesomeIcon icon={faBoxOpen} /> */}
                                                {/* Ícone para Volumes (opcional, se estiver usando FontAwesome CSS) */}
                                                <i className="fas fa-box-open"></i>
                                                Pontos por Volumes: {separador.detalhamento.pontos_volumes}
                                            </span>
                                            <span className="detail-item">
                                                {/* Ícone para Produtos (opcional) */}
                                                {/* <FontAwesomeIcon icon={faCube} /> */}
                                                {/* Ícone para Produtos (opcional, se estiver usando FontAwesome CSS) */}
                                                <i className="fas fa-cube"></i>
                                                Pontos por Produtos: {separador.detalhamento.pontos_produtos}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="botoes-container">
                    <button className="botao voltar" onClick={handleVoltar}>
                        <span>←</span> Voltar
                    </button>
                </div>
            </div>

            {/* ==================== Modal de Detalhes do Separador Individual ==================== */}
            {isSeparatorModalOpen && selectedSeparator && (
                <div className={`modal-overlay ${isSeparatorModalOpen ? 'visible' : ''}`} onClick={handleCloseSeparatorModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}> {/* Impede que o clique no conteúdo feche o modal */}
                        <button className="modal-close" onClick={handleCloseSeparatorModal}>×</button>
                        <h3>Detalhes de {selectedSeparator.nome_separador}</h3>
                        <div className="modal-details-grid">
                            {/* Informações de Ranking */}
                            <div className="modal-detail-item full-width">
                                <strong>Ranking:</strong>
                                <span>{selectedSeparator.ranking}º ({selectedSeparator.posicao})</span>
                            </div>
                            {selectedSeparator.ranking > 1 && (
                                <div className="modal-detail-item full-width">
                                    <strong>Pontos Atrás do 1º:</strong>
                                    <span>{selectedSeparator.pontos_atras}</span>
                                </div>
                            )}
                            {/* Detalhes da Pontuação */}
                            <div className="modal-detail-item">
                                <strong>Pontuação Bruta:</strong>
                                <span>{selectedSeparator.pontuacao_bruta}</span>
                            </div>
                            <div className="modal-detail-item">
                                <strong>Dedução por Erros:</strong>
                                <span className="error-count">{selectedSeparator.deducao_por_erros}</span>
                            </div>
                            <div className="modal-detail-item full-width">
                                <strong>Pontuação Final:</strong>
                                <span>{selectedSeparator.pontuacao_final}</span>
                            </div>
                            {/* Detalhes de Produção */}
                            <div className="modal-detail-item">
                                <strong>Pedidos Separados (Status 3):</strong>
                                <span>{selectedSeparator.pedidos_internos}</span>
                            </div>
                            <div className="modal-detail-item">
                                <strong>Volumes Separados:</strong>
                                <span>{selectedSeparator.volumes}</span>
                            </div>
                            <div className="modal-detail-item">
                                <strong>Produtos Separados:</strong>
                                <span>{selectedSeparator.produtos}</span>
                            </div>
                            <div className="modal-detail-item">
                                <strong>Ordens em Separação (Status 2):</strong>
                                <span className="ordens-status-2-count">{selectedSeparator.total_ordens_status_2}</span>
                            </div>
                            <div className="modal-detail-item">
                                <strong>Erros (Status 9):</strong>
                                <span className="error-count">{selectedSeparator.erros_com_status_9}</span>
                            </div>
                            {/* Detalhamento da Pontuação (mantido no modal também para clareza) */}
                            {selectedSeparator.detalhamento && (
                                <div className="modal-detail-item full-width nested-detail">
                                    <strong>Pontos Ganhos Por:</strong>
                                    <ul>
                                        <li>Pedidos: {selectedSeparator.detalhamento.pontos_pedidos}</li>
                                        <li>Volumes: {selectedSeparator.detalhamento.pontos_volumes}</li>
                                        <li>Produtos: {selectedSeparator.detalhamento.pontos_produtos}</li>
                                    </ul>
                                </div>
                            )}
                            {/* Exibir listas de NUNOTas do separador, se disponíveis */}
                            {selectedSeparator.ordens_status_2_list && selectedSeparator.ordens_status_2_list.length > 0 && (
                                <div className="modal-separator-list">
                                    <h4>Ordens em Separação (Status 2)</h4>
                                    <ul className="nunota-list">
                                        {selectedSeparator.ordens_status_2_list.map((nunota, idx) => (
                                            <li key={idx} className="nunota-item">{nunota}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {selectedSeparator.erros_list && selectedSeparator.erros_list.length > 0 && (
                                <div className="modal-separator-list">
                                    <h4>Ordens com Erro (Status 9)</h4>
                                    <ul className="nunota-list">
                                        {selectedSeparator.erros_list.map((nunota, idx) => (
                                            <li key={idx} className="nunota-item">{nunota}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {/* Mensagem se não houver listas específicas para o separador */}
                            {((!selectedSeparator.ordens_status_2_list || selectedSeparator.ordens_status_2_list.length === 0) &&
                              (!selectedSeparator.erros_list || selectedSeparator.erros_list.length === 0)) && (
                                <p className="no-data-message">Nenhuma lista de ordens específica disponível para este separador.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== Modal de Listas Globais (Status 1, 2, 9) ==================== */}
            {globalListModal.isOpen && (
                <div className={`modal-overlay ${globalListModal.isOpen ? 'visible' : ''}`} onClick={handleCloseGlobalListModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}> {/* Impede que o clique no conteúdo feche o modal */}
                        <button className="modal-close" onClick={handleCloseGlobalListModal}>×</button>
                        <h3>{globalListModal.title}</h3>
                        {globalListModal.list && globalListModal.list.length > 0 ? (
                            <ul className="nunota-list">
                                {globalListModal.list.map((nunota, index) => (
                                    <li key={index} className="nunota-item">{nunota}</li>
                                ))}
                            </ul>
                        ) : (
                            <p className="no-data-message">Nenhuma ordem encontrada para este status.</p>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default RankingSeparadoresPage;
