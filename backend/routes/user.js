// Arquivo: /routes/user.js
// Descrição: Novas rotas para gerenciamento de dados do usuário, como alteração de senha.
import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// @route   POST /api/user/change-password
// @desc    Altera a senha do usuário logado
// @access  Privado
router.post('/change-password', authMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ msg: 'Por favor, forneça a senha atual e a nova senha.' });
    }
    
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'Usuário não encontrado' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'A senha atual está incorreta.' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        await user.save();

        res.json({ msg: 'Senha alterada com sucesso!' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erro no servidor');
    }
});

export default router;