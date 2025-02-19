import React from "react";
import { Route, Routes } from "react-router-dom";
import Login from "../pages/Login/login";
import Home from "../pages/Home/Home";
import ListaSeparacao from "../pages/listaSeparacao/listaSeparacao";
import DetalhesPedido from "../pages/detalhesPedido/detalhesPedidos";

import PerfilUsuario from "../pages/perfil/PerfilUsuario";

function Rotas() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/home" element={<Home />} />
      <Route path="/lista" element={<ListaSeparacao />} />
      <Route path="/detalhes/:nroUnico" element={<DetalhesPedido />} /> 
      <Route path="/perfil" element={<PerfilUsuario/>}/>
    </Routes>
  );
}

export default Rotas;