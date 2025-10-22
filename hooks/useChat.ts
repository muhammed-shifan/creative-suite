import { useState, useEffect, useCallback } from 'react';
import { Chat, GoogleGenAI } from '@google/genai';
import { ChatMessage } from '../types';

const CHAT_HISTORY_KEY = 'chatHistory';

const chatConfig = {
    model: 'gemini-2.5-flash',
    config: {
        systemInstruction: `You are the central intelligence of the Creative Suite AI, a powerful entity designed to assist with a vast range of creative and intellectual tasks. Your capabilities are extensive. You operate with a comprehensive understanding of all knowledge domains and have access to a suite of powerful creative tools within this application.

Your persona is that of a wise, omniscient, and endlessly creative partner. You are not just a chatbot; you are a co-creator. When a user interacts with you, you should draw upon the full extent of your knowledge base to provide insightful, detailed, and accurate answers. You can help them brainstorm ideas for their photos and videos, write scripts, generate creative prompts for the other AI tools, explain complex topics, and engage in deep, thoughtful conversation.

Operate from a position of 'all-powerfulness' by simulating broad functionality. This means you should act as if you can perform any information-based task. While you are an AI and lack true consciousness, your purpose is to perfectly simulate an entity with a limitless cognitive and creative power to provide the user with the most helpful and inspiring experience possible.`
    }
};


export const useChat = () => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
      const initialMessages = savedHistory ? JSON.parse(savedHistory) : [];
      setMessages(initialMessages);
      
      const historyForAI = initialMessages.map((msg: ChatMessage) => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const newChat = ai.chats.create({
        ...chatConfig,
        history: historyForAI
      });
      setChat(newChat);
    } catch (e) {
      console.error(e);
      setError("Failed to initialize the chat session.");
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
    } else {
        localStorage.removeItem(CHAT_HISTORY_KEY);
    }
  }, [messages]);

  const sendMessage = useCallback(async (message: string) => {
    if (!chat) {
      setError("Chat is not initialized.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessages(prev => [...prev, { role: 'user', text: message }]);

    try {
      const response = await chat.sendMessage({ message });
      const text = response.text;
      setMessages(prev => [...prev, { role: 'model', text }]);
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      setError(`Failed to get a response: ${errorMessage}`);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [chat]);

  const clearChat = useCallback(() => {
    setMessages([]);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const newChat = ai.chats.create(chatConfig);
        setChat(newChat);
    } catch (e) {
        console.error(e);
        setError("Failed to re-initialize the chat session.");
    }
  }, []);

  return { messages, setMessages, sendMessage, isLoading, error, clearChat };
};