import React, { createContext, useState, useContext, useEffect } from 'react';
import { db } from '../../backend/src/database/connection.database'; // Importa a simulação do DB

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    // Simula o estado de autenticação
    const [user, setUser] = useState(null); // { id_usuario, codsep, is_admin }
    const [loading, setLoading] = useState(true);

    // Função de login simulada
    const login = async (codsep) => {
         setLoading(true);
         try {
             // Simula a busca do usuário no DB local pela simulação
             // Em um app real, faria uma chamada para um endpoint de login no backend
             const result = await db.query('SELECT id_usuario, codsep, is_admin FROM usuario WHERE codsep = $1', [parseInt(codsep, 10)]);
             if (result.rows.length > 0) {
                 const userData = result.rows[0];
                 setUser(userData);
                 localStorage.setItem('authenticatedUserId', userData.id_usuario); // Armazena o ID para o interceptor
                 console.log('Usuário logado simulado:', userData);
                 return userData;
             } else {
                 setUser(null);
                 localStorage.removeItem('authenticatedUserId');
                 console.log('Usuário não encontrado com codsep:', codsep);
                 throw new Error('Usuário não encontrado');
             }
         } catch (error) {
             console.error('Erro no login simulado:', error);
             setUser(null);
             localStorage.removeItem('authenticatedUserId');
             throw error; // Propaga o erro para o componente que chamou login
         } finally {
             setLoading(false);
         }
    };

    // Função de logout
    const logout = () => {
        setUser(null);
        localStorage.removeItem('authenticatedUserId');
        console.log('Logout simulado');
    };

    // Tenta carregar o usuário ao iniciar (se o ID estiver no localStorage)
    useEffect(() => {
        const storedUserId = localStorage.getItem('authenticatedUserId');
        if (storedUserId) {
             // Busca as informações completas do usuário no DB simulado
             db.query('SELECT id_usuario, codsep, is_admin FROM usuario WHERE id_usuario = $1', [parseInt(storedUserId, 10)])
                .then(result => {
                    if (result.rows.length > 0) {
                        setUser(result.rows[0]);
                        console.log('Usuário restaurado do localStorage:', result.rows[0]);
                    } else {
                        localStorage.removeItem('authenticatedUserId'); // Limpa se o usuário não for encontrado
                    }
                })
                .catch(error => {
                    console.error('Erro ao restaurar usuário do localStorage:', error);
                    localStorage.removeItem('authenticatedUserId');
                })
                .finally(() => setLoading(false));
        } else {
             setLoading(false);
        }
    }, []);


    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
