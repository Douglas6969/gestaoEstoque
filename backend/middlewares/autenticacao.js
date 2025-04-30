import jwt from 'jsonwebtoken';

export function autenticacaoMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ erro: 'Token não fornecido' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const usuario = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = usuario; // Precisa ter id_usuario no payload do token!
        next();
    } catch (err) {
        return res.status(401).json({ erro: 'Token inválido ou expirado' });
    }
}
