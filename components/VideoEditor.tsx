import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VideoIcon } from './icons/VideoIcon';
import { getVideoFilterFromPrompt, getAIPromptSuggestion } from '../services/geminiService';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { audioBufferToWavBlob } from '../utils/fileUtils';
import { useHistory } from '../hooks/useHistory';
import { useAutoSave } from '../hooks/useAutoSave';
import { UndoIcon } from './icons/UndoIcon';
import { RedoIcon } from './icons/RedoIcon';
import { SaveIcon } from './icons/SaveIcon';
import { LoadIcon } from './icons/LoadIcon';
import { TrashIcon } from './icons/TrashIcon';
import { CheckIcon } from './icons/CheckIcon';
import { SparklesIcon } from './icons/SparklesIcon';

const filters = [
  { name: 'None', style: '' },
  { name: 'Grayscale', style: 'grayscale(1)' },
  { name: 'Sepia', style: 'sepia(1)' },
  { name: 'Invert', style: 'invert(1)' },
  { name: 'Contrast', style: 'contrast(1.5)' },
  { name: 'Brightness', style: 'brightness(1.25)' },
  { name: 'Saturate', style: 'saturate(2)' },
];

interface VideoEditorState {
  videoSrc: string | null;
  activeFilter: string;
}

interface VideoEditorProps {
  theme: string;
}

interface Preset {
  name: string;
  filter: string;
}

const VIDEO_PROJECT_KEY = 'videoEditorProject';
const AUTO_SAVE_KEY = 'videoEditorAutoSave';
const PRESETS_STORAGE_KEY = 'videoEditorPresets';

const VideoEditor: React.FC<VideoEditorProps> = ({ theme }) => {
  const initialState: VideoEditorState = { videoSrc: null, activeFilter: '' };
  const { state: videoState, setState: setVideoState, undo, redo, reset: resetVideoState, canUndo, canRedo, history, currentIndex, loadHistory } = useHistory<VideoEditorState>(initialState, { limit: 5 });

  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const aiPromptRef = useRef<HTMLTextAreaElement>(null);
  const [isAiFiltersOpen, setIsAiFiltersOpen] = useState(false);

  const [isProjectLoaded, setIsProjectLoaded] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isExtractingAudio, setIsExtractingAudio] = useState<boolean>(false);
  const [generationState, setGenerationState] = useState({ active: false, message: '', promptUserForFile: false });

  // Presets state
  const [presets, setPresets] = useState<Preset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');

  // Auto-save logic
  const handleAutoSave = useCallback(async (dataToSave: { history: VideoEditorState[]; currentIndex: number }) => {
    if (!dataToSave || !dataToSave.history || dataToSave.history.length === 0) return;
    
    const currentState = dataToSave.history[dataToSave.currentIndex];
    if (!currentState.videoSrc && !isProjectLoaded) return;

    const serializableHistory = dataToSave.history.map((hState: VideoEditorState) => ({ ...hState, videoSrc: null }));
    const data = { history: serializableHistory, currentIndex: dataToSave.currentIndex };
    localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(data));
  }, [isProjectLoaded]);

  const { status: autoSaveStatus, lastSaved: lastAutoSaved } = useAutoSave(
    { history, currentIndex },
    handleAutoSave,
    120000 // 2 minutes
  );

  useEffect(() => {
    const autoSavedDataString = localStorage.getItem(AUTO_SAVE_KEY);
    if (autoSavedDataString) {
        if (window.confirm("An auto-saved video project was found. Would you like to restore it?")) {
            try {
                const savedData = JSON.parse(autoSavedDataString);
                if (savedData.history && typeof savedData.currentIndex === 'number') {
                    loadHistory(savedData.history, savedData.currentIndex);
                    setIsProjectLoaded(true);
                    setGenerationState({ active: true, message: 'Auto-saved project loaded. Please select your original video file to apply edits.', promptUserForFile: true });
                    if (videoRef.current) videoRef.current.src = '';
                } else {
                    throw new Error("Corrupted auto-save data.");
                }
            } catch (error) {
                console.error("Failed to load auto-saved project:", error);
                alert("Could not load the auto-saved project.");
                localStorage.removeItem(AUTO_SAVE_KEY);
            }
        }
    }
  }, [loadHistory]); 
  
  // Load presets on mount
  useEffect(() => {
    try {
      const savedPresets = localStorage.getItem(PRESETS_STORAGE_KEY);
      if (savedPresets) {
        setPresets(JSON.parse(savedPresets));
      }
    } catch (error) {
      console.error("Failed to load presets:", error);
    }
  }, []);

  // Save presets on change
  useEffect(() => {
    if (presets.length > 0 || localStorage.getItem(PRESETS_STORAGE_KEY)) {
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
    }
  }, [presets]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.volume = volume;
    }
  }, [isMuted, volume, videoState.videoSrc]);

  const triggerFileInput = useCallback(() => fileInputRef.current?.click(), []);
  const toggleMute = useCallback(() => setIsMuted(prev => !prev), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const targetIsInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
        if (targetIsInput) return;

        let handled = false;
        if (e.ctrlKey) {
            switch(e.key.toLowerCase()) {
                case 'z': if(canUndo) { undo(); handled = true; } break;
                case 'y': if(canRedo) { redo(); handled = true; } break;
                case 'o': triggerFileInput(); handled = true; break;
            }
        } else if (e.altKey) {
            const focusWithDelay = (ref: React.RefObject<HTMLTextAreaElement>) => {
                 setTimeout(() => ref.current?.focus(), 50);
            };
            switch(e.key.toLowerCase()) {
                case 'f': setIsAiFiltersOpen(prev => !prev); focusWithDelay(aiPromptRef); handled = true; break;
            }
        } else {
             switch(e.key.toLowerCase()) {
                case 'm': if(videoState.videoSrc) { toggleMute(); handled = true; } break;
             }
        }
        
        if (handled) {
            e.preventDefault();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo, videoState.videoSrc, triggerFileInput, toggleMute]);
  
  const resetAll = () => {
    resetVideoState({ videoSrc: null, activeFilter: '' });
    setIsMuted(false);
    setVolume(1);
    setAiError(null);
    setGenerationState({ active: false, message: '', promptUserForFile: false });
  }

  const handleClearProject = () => {
    if(window.confirm("Are you sure you want to clear the current project? This cannot be undone.")) {
      resetAll();
      localStorage.removeItem(VIDEO_PROJECT_KEY);
      localStorage.removeItem(AUTO_SAVE_KEY);
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      if (isProjectLoaded) {
        setVideoState({ ...videoState, videoSrc: url });
        setIsProjectLoaded(false);
        setGenerationState({ active: false, message: '', promptUserForFile: false });
      } else {
        resetAll();
        resetVideoState({ videoSrc: url, activeFilter: '' });
      }
    } else {
      alert('Please select a valid video file.');
    }
  };
  
  const handleSaveProject = useCallback(() => {
    if (!videoState.videoSrc) {
      alert("There's no video project to save.");
      return;
    }
    const serializableHistory = history.map(hState => ({ ...hState, videoSrc: null }));
    const dataToSave = { history: serializableHistory, currentIndex };
    localStorage.setItem(VIDEO_PROJECT_KEY, JSON.stringify(dataToSave));
    alert("Video project saved! (Filters & history only. You will need to re-upload the video upon loading).");
  }, [history, currentIndex, videoState.videoSrc]);

  const handleLoadProject = useCallback(() => {
    const savedDataString = localStorage.getItem(VIDEO_PROJECT_KEY);
    if (!savedDataString) {
      alert("No saved video project found.");
      return;
    }
    try {
      const savedData = JSON.parse(savedDataString);
      if (savedData.history && typeof savedData.currentIndex === 'number') {
        loadHistory(savedData.history, savedData.currentIndex);
        setIsProjectLoaded(true);
        setGenerationState({ active: true, message: 'Project loaded. Please select your original video file to apply edits.', promptUserForFile: true });
        if (videoRef.current) videoRef.current.src = ''; 
      } else {
        throw new Error("Saved data is corrupted.");
      }
    } catch (error) {
      console.error("Failed to load project:", error);
      alert("Could not load the saved project. The data may be corrupted.");
      localStorage.removeItem(VIDEO_PROJECT_KEY);
    }
  }, [loadHistory]);

  const handleSuggestPrompt = useCallback(async (
    context: 'video' | 'edit', 
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    setIsSuggesting(true);
    try {
      const suggestion = await getAIPromptSuggestion(context);
      setter(suggestion);
    } catch (e) {
       console.error("Suggestion error:", e);
    } finally {
      setIsSuggesting(false);
    }
  }, []);

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(event.target.value));
    if (parseFloat(event.target.value) > 0 && isMuted) setIsMuted(false);
  };
  
  const handleExtractAudio = useCallback(async () => {
    if (!videoState.videoSrc) {
      alert("Please upload a video first.");
      return;
    }

    setIsExtractingAudio(true);
    setAiError(null);

    try {
      const response = await fetch(videoState.videoSrc);
      const videoData = await response.arrayBuffer();

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(videoData);

      const wavBlob = audioBufferToWavBlob(audioBuffer);

      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      document.body.appendChild(a);
      a.style.display = 'none';
      a.href = url;
      a.download = 'extracted-audio.wav';
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

    } catch (error) {
      console.error("Failed to extract audio:", error);
      let errorMessage = "Could not extract audio from the video. The file might be corrupted or in an unsupported format.";
      if (error instanceof Error && error.message.toLowerCase().includes("decodeaudiodata")) {
        errorMessage = "Could not decode audio from the video. The format may not be supported by your browser.";
      }
      setAiError(errorMessage);
    } finally {
      setIsExtractingAudio(false);
    }
  }, [videoState.videoSrc]);

  const handleAiFilterEdit = useCallback(async () => {
    if (!videoState.videoSrc || !aiPrompt) {
        setAiError('Please upload a video and enter a prompt.');
        return;
    }
    setIsAiLoading(true);
    setAiError(null);
    try {
        const filterStyle = await getVideoFilterFromPrompt(aiPrompt);
        setVideoState({ ...videoState, activeFilter: filterStyle });
    } catch (err) {
        setAiError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
        setIsAiLoading(false);
    }
  }, [videoState, aiPrompt, setVideoState]);

  const applyFilter = (filterStyle: string) => {
    setVideoState({ ...videoState, activeFilter: filterStyle });
  };
  
  const handleSavePreset = useCallback(() => {
    if (!newPresetName.trim()) {
      alert("Please enter a name for your preset.");
      return;
    }
    if (!videoState.activeFilter) {
      alert("There are no filters applied to save as a preset.");
      return;
    }
    const trimmedName = newPresetName.trim();
    if (presets.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
        if (!window.confirm(`A preset named "${trimmedName}" already exists. Do you want to overwrite it?`)) {
            return;
        }
    }
  
    const newPreset: Preset = { name: trimmedName, filter: videoState.activeFilter };
    
    setPresets(prev => {
        const existingIndex = prev.findIndex(p => p.name.toLowerCase() === newPreset.name.toLowerCase());
        if (existingIndex > -1) {
            const updatedPresets = [...prev];
            updatedPresets[existingIndex] = newPreset;
            return updatedPresets;
        }
        return [...prev, newPreset];
    });
  
    setNewPresetName('');
  }, [newPresetName, videoState.activeFilter, presets]);

  const handleApplyPreset = useCallback((preset: Preset) => {
    setVideoState({ ...videoState, activeFilter: preset.filter });
  }, [videoState, setVideoState]);
  
  const handleDeletePreset = useCallback((presetNameToDelete: string) => {
    if (window.confirm(`Are you sure you want to delete the preset "${presetNameToDelete}"?`)) {
      setPresets(prev => prev.filter(p => p.name !== presetNameToDelete));
    }
  }, []);

  const primaryButtonClass = theme === 'light'
    ? 'bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600'
    : 'bg-indigo-600 hover:bg-indigo-700';
  
  const purpleButtonClass = theme === 'light'
    ? 'bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700'
    : 'bg-purple-600 hover:bg-purple-700';

  const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
    <svg className={`w-5 h-5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  const AutoSaveIndicator = () => (
    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 h-5">
        {autoSaveStatus === 'saving' && <><SpinnerIcon className="w-4 h-4" /><span>Saving...</span></>}
        {autoSaveStatus === 'saved' && lastAutoSaved && <><CheckIcon className="w-4 h-4 text-green-500" /><span>Saved at {lastAutoSaved}</span></>}
        {autoSaveStatus === 'error' && <span className="text-red-500">Auto-save failed</span>}
        {autoSaveStatus === 'idle' && lastAutoSaved && <span>Last saved at {lastAutoSaved}</span>}
    </div>
  );

  return (
    <div className="container mx-auto p-4 md:p-8 h-full flex flex-col">
      <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-8 h-full">
        <div className="md:col-span-1 bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-black/5 dark:border-white/10 flex flex-col">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white border-b border-gray-300/50 dark:border-gray-700 pb-4">Video Controls</h2>
          <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-6">
            <div className="space-y-4">
              <button onClick={triggerFileInput} title="Upload Video (Ctrl+O)" className={`w-full text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 ${primaryButtonClass}`}>
                {videoState.videoSrc ? 'Change Video' : 'Upload Video'}
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="video/*" className="hidden" />
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-300/50 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Project</h3>
                <AutoSaveIndicator />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={handleSaveProject} title="Save Project" className="flex items-center justify-center gap-2 bg-gray-500/40 hover:bg-gray-500/60 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-bold py-2 px-3 rounded-lg transition duration-300"><SaveIcon /><span>Save</span></button>
                <button onClick={handleLoadProject} title="Load Project" className="flex items-center justify-center gap-2 bg-gray-500/40 hover:bg-gray-500/60 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-bold py-2 px-3 rounded-lg transition duration-300"><LoadIcon /><span>Load</span></button>
                <button onClick={handleClearProject} title="Clear Project" className="flex items-center justify-center gap-2 bg-red-500/80 hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-600 text-white font-bold py-2 px-3 rounded-lg transition duration-300"><TrashIcon /><span>Clear</span></button>
              </div>
              <h3 className="text-lg font-semibold pt-4 border-t border-gray-300/50 dark:border-gray-700">History</h3>
              <div className="flex gap-4">
                <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" className="w-full flex items-center justify-center gap-2 bg-gray-500/40 hover:bg-gray-500/60 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"><UndoIcon /><span>Undo</span></button>
                <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" className="w-full flex items-center justify-center gap-2 bg-gray-500/40 hover:bg-gray-500/60 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"><RedoIcon /><span>Redo</span></button>
              </div>
            </div>

            <div className={`pt-4 border-t border-gray-300/50 dark:border-gray-700 space-y-4 transition-opacity ${videoState.videoSrc ? 'opacity-100' : 'opacity-50'}`}>
              <h3 className="text-lg font-semibold">Player Controls</h3>
              <div className="flex items-center gap-4">
                <button onClick={toggleMute} disabled={!videoState.videoSrc} title="Mute/Unmute (M)" className="p-2 bg-gray-500/30 rounded-full disabled:opacity-50 disabled:cursor-not-allowed">{isMuted ? 'Unmute' : 'Mute'}</button>
                <input type="range" min="0" max="1" step="0.05" value={volume} onChange={handleVolumeChange} disabled={!videoState.videoSrc} className="w-full accent-violet-500 dark:accent-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed" />
              </div>
              <button onClick={handleExtractAudio} disabled={isExtractingAudio || !videoState.videoSrc} className="w-full bg-gray-500/40 hover:bg-gray-500/60 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {isExtractingAudio ? <><SpinnerIcon /> Extracting Audio...</> : 'Extract Audio as WAV'}
              </button>
            </div>

            <div className="pt-4 border-t border-gray-300/50 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-2">Manual Filters</h3>
              <div className="grid grid-cols-3 gap-2">
                {filters.map((filter) => (<button key={filter.name} onClick={() => applyFilter(filter.style)} disabled={!videoState.videoSrc} className={`py-2 px-3 text-sm rounded-md transition-all duration-200 ${videoState.activeFilter === filter.style ? 'bg-violet-500 text-white dark:bg-indigo-500' : 'bg-gray-500/20 dark:bg-gray-700 hover:bg-gray-500/30 dark:hover:bg-gray-600'}`}>{filter.name}</button>))}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-300/50 dark:border-gray-700">
              <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold">Presets</h3>
              </div>
              <div className="flex gap-2">
                  <input type="text" value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} placeholder="New preset name..." className="flex-grow p-2 bg-white/40 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md"/>
                  <button onClick={handleSavePreset} disabled={!videoState.activeFilter} className="px-3 bg-gray-500/40 hover:bg-gray-500/60 rounded-md">Save</button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {presets.map(p => (
                  <div key={p.name} className="flex group">
                    <button onClick={() => handleApplyPreset(p)} className="flex-grow text-left p-2 rounded-l-md bg-gray-500/10 hover:bg-gray-500/20">{p.name}</button>
                    <button onClick={() => handleDeletePreset(p.name)} className="px-2 bg-red-500/20 hover:bg-red-500/40 rounded-r-md opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon className="w-4 h-4 text-red-700 dark:text-red-400"/></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-300/50 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-2">AI Tools</h3>
              {aiError && <p className="text-red-500 dark:text-red-400 text-sm my-2">{aiError}</p>}
              <div className="space-y-2">
                  <div className="rounded-lg overflow-hidden border border-gray-300/50 dark:border-gray-700/50">
                      <button onClick={() => setIsAiFiltersOpen(prev => !prev)} title="AI Filters (Alt+F)" className="w-full flex justify-between items-center p-3 text-left font-medium bg-gray-500/10 hover:bg-gray-500/20 dark:bg-gray-900/20 dark:hover:bg-gray-900/40 transition-colors">
                          <span>AI Filters</span>
                          <ChevronIcon open={isAiFiltersOpen} />
                      </button>
                      {isAiFiltersOpen && (
                          <div className="p-4 bg-gray-500/5 dark:bg-gray-900/10 space-y-4">
                              <h4 className="font-semibold text-gray-800 dark:text-white">Add Video Filters with AI</h4>
                              <div className="relative">
                                  <textarea ref={aiPromptRef} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="e.g., make it look like an old film"
                                      className="w-full p-2 pr-10 bg-white/40 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-violet-500 dark:focus:ring-indigo-500" rows={2} disabled={!videoState.videoSrc}/>
                                  <button onClick={() => handleSuggestPrompt('edit', setAiPrompt)} disabled={isSuggesting} title="Suggest a prompt" className="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white rounded-full bg-white/30 dark:bg-gray-800/30 hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors">
                                      {isSuggesting ? <SpinnerIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
                                  </button>
                              </div>
                              <button onClick={handleAiFilterEdit} disabled={isAiLoading || !videoState.videoSrc}
                                  className={`w-full flex items-center justify-center gap-2 text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:bg-gray-500 dark:disabled:bg-gray-600 ${purpleButtonClass}`}>
                                  {isAiLoading ? <><SpinnerIcon /> Applying...</> : 'Apply AI Filter'}
                              </button>
                          </div>
                      )}
                  </div>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg rounded-xl p-4 shadow-2xl border border-black/5 dark:border-white/10 flex items-center justify-center relative overflow-hidden">
          {generationState.active ? (
            <div className="text-center text-gray-500 dark:text-gray-400 space-y-4">
              <SpinnerIcon className="mx-auto h-16 w-16" />
              <h3 className="text-xl font-semibold">{generationState.message}</h3>
              {generationState.promptUserForFile && (
                <button onClick={triggerFileInput} className={`w-full text-white font-bold py-3 px-4 rounded-lg ${primaryButtonClass}`}>Select Video File</button>
              )}
            </div>
          ) : !videoState.videoSrc ? (
            <div className="text-center text-gray-500 dark:text-gray-400">
              <VideoIcon className="mx-auto h-24 w-24 opacity-10" />
              <h3 className="mt-4 text-xl font-semibold">Video Editor</h3>
              <p className="mt-1">Upload a video to start editing or generate one with AI.</p>
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                key={videoState.videoSrc}
                src={videoState.videoSrc}
                controls
                className="max-w-full max-h-full object-contain transition-all duration-300"
                style={{ filter: videoState.activeFilter }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoEditor;