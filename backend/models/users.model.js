import { db } from '../database/connection.database.js'

const create = async({ ds_usuario, ds_senha, codsep }) => {
    const query ={
        text: `
        INSERT INTO usuario (ds_usuario, ds_senha, codsep)
        VALUES ($1, $2, $3)
        RETURNING ds_usuario, ds_senha, id_usuario, codsep`,
        values: [ds_usuario, ds_senha, codsep]
    };

    const { rows } = await db.query(query);
    return rows[0];
}


const findOneByUsuario = async(ds_usuario) => {
    const query = {
        text: `
        SELECT * FROM usuario
        WHERE DS_USUARIO = $1`,
        values: [ds_usuario],
    };
    const { rows } = await db.query(query);
    return rows[0];
}

const deletarUser = async (id_usuario) => {
    const query = {
        text: `
        DELETE FROM usuario
        WHERE id_usuario = $1
        RETURNING *`,
        values: [id_usuario],
    };

    try {
        const { rows } = await db.query(query);
        return rows[0]; // Retorna o usuário deletado, ou `undefined` se não existir
    } catch (error) {
        console.error('Erro ao deletar usuário:', error);
        throw error; // Lança o erro para ser tratado pela função que chamar `deletarUser`
    }
};

export const usuarioModel = {
    create,
    findOneByUsuario,
    deletarUser
}
