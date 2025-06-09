import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DevolucaoSeparadorPopup.css';
import { v4 as uuidv4 } from 'uuid'; // Importe a função para gerar UUIDs

// Certifique-se de instalar a biblioteca uuid se ainda não o fez:
// npm install uuid
// ou
// yarn add uuid

// Definindo as opções de erro
const errorOptions = [
  { code: '01', description: 'Faltou' },
  { code: '02', description: 'Sobrou' },
  { code: '03', description: 'Troca de lote' },
];

const DevolucaoSeparadorPopup = ({
  isOpen,
  onClose,
  nunota,
  conferenteCodigo,
  items, // Lista dos itens da nota (pode conter sequências duplicadas)
  onSuccess,
  onError
}) => {
  // Novo estado para armazenar os itens com um ID único gerado para a UI
  const [processedItems, setProcessedItems] = useState([]);

  // Os estados agora usarão o uniqueId como chave
  const [selectedItems, setSelectedItems] = useState({}); // Key: uniqueId, Value: boolean
  const [itemObservations, setItemObservations] = useState({}); // Key: uniqueId, Value: string
  const [itemErrorCodes, setItemErrorCodes] = useState({}); // Key: uniqueId, Value: string

  const [generalObservation, setGeneralObservation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Effect para processar os itens e gerar IDs únicos quando o popup abre ou a lista de itens muda
  useEffect(() => {
    if (isOpen && items && items.length > 0) {
      // Mapeia os itens originais e adiciona um uniqueId a cada um
      const itemsWithUniqueId = items.map(item => ({
        ...item,
        uniqueId: uuidv4() // Gera um ID único para cada instância de item na lista
      }));
      setProcessedItems(itemsWithUniqueId);

      // Limpa os estados ao abrir o popup com novos itens
      setSelectedItems({});
      setItemObservations({});
      setItemErrorCodes({});
      setGeneralObservation('');
      setError(null);
      setSuccessMessage(null);

    } else if (!isOpen) {
        // Limpa os estados e a lista processada ao fechar o popup
        setProcessedItems([]);
        setSelectedItems({});
        setItemObservations({});
        setItemErrorCodes({});
        setGeneralObservation('');
        setError(null);
        setSuccessMessage(null);
    }
  }, [isOpen, items]); // Depende de isOpen e items

  if (!isOpen) return null;

  // Função auxiliar para obter a sequência original (necessária para o payload de envio)
  const getOriginalSequencia = (item) => item.Sequencia ?? item.sequencia ?? '';

  // Os handlers agora recebem o uniqueId
  const handleCheckboxChange = (uniqueId, isChecked) => {
    setSelectedItems(prev => ({
      ...prev,
      [uniqueId]: isChecked // Usa o uniqueId como chave
    }));
    // Se desmarcar, remove a observação e o código de erro associados
    if (!isChecked) {
      setItemObservations(prev => {
        const newState = { ...prev };
        delete newState[uniqueId]; // Usa o uniqueId
        return newState;
      });
      setItemErrorCodes(prev => {
        const newState = { ...prev };
        delete newState[uniqueId]; // Usa o uniqueId
        return newState;
      });
    }
  };

  const handleItemObservationChange = (uniqueId, value) => {
    setItemObservations(prev => ({
      ...prev,
      [uniqueId]: value // Usa o uniqueId como chave
    }));
  };

  // Novo handler para a mudança do código de erro do item
  const handleItemErrorCodeChange = (uniqueId, value) => {
    setItemErrorCodes(prev => ({
      ...prev,
      [uniqueId]: value // Usa o uniqueId como chave
    }));
  };

  const handleGeneralObservationChange = (e) => {
    setGeneralObservation(e.target.value);
  };

  const handleSubmit = async () => {
    // Filtra os itens processados com base no estado de seleção (que usa uniqueId)
    const itensParaDevolver = processedItems
      .filter(item => selectedItems[item.uniqueId]) // Verifica a seleção usando uniqueId
      .map(item => {
        const originalSeq = getOriginalSequencia(item); // Obtém a sequência original para o payload
        return {
          sequencia: originalSeq, // Usa a sequência original no payload
          nunota: nunota,
          observacao: itemObservations[item.uniqueId] || '', // Obtém a observação usando uniqueId
          erroCodigo: itemErrorCodes[item.uniqueId] // Obtém o código de erro usando uniqueId
        };
      });

    console.log("DEBUG itensParaDevolver:", itensParaDevolver);

    if (itensParaDevolver.length === 0) {
      setError("Selecione pelo menos um item para devolver.");
      return;
    }

    // Validação adicional: verificar se um código de erro foi selecionado para cada item marcado
    for (const item of itensParaDevolver) {
        if (!item.erroCodigo) {
            // Encontra o item original na lista processada para obter informações de exibição
            const originalItem = processedItems.find(pItem => getOriginalSequencia(pItem) === item.sequencia);
            const itemDisplay = originalItem ? `Seq: ${item.sequencia} - ${originalItem.Descricao_Produto || 'Item'}` : `item com sequência ${item.sequencia}`;
            setError(`Selecione o motivo da devolução para o ${itemDisplay}.`);
            return;
        }
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload = {
        nunota: nunota,
        itens: itensParaDevolver,
        observacaoGeral: generalObservation
      };

      // Use a URL da API do .env
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/v2/devolucao-separador/${conferenteCodigo}`;
      const response = await axios.post(apiUrl, payload);

      setSuccessMessage(response.data.mensagem || "Devolução registrada com sucesso!");
      if (onSuccess) onSuccess(response.data);

    } catch (err) {
      console.error("Erro ao registrar devolução:", err);
      const errorMessage = err.response?.data?.error || err.message || "Erro desconhecido ao registrar devolução.";
      setError(errorMessage);
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  };

  // Desabilita o botão de submit se nenhum item estiver selecionado OU se estiver carregando
  // Verifica se há pelo menos um item selecionado no estado selectedItems (que usa uniqueId)
  const isSubmitDisabled = Object.keys(selectedItems).length === 0 || Object.values(selectedItems).every(isSelected => !isSelected) || loading;


  return (
    <div className="popup-overlay">
      <div className="popup-container large">
        <div className="popup-header">
          <h3 className="popup-titulo">Devolver Itens ao Separador</h3>
          <button className="popup-fechar" onClick={onClose}>×</button>
        </div>
        <div className="popup-content">
          {loading && <div className="loading-indicator">Carregando...</div>}
          {error && <div className="error-message">{error}</div>}
          {successMessage && <div className="success-message">{successMessage}</div>}

          {!loading && !successMessage && (
            <>
              <p>Selecione os itens com problema e adicione observações:</p>
              <div className="item-list-container">
                {/* Mapeia sobre a lista de itens processados com uniqueId */}
                {processedItems && processedItems.length > 0 ? (
                  processedItems.map(item => {
                    const uniqueId = item.uniqueId; // Obtém o ID único
                    const originalSeq = getOriginalSequencia(item); // Obtém a sequência original para exibição

                    return (
                      <div key={uniqueId} className={`item-devolucao ${selectedItems[uniqueId] ? 'selected' : ''}`}> {/* Usa uniqueId como key */}
                        <input
                          type="checkbox"
                          id={`item-${uniqueId}`} // Usa uniqueId para o id
                          checked={!!selectedItems[uniqueId]} // Verifica o estado usando uniqueId
                          onChange={(e) => handleCheckboxChange(uniqueId, e.target.checked)} // Passa uniqueId para o handler
                        />
                        <label htmlFor={`item-${uniqueId}`} className="item-info"> {/* Usa uniqueId para o htmlFor */}
                          <strong>Seq:</strong> {originalSeq} {/* Exibe a sequência original */}
                          <strong> Cód:</strong> {item.Codigo_Produto ?? item.codigo_produto ?? item.codigoProduto ?? ''}
                          <strong> Lote:</strong> {item.Lote || item.lote || 'N/A'}
                          {item.Descricao_Produto && <span> {item.Descricao_Produto}</span>}
                        </label>
                        {/* Adiciona o dropdown de motivo de erro SE o item estiver selecionado */}
                        {selectedItems[uniqueId] && ( // Verifica a seleção usando uniqueId
                          <div className="item-details-inputs"> {/* Container para alinhar dropdown e textarea */}
                            <select
                                className="item-error-code-select" // Classe para estilização
                                value={itemErrorCodes[uniqueId] || ''} // Obtém o valor do estado usando uniqueId
                                onChange={(e) => handleItemErrorCodeChange(uniqueId, e.target.value)} // Passa uniqueId para o handler
                            >
                                <option value="">Selecione o motivo...</option> {/* Opção padrão */}
                                {errorOptions.map(option => (
                                    <option key={option.code} value={option.code}>
                                        {option.description}
                                    </option>
                                ))}
                            </select>
                            <textarea
                              className="item-observation-input" // Classe para estilização
                              placeholder="Observação específica (opcional)"
                              value={itemObservations[uniqueId] || ''} // Obtém o valor do estado usando uniqueId
                              onChange={(e) => handleItemObservationChange(uniqueId, e.target.value)} // Passa uniqueId para o handler
                              rows="1"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="estado-vazio">Nenhum item disponível para devolução.</div>
                )}
              </div>

              <div className="general-observation-container">
                <label htmlFor="obsGeral">Observação Geral para o Pedido:</label>
                <textarea
                  id="obsGeral"
                  className="general-observation-input"
                  value={generalObservation}
                  onChange={handleGeneralObservationChange}
                  placeholder="Observação geral sobre a devolução deste pedido (opcional)"
                  rows="3"
                />
              </div>
            </>
          )}

          {successMessage && (
            <div className="popup-footer">
              <button className="popup-cancelar" onClick={onClose}>Fechar</button>
            </div>
          )}
        </div>

        {!successMessage && (
          <div className="popup-footer">
            <button className="popup-cancelar" onClick={onClose} disabled={loading}>Cancelar</button>
            <button
              className="popup-confirmar"
              onClick={handleSubmit}
              disabled={isSubmitDisabled} // O botão fica desabilitado se nenhum item for selecionado
            >
              {loading ? 'Enviando...' : 'Registrar Devolução'}
            </button>
           </div>
        )}
      </div>
    </div>
  );
};

export default DevolucaoSeparadorPopup;
