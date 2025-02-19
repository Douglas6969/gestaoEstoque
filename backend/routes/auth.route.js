// auth.route.js
import express from 'express';
import { authController } from '../controllers/auth.controller.js'; // Importação correta

const router = express.Router();

// login Sankhya 
router.post('/login', authController.loginToSankhya);


//logout 
router.post('/logout', authController.logoutFromSankhya);

export default router;
