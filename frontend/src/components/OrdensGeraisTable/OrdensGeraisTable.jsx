    // src/components/OrdensGeraisTable.jsx
    import React, { useEffect, useState } from 'react';
    import axios from 'axios';
    import {
      Box,
      Table,
      Thead,
      Tbody,
      Tr,
      Th,
      Td,
      TableCaption,
      Spinner,
      Alert,
      AlertIcon,
      Text,
      Heading,
      VStack,
      Input,
      InputGroup,
      InputLeftElement,
    } from '@chakra-ui/react';
    import { SearchIcon } from '@chakra-ui/icons';

    // Define a URL base da API usando a variável de ambiente
    const API_BASE_URL = import.meta.env.VITE_API_URL;

    const OrdensGeraisTable = () => {
      const [ordens, setOrdens] = useState([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [filterText, setFilterText] = useState('');

      useEffect(() => {
        const fetchOrdens = async () => {
          try {
            setLoading(true);
            setError(null); // Limpa erros anteriores
            // Constrói a URL usando a variável de ambiente e o prefixo /api/v3
            const apiUrl = `${API_BASE_URL}/api/v3/ordens-gerais`;
            console.log('Chamando API de Ordens Gerais:', apiUrl); // Log para debug

            const response = await axios.get(apiUrl);

            if (response.data && Array.isArray(response.data.ordens)) {
              setOrdens(response.data.ordens);
            } else if (response.data && response.data.error) {
               // Se a API retornar um objeto com 'error', trate como erro
               setError(response.data.error);
               setOrdens([]); // Garante que a lista esteja vazia em caso de erro
            }
             else {
              // Tratar caso a API retorne sucesso, mas com dados inesperados ou vazios
               setOrdens([]); // Garante que a lista esteja vazia
               setError('Formato de dados inesperado da API ou lista de ordens vazia.');
            }
          } catch (err) {
            console.error('Erro ao buscar ordens gerais:', err);
            // Extrair mensagem de erro mais detalhada se disponível
            const errorMessage = err.response?.data?.details || err.message || 'Erro desconhecido ao carregar ordens.';
            setError(errorMessage);
             setOrdens([]); // Garante que a lista esteja vazia em caso de erro
          } finally {
            setLoading(false);
          }
        };

        fetchOrdens();
      }, []);

      const filteredOrdens = ordens.filter(ordem => {
        const searchString = filterText.toLowerCase();
        // Verificações de null/undefined antes de chamar toLowerCase()
        return (
          (ordem.Nro_Unico?.toString().toLowerCase().includes(searchString)) ||
          (ordem.Status?.toLowerCase().includes(searchString)) ||
          (ordem.Des_Prioridade?.toLowerCase().includes(searchString)) ||
          (ordem.Cliente?.toLowerCase().includes(searchString)) ||
          (ordem.Data?.toLowerCase().includes(searchString)) ||
          (ordem.Nome_Separador?.toLowerCase().includes(searchString))
          // Adicione mais campos conforme necessário para o filtro
        );
      });


      if (loading) {
        return (
          <Box textAlign="center" mt={10}>
            <Spinner size="xl" />
            <Text mt={2}>Carregando ordens gerais...</Text>
          </Box>
        );
      }

      if (error) {
        return (
          <Alert status="error" mt={4}>
            <AlertIcon />
            Erro ao carregar ordens gerais: {error}
          </Alert>
        );
      }

      return (
        <VStack spacing={4} align="stretch">
           <Heading size="lg">Ordens de Carga Gerais</Heading>
           <InputGroup>
              <InputLeftElement pointerEvents="none">
                 <SearchIcon color="gray.300" />
              </InputLeftElement>
              <Input
                 placeholder="Filtrar por Nro Único, Status, Cliente, Separador, etc."
                 value={filterText}
                 onChange={(e) => setFilterText(e.target.value)}
              />
           </InputGroup>
           {filteredOrdens.length === 0 && ordens.length > 0 && (
              <Text>Nenhuma ordem encontrada com o filtro atual.</Text>
           )}
           {filteredOrdens.length === 0 && ordens.length === 0 && (
              <Text>Nenhuma ordem de carga encontrada com os critérios especificados.</Text>
           )}

          {filteredOrdens.length > 0 && (
             <Box overflowX="auto">
                <Table variant="simple" size="sm">
                  <TableCaption>Lista de Ordens de Carga com Status 'Separação Iniciada'</TableCaption>
                  <Thead>
                    <Tr>
                      <Th>Nro Único</Th>
                      <Th>Status</Th>
                      <Th>Prioridade</Th>
                      <Th>Cliente</Th>
                      <Th isNumeric>Qtd Vol.</Th>
                      <Th>Data</Th>
                      <Th>Ordem</Th>
                      <Th>Separador</Th>
                      {/* Adicione mais colunas conforme necessário */}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filteredOrdens.map((ordem) => (
                      <Tr key={ordem.key || ordem.Nro_Unico}> {/* Use key ou Nro_Unico como key */}
                        <Td>{ordem.Nro_Unico}</Td>
                        <Td>{ordem.Status}</Td>
                        <Td>{ordem.Des_Prioridade}</Td>
                        <Td>{ordem.Cliente}</Td>
                        <Td isNumeric>{ordem.Qtd_Vol}</Td>
                        <Td>{ordem.Data}</Td>
                        <Td>{ordem.Ordem}</Td>
                        <Td>{ordem.Nome_Separador}</Td>
                        {/* Renderize mais dados aqui */}
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
             </Box>
          )}
        </VStack>
      );
    };

    export default OrdensGeraisTable;
