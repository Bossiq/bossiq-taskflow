import React, { useEffect } from 'react';

export default function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  };

  return (
    <div className={`toast toast-${type || 'info'}`} onClick={onClose}>
      <span className="toast-icon">{icons[type] || icons.info}</span>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={onClose}>×</button>
    </div>
  );
}
