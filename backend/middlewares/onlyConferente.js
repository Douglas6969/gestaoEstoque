import { db } from '../database/connection.database.js';

export async function onlyConferente(req, res, next) {
    try {
        // Checagem básica de autenticação (depende do seu middleware de autenticação)
        const usuarioReq = req.usuario;
        if (!usuarioReq || !usuarioReq.id_usuario) {
            return res.status(401).json({ erro: "Usuário não autenticado!" });
        }

        // Consulta no banco de dados
        const result = await db.query(
            'SELECT perfil FROM usuario WHERE id_usuario = $1 LIMIT 1',
            [usuarioReq.id_usuario]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ erro: "Usuário não encontrado!" });
        }

        const perfil = result.rows[0].perfil;

        if (perfil !== 'conferente') {
            return res.status(403).json({ erro: "Acesso permitido apenas para conferente!" });
        }

        // Usuário é conferente, prossegue
        next();
    } catch (err) {
        console.error('Erro no middleware onlyConferenteDB:', err);
        return res.status(500).json({ erro: "Erro interno ao validar perfil de conferente." });
    }
}
