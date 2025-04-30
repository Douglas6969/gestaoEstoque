// controllers/verificarSeConferentePorCodsep.controller.js
import { db } from '../../database/connection.database.js';

export const verificarSeConferentePorCodsep = async (req, res) => {
    try {
        const { codsep } = req.params;
        if (!codsep || isNaN(codsep)) {
            return res.status(400).json({ erro: "Codsep inválido" });
        }

        const result = await db.query(
            'SELECT perfil FROM usuario WHERE codsep = $1',
            [codsep]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ isConferente: false });
        }

        const perfil = result.rows[0].perfil;
        return res.json({ isConferente: perfil === 'conferente' });
    } catch (err) {
        console.error("Erro ao verificar perfil conferente por codsep:", err);
        return res.status(500).json({ erro: "Erro no servidor ao verificar perfil." });
    }
};
