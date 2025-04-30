import bcryptjs from 'bcryptjs';
import { usuarioModel } from "../models/users.model.js";
import jwt from 'jsonwebtoken';
import { authController } from './auth.controller.js';

// /api/v1/users/register
const register = async (req, res) => {
    try {
        const { ds_usuario, ds_senha, codsep } = req.body;
        if (!ds_usuario || !ds_senha || !codsep) {
            return res.status(400).json({ ok: false, msg: "Por favor, preencha todos os campos obrigatórios" });
        }
        // Verifica se o codsep é um número
        if (isNaN(codsep)) {
            return res.status(400).json({ ok: false, msg: "O campo codsep deve ser um número" });
        }
        // Verifica se o usuário já existe
        const userExists = await usuarioModel.findOneByUsuario(ds_usuario);
        if (userExists) {
            return res.status(409).json({ ok: false, msg: "Usuário já existe" });
        }
        // Hash da senha
        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(ds_senha, salt);
        // Criação do novo usuário
        const newUser = await usuarioModel.create({
            ds_usuario,
            ds_senha: hashedPassword,
            codsep
        });
        // Gerando o token JWT
        const token = jwt.sign(
            { ds_usuario: newUser.ds_usuario },
            process.env.JWT_SECRET,
            { expiresIn: "300h" }
        );
        return res.status(201).json({ ok: true, msg: "Usuário registrado com sucesso", token });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            msg: 'Erro ao registrar usuário'
        });
    }
};

// /api/v1/users/login
const login = async (req, res) => {
    try {
        const { ds_usuario, ds_senha } = req.body;
        if (!ds_usuario || !ds_senha) {
            return res.status(400).json({ error: "Campos em branco: usuário ou senha" });
        }
        const ds_usuarioLower = ds_usuario.toLowerCase();
        // Busca o usuário e pega o CODSEP associado
        const user = await usuarioModel.findOneByUsuario(ds_usuarioLower);
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        // Compara a senha
        const isMatch = await bcryptjs.compare(ds_senha, user.ds_senha);
        if (!isMatch) {
            return res.status(401).json({ error: "Credenciais inválidas" });
        }
        // Gera o token JWT
        const token = jwt.sign(
            { ds_usuario: user.ds_usuario, codsep: user.codsep },
            process.env.JWT_SECRET,
            { expiresIn: "300h" }
        );
        // Obtém o token atualizado da Sankhya para o usuário
        let bearerToken = await authController.getBearerToken(user.id_usuario);
        return res.json({
            ok: true,
            msg: "Login realizado com sucesso",
            token,
            bearerToken,
            codsep: user.codsep
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            msg: "Erro no servidor"
        });
    }
};

// /api/v1/users/delete
const deletar = async (req, res) => {
    try {
        const { id_usuario } = req.body;
        if (!id_usuario) {
            return res.status(400).json({ mensagem: "ID do usuário não fornecido" });
        }
        // Excluindo o usuário
        const user = await usuarioModel.deletarUser(id_usuario);
        if (!user) {
            return res.status(404).json({ mensagem: "Usuário não encontrado" });
        }
        return res.status(200).json({
            mensagem: "Usuário excluído com sucesso"
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            mensagem: "Erro ao excluir usuário"
        });
    }
};

export const usuarioController = {
    register,
    login,
    deletar
};
