// Arquivo: server.js
// Descrição: Adicionada configuração de CORS explícita para o ambiente de produção.
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import mapsRoutes from './routes/maps.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import authMiddleware from './middleware/authMiddleware.js';
import adminMiddleware from './middleware/adminMiddleware.js';

dotenv.config();
const app = express();

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

// --- CONFIGURAÇÃO DE CORS ATUALIZADA ---
// Define a URL do frontend que tem permissão para acessar esta API.
const corsOptions = {
  origin: 'https://mindflow-site.onrender.com'
};
app.use(cors(corsOptions));
// --- FIM DA CONFIGURAÇÃO DE CORS ---

app.use(express.json());

app.get('/', (req, res) => res.send('API do MindFlow está rodando!'));

app.use('/api/auth', authRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', authMiddleware, adminMiddleware, adminRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
