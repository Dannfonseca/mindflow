import mongoose from 'mongoose';
const { Schema } = mongoose;

const MapSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User', // Cria uma referência ao nosso modelo de Usuário
        required: true
    },
    title: {
        type: String,
        required: true,
        default: 'Mapa Mental Sem Título'
    },
    nodes: {
        type: Array,
        default: []
    },
    connections: {
        type: Array,
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model('Map', MapSchema);