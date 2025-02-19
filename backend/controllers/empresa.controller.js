// empresa.controller.js

import { empresaModel } from '../models/empresa.model.js'; // Certifique-se de que o caminho está correto

// Função para criar uma nova empresa
const criarEmpresa = async (req, res) => {
    try {
        const { ds_razao, ds_fantasia, nr_cnpj, ds_email } = req.body;

        // Validação simples
        if (!ds_razao || !ds_fantasia || !nr_cnpj || !ds_email) {
            return res.status(400).json({ ok: false, msg: "Todos os campos são obrigatórios." });
        }

        // Criação da empresa
        const novaEmpresa = await empresaModel.create({ ds_razao, ds_fantasia, nr_cnpj, ds_email });
        return res.status(201).json({ ok: true, msg: "Empresa criada com sucesso!", empresa: novaEmpresa });
    } catch (error) {
        console.error('Erro ao criar a empresa:', error);
        return res.status(500).json({ ok: false, msg: "Erro ao criar a empresa." });
    }
};

// Função para editar uma empresa existente
const editarEmpresa = async (req, res) => {
    const { id } = req.params; // Obtém o ID da empresa da URL
    const { ds_razao, ds_fantasia, nr_cnpj, ds_email } = req.body;

    try {
        const empresaAtualizada = await empresaModel.update(id, { ds_razao, ds_fantasia, nr_cnpj, ds_email });

        if (!empresaAtualizada) {
            return res.status(404).json({ ok: false, msg: "Empresa não encontrada." });
        }

        return res.status(200).json({ ok: true, msg: "Empresa atualizada com sucesso!", empresa: empresaAtualizada });
    } catch (error) {
        console.error('Erro ao atualizar a empresa:', error);
        return res.status(500).json({ ok: false, msg: "Erro ao atualizar a empresa." });
    }
};

// Função para deletar uma empresa
const deletarEmpresa = async (req, res) => {
    const { id } = req.params; // Obtém o ID da empresa da URL

    try {
        const empresaDeletada = await empresaModel.deletarEmpresa(id);

        if (!empresaDeletada) {
            return res.status(404).json({ ok: false, msg: "Empresa não encontrada." });
        }

        return res.status(200).json({ ok: true, msg: "Empresa deletada com sucesso!" });
    } catch (error) {
        console.error('Erro ao deletar a empresa:', error);
        return res.status(500).json({ ok: false, msg: "Erro ao deletar a empresa." });
    }
};

// Função para listar todas as empresas
const listarEmpresas = async (req, res) => {
    try {
        const empresas = await empresaModel.listarTodos();
        return res.status(200).json({ ok: true, empresas });
    } catch (error) {
        console.error('Erro ao listar empresas:', error);
        return res.status(500).json({ ok: false, msg: "Erro ao listar empresas." });
    }
};

// Exportando as funções do controller
export const empresaController = {
    criarEmpresa,
    editarEmpresa,
    deletarEmpresa,
    listarEmpresas
};
