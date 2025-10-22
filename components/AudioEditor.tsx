
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { generateAudioScript, generateSpeech, getAIPromptSuggestion } from '../services/geminiService';
import { decode, decodeAudioData, audioBufferToWavBlob } from '../utils/fileUtils';
import { AudioIcon } from './icons/AudioIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { DownloadIcon } from './icons/DownloadIcon';

interface AudioEditorProps {
  theme: string;
}

const VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

const AudioEditor: React.FC<AudioEditorProps> = ({ theme }) => {
  const [userAudioSrc, setUserAudioSrc] = useState<string | null>(null);
  const [generatedAudioSrc, setGeneratedAudioSrc] = useState<string | null>(null);
  
  const [scriptTopic, setScriptTopic] = useState('');
  const [ttsText, setTtsText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0]);
  
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  const triggerFileInput = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      const url = URL.createObjectURL(file);
      setUserAudioSrc(url);
      setGeneratedAudioSrc(null); // Clear generated audio when a new file is uploaded
      setError(null);
    } else {
      alert('Please select a valid audio file.');
    }
  };

  const handleSuggestTopic = useCallback(async () => {
    setIsSuggesting(true);
    setError(null);
    try {
      const suggestion = await getAIPromptSuggestion('audio');
      setScriptTopic(suggestion);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get suggestion.');
    } finally {
      setIsSuggesting(false);
    }
  }, []);

  const handleGenerateScript = useCallback(async () => {
    if (!scriptTopic) {
      setError('Please enter a topic to generate a script.');
      return;
    }
    setIsGeneratingScript(true);
    setError(null);
    try {
      const script = await generateAudioScript(scriptTopic);
      setTtsText(script);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate script.');
    } finally {
      setIsGeneratingScript(false);
    }
  }, [scriptTopic]);

  const handleGenerateSpeech = useCallback(async () => {
    if (!ttsText) {
      setError('Please enter some text to generate speech.');
      return;
    }
    setIsGeneratingSpeech(true);
    setError(null);
    try {
      const base64Audio = await generateSpeech(ttsText, selectedVoice);
      if (!base64Audio) {
        throw new Error('The AI did not return any audio data.');
      }

      const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const decodedBytes = decode(base64Audio);
      const audioBuffer = await decodeAudioData(decodedBytes, outputAudioContext, 24000, 1);
      const wavBlob = audioBufferToWavBlob(audioBuffer);
      const audioUrl = URL.createObjectURL(wavBlob);
      
      setGeneratedAudioSrc(audioUrl);
      setUserAudioSrc(null);

    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred during speech generation.');
    } finally {
      setIsGeneratingSpeech(false);
    }
  }, [ttsText, selectedVoice]);
  
  const handleDownloadGeneratedAudio = useCallback(() => {
    if (!generatedAudioSrc) return;
    const link = document.createElement('a');
    link.href = generatedAudioSrc;
    link.download = 'ai-generated-speech.wav';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generatedAudioSrc]);
  
  const isLoading = isGeneratingScript || isGeneratingSpeech || isSuggesting;
  const primaryButtonClass = theme === 'light' ? 'bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600' : 'bg-indigo-600 hover:bg-indigo-700';
  const generateButtonClass = theme === 'light' ? 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600' : 'bg-teal-600 hover:bg-teal-700';
  const ttsButtonClass = theme === 'light' ? 'bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700' : 'bg-purple-600 hover:bg-purple-700';

  const currentAudioSrc = generatedAudioSrc || userAudioSrc;

  return (
    <div className="container mx-auto p-4 md:p-8 h-full flex flex-col">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 flex-grow">
        <div className="md:col-span-1 bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-black/5 dark:border-white/10 flex flex-col space-y-6 overflow-y-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-gray-300/50 dark:border-gray-700 pb-4">Audio Controls</h2>
          
          <div className="space-y-4">
            <button onClick={triggerFileInput} className={`w-full text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 ${primaryButtonClass}`}>
              {userAudioSrc ? 'Change Audio File' : 'Upload Audio File'}
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="audio/*" className="hidden" />
          </div>
          
          {error && <p className="text-red-500 dark:text-red-400 text-sm my-2">{error}</p>}

          <div className="pt-4 border-t border-gray-300/50 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-2">AI Script Writer</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Generate a script from a topic, then convert it to speech.</p>
            <div className="relative">
              <input type="text" value={scriptTopic} onChange={(e) => setScriptTopic(e.target.value)} placeholder="e.g., The history of jazz music"
                  className="w-full p-2 pr-10 bg-white/40 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-violet-500 dark:focus:ring-indigo-500 focus:outline-none"/>
              <button onClick={handleSuggestTopic} disabled={isLoading} title="Suggest a topic" className="absolute top-1/2 -translate-y-1/2 right-2 p-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white rounded-full bg-white/30 dark:bg-gray-800/30 hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors">
                {isSuggesting ? <SpinnerIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
              </button>
            </div>
            <button onClick={handleGenerateScript} disabled={isLoading} className={`w-full flex items-center justify-center gap-2 text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:bg-gray-500 dark:disabled:bg-gray-600 mt-3 ${generateButtonClass}`}>
                {isGeneratingScript ? <><SpinnerIcon /> Generating...</> : 'Generate Script'}
            </button>
          </div>

          <div className="pt-4 border-t border-gray-300/50 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-2">AI Text-to-Speech</h3>
            <textarea value={ttsText} onChange={(e) => setTtsText(e.target.value)} placeholder="Enter text or generate a script to convert to speech..."
                className="w-full p-2 bg-white/40 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-violet-500 dark:focus:ring-indigo-500 focus:outline-none" rows={6}/>
            <div className="my-3">
              <label htmlFor="voice-select" className="text-sm font-medium">AI Voice</label>
              <select id="voice-select" value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="w-full mt-1 p-2 bg-white/40 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-violet-500 dark:focus:ring-indigo-500 focus:outline-none">
                {VOICES.map(voice => <option key={voice} value={voice}>{voice}</option>)}
              </select>
            </div>
            <button onClick={handleGenerateSpeech} disabled={isLoading} className={`w-full flex items-center justify-center gap-2 text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:bg-gray-500 dark:disabled:bg-gray-600 ${ttsButtonClass}`}>
                {isGeneratingSpeech ? <><SpinnerIcon /> Generating Speech...</> : 'Generate Speech'}
            </button>
             {generatedAudioSrc && (
                <button onClick={handleDownloadGeneratedAudio} className="w-full flex items-center justify-center gap-2 text-gray-700 dark:text-gray-200 bg-gray-500/20 hover:bg-gray-500/30 dark:bg-gray-700 dark:hover:bg-gray-600 font-bold py-2 px-4 rounded-lg transition duration-300 mt-3">
                    <DownloadIcon /> Download Generated Audio
                </button>
            )}
          </div>
        </div>

        <div className="md:col-span-2 bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg rounded-xl p-4 shadow-2xl border border-black/5 dark:border-white/10 flex items-center justify-center relative overflow-hidden">
          {!currentAudioSrc ? (
            <div className="text-center text-gray-500 dark:text-gray-400">
              <AudioIcon className="mx-auto h-24 w-24 opacity-10" />
              <h3 className="mt-4 text-xl font-semibold">Audio Editor</h3>
              <p className="mt-1">Upload an audio file or generate speech with AI.</p>
            </div>
          ) : (
            <div className="w-full p-4">
              <h3 className="text-lg font-semibold mb-4 text-center">{generatedAudioSrc ? 'AI Generated Speech' : 'Your Uploaded Audio'}</h3>
              <audio
                ref={audioPlayerRef}
                key={currentAudioSrc}
                src={currentAudioSrc}
                controls
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioEditor;
