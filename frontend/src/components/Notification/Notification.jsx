import React, { useEffect } from 'react';
import './Notification.css';

const Notification = ({ notification, onClose }) => {
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000); // Tempo visível: 5 segundos
      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  if (!notification) {
    return null;
  }

  const { mensagem, tipo } = notification;

  return (
    <div className={`notification ${tipo}`}>
      <p>{mensagem}</p>
      <button onClick={onClose} className="notification-close">&times;</button>
    </div>
  );
};

export default Notification;
