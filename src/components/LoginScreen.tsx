import React, { useEffect, useState } from 'react';
import { LOGO_URL } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { HiUserCircle as UserCircle } from 'react-icons/hi';

const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await login();
      navigate('/');
    } catch (error) {
      console.error('Login failed:', error);
      setError('Falha no login. Por favor, tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

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
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full py-4 px-6 rounded-lg bg-accent-primary hover:bg-accent-primary-hover text-white font-bold text-lg transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span>Entrando...</span>
          ) : (
            <>
              <UserCircle className="w-6 h-6" />
              <span>Entrar com Microsoft</span>
            </>
          )}
        </button>
        
        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;