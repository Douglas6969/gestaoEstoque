import {db} from '../database/connection.database.js' // Agora deve funcionar corretamente
import { QueryTypes } from 'sequelize';

export const associarSeparador = async (req, res) => {
    const { usuarioId, codigoSeparador } = req.body;

    if (!usuarioId || !codigoSeparador) {
        return res.status(400).json({ error: 'Usuário ID e Código Separador são obrigatórios!' });
    }

    try {
        await db.query(
            `UPDATE usuario SET codigo_separador = $1 WHERE id_usuario = $2`,
            [codigoSeparador, usuarioId]
        );

        await db.query(
            `UPDATE AD_SEPARADORNEW SET CODIGOSEPARADOR = $1 WHERE ID = $2`,
            [codigoSeparador, usuarioId]
        );

        return res.status(200).json({ message: 'Código separador associado com sucesso!' });
    } catch (error) {
        console.error('Erro ao associar separador:', error);
        return res.status(500).json({ error: 'Erro ao atualizar código separador' });
    }
};
