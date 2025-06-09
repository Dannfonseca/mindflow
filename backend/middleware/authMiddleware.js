import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
    // Pega o token do cabeçalho da requisição
    const token = req.header('x-auth-token');

    // Verifica se não há token
    if (!token) {
        return res.status(401).json({ msg: 'Nenhum token, autorização negada' });
    }

    // Verifica se o token é válido
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next(); // Passa para a próxima etapa da rota
    } catch (err) {
        res.status(401).json({ msg: 'Token não é válido' });
    }
};

export default authMiddleware;