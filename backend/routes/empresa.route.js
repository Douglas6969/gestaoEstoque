// empresa.route.js

import { Router } from "express";
import { empresaController } from "../controllers/empresa.controller.js";

const router = Router();


router.post('/', empresaController.criarEmpresa);


router.get('/', empresaController.listarEmpresas);


router.put('/:id', empresaController.editarEmpresa);


router.delete('/:id', empresaController.deletarEmpresa);

export default router;
