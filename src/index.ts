import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import mongoose from "mongoose";
import cors from 'cors'; 
import usuarioRoutes from './routes/usuarioRoutes'; 
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import eventoRoutes from './routes/eventoRoutes';
import { UserService } from './services/usuarioServices';  
import valoracionRoutes from './routes/valoracionRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

// ------------ CORS CONFIG ------------ //
app.use(cors({
  origin: [
    'http://localhost:4200',     // dev
    'http://localhost:8080',     // dev docker
    'https://ea2.upc.edu',       // producción front
    'https://ea2-api.upc.edu',   // producción backend
  ],
  credentials: true,
}));

app.use(express.json());

// ------------ SWAGGER ------------ //
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ------------ DATABASE ------------ //
const mongoURL = process.env.MONGO_URL || "mongodb://mongo:27017/BBDD";

mongoose.connect(mongoURL)
  .then(async () => {
    console.log('MongoDB conectado correctamente:', mongoURL);

    const usuarioServices = new UserService();
    await usuarioServices.createAdminUser();

    app.listen(PORT, () => {
      console.log(`Backend escuchando en http://localhost:${PORT}`);
      console.log(`Swagger en http://localhost:${PORT}/api-docs`);
    });
  })
  .catch(err => {
    console.error('Error al conectar a MongoDB:', err);
  });

// ------------ ROUTES ------------ //
app.use('/api/user', usuarioRoutes);
app.use('/api/event', eventoRoutes);
app.use('/api/ratings', valoracionRoutes);
