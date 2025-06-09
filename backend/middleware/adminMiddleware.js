// Arquivo: /middleware/adminMiddleware.js
// Descrição: Middleware atualizado para verificar se o usuário autenticado tem a função de 'admin' ou 'subadmin'.
const adminMiddleware = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'subadmin')) {
        next();
    } else {
        res.status(403).json({ msg: 'Acesso negado. Rota exclusiva para administradores.' });
    }
};

export default adminMiddleware;