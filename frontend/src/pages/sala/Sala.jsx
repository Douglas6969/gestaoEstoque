import { useParams, Navigate } from "react-router-dom";

const Sala = () => {
    const { id } = useParams();

    // Expressão regular para validar um UUID v4
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    if (!isValidUUID) {
        return <Navigate to="/" />; // Redireciona para a página inicial se o ID for inválido
    }

    return (
        <div>
            <h1>Bem-vindo à sala</h1>
            <p>ID da sala: {id}</p>
        </div>
    );
};

export default Sala;
