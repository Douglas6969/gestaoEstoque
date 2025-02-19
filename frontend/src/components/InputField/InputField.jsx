import React from "react";
import "./inputField.css"; // Arquivo de estilos específico para o componente

const InputField = ({ type, placeholder, value, onChange }) => {
    return (
        <input
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            className="input-field"
        />
    );
}

export default InputField;
