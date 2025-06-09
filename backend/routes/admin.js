// Arquivo: /routes/admin.js
// Descrição: Novas rotas para gerenciamento de usuários pelo administrador, incluindo criação de novos usuários.
import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const router = express.Router();

// @route   GET /api/admin/users
// @desc    Lista todos os usuários
// @access  Admin
router.get('/users', async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erro no servidor');
    }
});

// @route   POST /api/admin/users
// @desc    Cria um novo usuário
// @access  Admin
router.post('/users', async (req, res) => {
    const { firstName, lastName, username, birthDate, email, password, role } = req.body;

    if (!firstName || !lastName || !username || !birthDate || !email || !password || !role) {
        return res.status(400).json({ msg: 'Por favor, preencha todos os campos.' });
    }

    try {
        let userByEmail = await User.findOne({ email });
        if (userByEmail) {
            return res.status(400).json({ msg: 'Já existe uma conta com este e-mail' });
        }

        let userByUsername = await User.findOne({ username });
        if (userByUsername) {
            return res.status(400).json({ msg: 'Este nome de usuário já está em uso' });
        }

        let user = new User({
            firstName,
            lastName,
            username,
            birthDate,
            email,
            password,
            role
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();
        
        const userResponse = await User.findById(user.id).select('-password');
        res.status(201).json(userResponse);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erro no servidor');
    }
});


// @route   PUT /api/admin/users/:id
// @desc    Atualiza um usuário
// @access  Admin
router.put('/users/:id', async (req, res) => {
    const { firstName, lastName, username, email, role } = req.body;
    const { id } = req.params;

    try {
        let user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ msg: 'Usuário não encontrado' });
        }

        user.firstName = firstName || user.firstName;
        user.lastName = lastName || user.lastName;
        user.username = username || user.username;
        user.email = email || user.email;
        user.role = role || user.role;

        await user.save();
        
        const updatedUser = await User.findById(user.id).select('-password');
        res.json(updatedUser);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erro no servidor');
    }
});

// @route   DELETE /api/admin/users/:id
// @desc    Deleta um usuário
// @access  Admin
router.delete('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ msg: 'Usuário não encontrado' });
        }

        await user.deleteOne();
        res.json({ msg: 'Usuário deletado com sucesso' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erro no servidor');
    }
});

export default router;