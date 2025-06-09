// Arquivo: server.js
// Descrição: Adicionadas as novas rotas de admin e seus middlewares de proteção.
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import mapsRoutes from './routes/maps.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js'; // <-- 1. IMPORTAR ROTAS DE ADMIN
import authMiddleware from './middleware/authMiddleware.js'; // <-- 2. IMPORTAR MIDDLEWARES
import adminMiddleware from './middleware/adminMiddleware.js';

// Configuração inicial
dotenv.config();
const app = express();

// Conectar ao Banco de Dados
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Conectado...');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());

// Rota de Teste
app.get('/', (req, res) => res.send('API do MindFlow está rodando!'));

// Definir Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', authMiddleware, adminMiddleware, adminRoutes); // <-- 3. USAR NOVAS ROTAS COM PROTEÇÃO

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));