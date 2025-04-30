import React from "react";
import { Route, Routes } from "react-router-dom";
import Login from "../pages/Login/login";
import Home from "../pages/Home/Home";
import ListaSeparacao from "../pages/listaSeparacao/listaSeparacao";
import DetalhesPedido from "../pages/detalhesPedido/detalhesPedidos";
import PerfilUsuario from "../pages/perfil/PerfilUsuario";
import ConferenciaPedido from "../pages/listConf/ConferenciaPedido";
import Etiquetas from "../pages/etiquetas/etiquetas";
import IniciarConferencia from "../pages/iniciarConferencia/IniciarConferencia";

function Rotas() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/home" element={<Home />} />
      <Route path="/lista" element={<ListaSeparacao />} />
      <Route path="/detalhes/:nroUnico" element={<DetalhesPedido />} /> 
      <Route path="/perfil" element={<PerfilUsuario/>}/>
      <Route path="/conferencia/:nroUnico/:conferenteCodigo" element={<ConferenciaPedido />} />
      <Route path="/etiquetas/:conferenteCodigo/:nroUnico" element={<Etiquetas />} />
      <Route path="/iniciar-conferencia/:conferenteCodigo" element={<IniciarConferencia />} />

    </Routes>
  );
}

export default Rotas;