import React, { useEffect } from 'react';
import { Check, AlertTriangle, Info, X } from 'lucide-react';

export default function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const icons = {
    success: <Check size={16} />,
    error: <AlertTriangle size={16} />,
    info: <Info size={16} />
  };

  return (
    <div className={`toast toast-${type || 'info'}`} onClick={onClose}>
      <span className="toast-icon">{icons[type] || icons.info}</span>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={onClose}><X size={14} /></button>
    </div>
  );
}
