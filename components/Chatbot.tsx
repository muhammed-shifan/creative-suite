import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { ChatIcon } from './icons/ChatIcon';
import { NewChatIcon } from './icons/NewChatIcon';
import { WittyReplyIcon } from './icons/WittyReplyIcon';
import { generateComeback } from '../services/geminiService';

interface ChatbotProps {
  theme: string;
}

const Chatbot: React.FC<ChatbotProps> = ({ theme }) => {
  const [input, setInput] = useState('');
  const { messages, setMessages, sendMessage, isLoading, error, clearChat } = useChat();
  const [isGeneratingComeback, setIsGeneratingComeback] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input);
      setInput('');
    }
  };
  
  const handleComeback = async () => {
    if (!input.trim()) return;

    const userInput = input;
    setInput('');
    setIsGeneratingComeback(true);

    // Add user message immediately
    setMessages(prev => [...prev, { role: 'user', text: `Generate a comeback for: "${userInput}"` }]);

    try {
        const comeback = await generateComeback(userInput);
        setMessages(prev => [...prev, { role: 'model', text: comeback }]);
    } catch (e) {
        const err = e as Error;
        // The error from the service is user-facing and witty
        setMessages(prev => [...prev, { role: 'model', text: err.message }]);
        // No need to remove the user prompt, let the AI's "failure" be part of the chat
    } finally {
        setIsGeneratingComeback(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm('Are you sure you want to start a new chat? Your current conversation will be cleared.')) {
      clearChat();
      inputRef.current?.focus();
    }
  };
  
  const sendButtonClass = theme === 'light'
    ? 'bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600'
    : 'bg-indigo-600 hover:bg-indigo-700';

  const comebackButtonClass = theme === 'light'
    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
    : 'bg-orange-600 hover:bg-orange-700';

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto p-4">
      <div className="relative flex-grow overflow-y-auto bg-white/50 dark:bg-gray-800/80 backdrop-blur-lg rounded-t-xl p-6 space-y-6 border border-black/5 dark:border-white/10">
        {messages.length > 0 && (
          <button 
            onClick={handleClearChat}
            title="Start New Chat"
            className="absolute top-4 right-4 p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-500/20 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:focus:ring-indigo-500 transition-colors"
          >
            <NewChatIcon />
          </button>
        )}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
              <ChatIcon className="w-24 h-24 opacity-20"/>
              <h2 className="text-2xl font-semibold mt-4">AI Chatbot</h2>
              <p className="mt-2">Ask me anything, or challenge me to a witty comeback!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center flex-shrink-0 font-bold text-white text-sm">AI</div>}
              <div
                className={`max-w-lg px-5 py-3 rounded-2xl shadow-md ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-br-none'
                    : 'bg-gray-500/20 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>
               {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 font-bold text-white text-sm">You</div>}
            </div>
          ))
        )}
        {isLoading && (
           <div className="flex items-start gap-4 justify-start">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center flex-shrink-0 font-bold text-white text-sm">AI</div>
               <div className="max-w-lg px-5 py-3 rounded-2xl shadow-md bg-gray-500/20 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none">
                <SpinnerIcon className="w-5 h-5"/>
               </div>
           </div>
        )}
        {error && <p className="text-red-500 dark:text-red-400 text-center">{error}</p>}
        <div ref={messagesEndRef} />
      </div>
      <div className="bg-white/50 dark:bg-gray-800/80 backdrop-blur-lg rounded-b-xl p-4 border-t border-black/5 dark:border-gray-700">
        <form onSubmit={handleSend} className="flex items-center gap-2 sm:gap-4">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            title="Focus input (Ctrl+I)"
            className="flex-grow p-3 bg-white/40 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 dark:focus:ring-indigo-500"
            disabled={isLoading || isGeneratingComeback}
          />
          <button
            type="button"
            onClick={handleComeback}
            disabled={isLoading || isGeneratingComeback || !input.trim()}
            title="Generate Witty Comeback"
            className={`flex-shrink-0 text-white font-semibold p-3 rounded-lg transition-colors disabled:bg-gray-500 dark:disabled:bg-gray-600 disabled:cursor-not-allowed ${comebackButtonClass}`}
          >
            {isGeneratingComeback ? <SpinnerIcon className="w-6 h-6" /> : <WittyReplyIcon className="w-6 h-6" />}
          </button>
          <button
            type="submit"
            disabled={isLoading || isGeneratingComeback || !input.trim()}
            className={`text-white font-semibold py-3 px-4 sm:px-6 rounded-lg transition-colors disabled:bg-gray-500 dark:disabled:bg-gray-600 disabled:cursor-not-allowed ${sendButtonClass}`}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chatbot;