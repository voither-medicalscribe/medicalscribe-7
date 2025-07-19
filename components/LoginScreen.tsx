import React from 'react';
import { LOGO_URL } from '../constants';

interface LoginScreenProps {
  onLogin: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-brand-background">
      <div className="w-full max-w-md p-8 space-y-8 bg-brand-surface rounded-2xl shadow-neumorphic">
        <div className="text-center">
            <img src={LOGO_URL} alt="Voither MedicalScribe Logo" className="w-64 mx-auto mb-4" />
            <p className="mt-2 text-brand-text-secondary">
                Bem-vindo ao sistema de assistência clínica para saúde mental.
            </p>
        </div>
        <button
          onClick={onLogin}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 font-semibold text-white bg-accent-primary rounded-lg shadow-md hover:shadow-lg hover:bg-accent-primary-hover transition-all duration-300"
        >
          Entrar no Sistema
        </button>
      </div>
    </div>
  );
};

export default LoginScreen;