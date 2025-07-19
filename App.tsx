
import React, { useState, useCallback } from 'react';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import type { User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);

  const handleLogin = useCallback(() => {
    // In a real app, this would involve authentication. For this demo, we set a mock user.
    setUser({ name: 'Dr(a). Psiquiatra', role: 'Psychiatrist' });
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <div className="bg-brand-background text-brand-text-primary font-sans h-screen w-screen overflow-hidden">
      {user ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;
