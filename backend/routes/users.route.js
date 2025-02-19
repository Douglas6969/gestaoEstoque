import {Router} from "express"
import { usuarioController } from "../controllers/users.controller.js"

const router = Router()

router.post('/register', usuarioController.register)
router.post('/login', usuarioController.login)
router.delete('/deletar', usuarioController.deletar)


export default router;

