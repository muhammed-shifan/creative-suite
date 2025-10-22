import React, { useState } from 'react';
import { UserIcon } from './icons/UserIcon';
import { LockIcon } from './icons/LockIcon';
import { FingerprintIcon } from './icons/FingerprintIcon';
import { ScanIcon } from './icons/ScanIcon';
import { SmileyIcon } from './icons/SmileyIcon';

// --- Reusable Theme Toggle Component ---
const SunIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
);

const MoonIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
);

interface ThemeToggleProps {
  theme: string;
  toggleTheme: () => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, toggleTheme }) => {
  const isDark = theme === 'dark';
  return (
    <label className="relative inline-flex items-center cursor-pointer" title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}>
      <input type="checkbox" checked={isDark} onChange={toggleTheme} className="sr-only peer" />
      <div className="w-14 h-7 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 transition-colors duration-300"></div>
      <div className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 peer-checked:translate-x-7 flex items-center justify-center">
        <SunIcon className={`w-3 h-3 text-yellow-500 transition-opacity duration-300 ${isDark ? 'opacity-0' : 'opacity-100'}`} />
        <MoonIcon className={`w-3 h-3 text-blue-600 absolute transition-opacity duration-300 ${isDark ? 'opacity-100' : 'opacity-0'}`} />
      </div>
    </label>
  );
};
// --- End Theme Toggle Component ---


interface LoginProps {
  onLogin: () => void;
  theme: string;
  setTheme: (theme: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, theme, setTheme }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      onLogin();
    } else {
      alert('Please enter both username and password.');
    }
  };
  
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="flex items-center justify-center min-h-screen text-white p-4 font-sans">
      <div className="w-full max-w-sm bg-black/30 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-white/10">
        <div className="text-center mb-10 login-form-element" style={{ fontFamily: "'Pacifico', cursive", animationDelay: '0s' }}>
          <h1 className="text-5xl text-glow">Welcome</h1>
          <h2 className="text-6xl text-glow">Creative Suite AI</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative flex items-center login-form-element" style={{ animationDelay: '0.1s' }}>
             <UserIcon className="absolute left-4 w-5 h-5 text-gray-400" />
             <input
              id="username"
              name="username"
              type="text"
              required
              className="w-full pl-12 pr-4 py-3 border border-blue-500/50 bg-black/20 rounded-xl placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all shadow-inner"
              placeholder="Username or email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-label="Username or email"
            />
          </div>

          <div className="relative flex items-center login-form-element" style={{ animationDelay: '0.2s' }}>
            <LockIcon className="absolute left-4 w-5 h-5 text-gray-400" />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full pl-12 pr-4 py-3 border border-blue-500/50 bg-black/20 rounded-xl placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all shadow-inner"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Password"
            />
          </div>

          <div className="login-form-element" style={{ animationDelay: '0.3s' }}>
            <button
              type="submit"
              className="w-full flex justify-center py-3 px-4 border border-transparent text-base font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 focus:ring-offset-gray-900 transition-all shadow-lg"
            >
              Log in
            </button>
          </div>
        </form>

        <div className="mt-8 space-y-6 text-gray-300">
           <div className="flex items-center justify-between text-sm login-form-element" style={{ animationDelay: '0.4s' }}>
                <span>Light / Dark Mode</span>
                <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
           </div>
           
           <div className="flex items-center justify-between login-form-element" style={{ animationDelay: '0.5s' }}>
                <div className="flex items-center gap-4">
                    <button disabled title="Fingerprint Login (Coming Soon)" className="transition-transform hover:scale-110 opacity-50 cursor-not-allowed"><FingerprintIcon className="w-8 h-8 text-blue-400" /></button>
                    <button disabled title="Face Scan Login (Coming Soon)" className="transition-transform hover:scale-110 opacity-50 cursor-not-allowed"><ScanIcon className="w-8 h-8 text-blue-400" /></button>
                </div>
                <div className="flex items-center gap-2 text-xs bg-black/20 p-2 rounded-lg">
                    <SmileyIcon className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    <span>Tip: Use a strong password</span>
                </div>
           </div>
        </div>

        <div className="mt-12 text-center text-xs text-gray-500 login-form-element" style={{ animationDelay: '0.6s' }}>
          <p>
            <a href="#" onClick={(e) => { e.preventDefault(); alert('Privacy Policy page coming soon!'); }} className="hover:underline">Privacy</a> &middot; 
            <a href="#" onClick={(e) => { e.preventDefault(); alert('Terms of Service page coming soon!'); }} className="hover:underline"> Terms</a> &middot; 
            <a href="#" onClick={(e) => { e.preventDefault(); alert('Support page coming soon!'); }} className="hover:underline"> Support</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;