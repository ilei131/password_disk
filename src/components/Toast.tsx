import React, { useEffect } from 'react';
import './Toast.css';

interface ToastProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ isOpen, message, onClose }) => {
  useEffect(() => {
    if (isOpen) {
      // 2秒后自动关闭
      const timer = setTimeout(() => {
        onClose();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="toast-alert">
      <div className="toast-content">
        <p>{message}</p>
      </div>
    </div>
  );
};
