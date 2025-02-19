// empresa.model.js

import { db } from '../database/connection.database.js'; // Ajuste conforme necessário

// Função para criar uma nova empresa
const create = async ({ ds_razao, ds_fantasia, nr_cnpj, ds_email }) => {
    const query = {
        text: `
            INSERT INTO empresa (ds_razao, ds_fantasia, nr_cnpj, ds_email)
            VALUES ($1, $2, $3, $4)
            RETURNING *`,
        values: [ds_razao, ds_fantasia, nr_cnpj, ds_email]
    };
    const { rows } = await db.query(query);
    return rows[0]; // Retorna a empresa criada
};

// Função para listar todas as empresas
const listarTodos = async () => {
    const query = {
        text: `SELECT * FROM empresa`
    };
    const { rows } = await db.query(query);
    return rows; // Retorna todas as empresas
};

// Função para atualizar uma empresa
const update = async (id, { ds_razao, ds_fantasia, nr_cnpj, ds_email }) => {
    const query = {
        text: `
            UPDATE empresa
            SET ds_razao = $1, ds_fantasia = $2, nr_cnpj = $3, ds_email = $4
            WHERE id_empresa = $5
            RETURNING *`,
        values: [ds_razao, ds_fantasia, nr_cnpj, ds_email, id]
    };
    const { rows } = await db.query(query);
    return rows[0]; // Retorna a empresa atualizada
};

// Função para deletar uma empresa
const deletarEmpresa = async (id) => {
    const query = {
        text: `
            DELETE FROM empresa
            WHERE id_empresa = $1
            RETURNING *`,
        values: [id]
    };
    
    const { rows } = await db.query(query);
    return rows[0]; // Retorna a empresa deletada
};

export const empresaModel = {
    create,
    listarTodos,
    update,
    deletarEmpresa
};
