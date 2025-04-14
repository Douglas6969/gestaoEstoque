// auth.route.js
import express from 'express';
import { authController } from '../controllers/auth.controller.js'; // Importação correta

const router = express.Router();

// login Sankhya 
router.post('/login', authController.loginToSankhya);


//logout 
router.post('/logout/:id_usuario', async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const result = await authController.logoutFromSankhya(id_usuario);
        res.json(result);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao fazer logout' });
    }
});


export default router;
