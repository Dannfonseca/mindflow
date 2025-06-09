import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import Map from '../models/Map.js';

const router = express.Router();

// @route   POST /api/maps
// @desc    Salva ou atualiza um mapa mental
// @access  Privado
router.post('/', authMiddleware, async (req, res) => {
    const { id, title, nodes, connections } = req.body;
    const userId = req.user.id;

    try {
        const mapFields = { user: userId, title, nodes, connections };

        let map;
        if (id) {
            map = await Map.findOneAndUpdate(
                { _id: id, user: userId },
                { $set: mapFields },
                { new: true }
            );
            if (!map) return res.status(404).json({ msg: 'Mapa não encontrado ou permissão negada' });
        } else {
            map = new Map(mapFields);
            await map.save();
        }
        
        res.status(201).json(map);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erro no servidor');
    }
});

// @route   GET /api/maps
// @desc    Busca todos os mapas de um usuário
// @access  Privado
router.get('/', authMiddleware, async (req, res) => {
    try {
        const maps = await Map.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(maps);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erro no servidor');
    }
});

// @route   DELETE /api/maps/:id
// @desc    Deleta um mapa pelo ID
// @access  Privado
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const map = await Map.findOne({ _id: req.params.id, user: req.user.id });

        if (!map) {
            return res.status(404).json({ msg: 'Mapa não encontrado ou permissão negada' });
        }

        await map.deleteOne();

        res.json({ msg: 'Mapa deletado com sucesso' });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
             return res.status(404).json({ msg: 'Mapa não encontrado' });
        }
        res.status(500).send('Erro no servidor');
    }
});

export default router;