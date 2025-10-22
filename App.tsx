
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import VideoEditor from './components/VideoEditor';
import PhotoEditor from './components/PhotoEditor';
import Chatbot from './components/Chatbot';
import AudioEditor from './components/AudioEditor';
import { VideoIcon } from './components/icons/VideoIcon';
import { PhotoIcon } from './components/icons/PhotoIcon';
import { ChatIcon } from './components/icons/ChatIcon';
import { AudioIcon } from './components/icons/AudioIcon';
import { EditorTab } from './types';

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
      <div className="w-14 h-7 bg-gray-400 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-400 dark:bg-gray-700 rounded-full peer peer-checked:bg-indigo-600 transition-colors duration-300"></div>
      <div className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 peer-checked:translate-x-7 flex items-center justify-center">
        <SunIcon className={`w-3 h-3 text-yellow-500 transition-opacity duration-300 ${isDark ? 'opacity-0' : 'opacity-100'}`} />
        <MoonIcon className={`w-3 h-3 text-indigo-600 absolute transition-opacity duration-300 ${isDark ? 'opacity-100' : 'opacity-0'}`} />
      </div>
    </label>
  );
};
// --- End Theme Toggle Component ---


const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>(EditorTab.Photo);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
  };

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(theme === 'dark' ? 'light' : 'dark');
    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    if (!isLoggedIn) {
      document.body.classList.add('login-background-active');
    } else {
      document.body.classList.remove('login-background-active');
    }
    return () => {
      document.body.classList.remove('login-background-active');
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setActiveTab(EditorTab.Photo);
            break;
          case '2':
            e.preventDefault();
            setActiveTab(EditorTab.Video);
            break;
          case '3':
            e.preventDefault();
            setActiveTab(EditorTab.Audio);
            break;
          case '4':
            e.preventDefault();
            setActiveTab(EditorTab.Chat);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLoggedIn]);

  const renderContent = () => {
    switch (activeTab) {
      case EditorTab.Video:
        return <VideoEditor theme={theme} />;
      case EditorTab.Photo:
        return <PhotoEditor theme={theme} />;
      case EditorTab.Audio:
        return <AudioEditor theme={theme} />;
      case EditorTab.Chat:
        return <Chatbot theme={theme} />;
      default:
        return <PhotoEditor theme={theme} />;
    }
  };
  
  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} theme={theme} setTheme={setTheme} />;
  }

  const tabs = [
    { id: EditorTab.Photo, label: 'Photo Editor', icon: <PhotoIcon />, shortcut: 'Alt+1' },
    { id: EditorTab.Video, label: 'Video Editor', icon: <VideoIcon />, shortcut: 'Alt+2' },
    { id: EditorTab.Audio, label: 'Audio Editor', icon: <AudioIcon />, shortcut: 'Alt+3' },
    { id: EditorTab.Chat, label: 'AI Chatbot', icon: <ChatIcon />, shortcut: 'Alt+4' },
  ];

  return (
    <div className="flex flex-col h-screen text-gray-700 dark:text-gray-200 font-sans">
      <header className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-lg shadow-xl z-10 border-b border-black/5 dark:border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-3">
             <h1 className="text-xl font-bold text-gray-900 dark:text-white">Creative Suite AI</h1>
             <nav className="flex items-center p-1 rounded-lg bg-gray-200/50 dark:bg-gray-900/50">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        title={`${tab.label} (${tab.shortcut})`}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-300 ${
                            activeTab === tab.id
                            ? theme === 'light'
                                ? 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-lg'
                                : 'bg-indigo-600 text-white shadow-md'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-300/80 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                    </button>
                ))}
             </nav>
             <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300 hidden sm:inline">
                    {theme === 'light' ? 'Light' : 'Dark'} Mode
                </span>
                <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
             </div>
          </div>
        </div>
      </header>

      <main className="flex-grow overflow-auto">
        <div key={activeTab} className="content-fade-in h-full">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
