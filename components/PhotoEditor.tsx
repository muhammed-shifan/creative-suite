import React, { useState, useRef, useCallback, useEffect } from 'react';
import { generateImageWithAI, editImageWithAI, editImageWithMaskAI, add3DEffectToImage, getAIPromptSuggestion, upscaleImageWithAI } from '../services/geminiService';
import { fileToBase64, dataUrlToFile } from '../utils/fileUtils';
import { PhotoIcon } from './icons/PhotoIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { DownloadIcon } from './icons/DownloadIcon';
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
  { name: 'Vintage', style: 'sepia(0.9) contrast(1.25) brightness(0.9)' },
  { name: 'Cool', style: 'saturate(1.5) contrast(1.1)' },
];

interface PhotoEditorState {
  originalFile: File | null;
  imageSrc: string | null;
  editedImageSrc: string | null;
  activeFilter: string;
}

interface PhotoEditorProps {
  theme: string;
}

const PHOTO_PROJECT_KEY = 'photoEditorProject';
const AUTO_SAVE_KEY = 'photoEditorAutoSave';

const PhotoEditor: React.FC<PhotoEditorProps> = ({ theme }) => {
  const initialState: PhotoEditorState = {
    originalFile: null, imageSrc: null, editedImageSrc: null, activeFilter: '',
  };
  const { state: photoState, setState: setPhotoState, undo, redo, reset, canUndo, canRedo, history, currentIndex, loadHistory } = useHistory<PhotoEditorState>(initialState, { limit: 10 });

  const [generationPrompt, setGenerationPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');

  const [editPrompt, setEditPrompt] = useState('');
  const [activeAiTask, setActiveAiTask] = useState<'edit' | '3d' | 'upscale' | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  
  const [upscalePrompt, setUpscalePrompt] = useState('');

  const [isMasking, setIsMasking] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [isRestoring, setIsRestoring] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const getSerializableState = useCallback(async (historyToSave: PhotoEditorState[], indexToSave: number) => {
    if (!historyToSave || historyToSave.length === 0 || !historyToSave[0].imageSrc) return null;

    const serializableHistory = await Promise.all(historyToSave.map(async (hState) => {
      if (!hState.originalFile) return { ...hState, originalFile: null };
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.onerror = e => reject(e);
        reader.readAsDataURL(hState.originalFile as File);
      });
      return {
        ...hState,
        originalFile: null,
        originalFileData: { dataUrl, name: hState.originalFile.name }
      };
    }));
    return { history: serializableHistory, currentIndex: indexToSave };
  }, []);

  const handleAutoSave = useCallback(async (dataToSave: { history: PhotoEditorState[]; currentIndex: number }) => {
    const serializableData = await getSerializableState(dataToSave.history, dataToSave.currentIndex);
    if (serializableData) {
      localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(serializableData));
    }
  }, [getSerializableState]);

  const { status: autoSaveStatus, lastSaved: lastAutoSaved } = useAutoSave(
    { history, currentIndex },
    handleAutoSave,
    120000 // 2 minutes
  );
  
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  const resetAll = useCallback((newState: PhotoEditorState) => {
    reset(newState);
    setEditError(null);
    setGenerationError(null);
    setEditPrompt('');
    setIsMasking(false);
    clearCanvas();
  }, [reset, clearCanvas]);

  const handleClearProject = () => {
    if (window.confirm("Are you sure you want to clear the current project? This cannot be undone.")) {
      resetAll({ originalFile: null, imageSrc: null, editedImageSrc: null, activeFilter: '' });
      localStorage.removeItem(PHOTO_PROJECT_KEY);
      localStorage.removeItem(AUTO_SAVE_KEY);
    }
  };

  useEffect(() => {
    const autoSavedDataString = localStorage.getItem(AUTO_SAVE_KEY);
    if (autoSavedDataString) {
      if (window.confirm("An auto-saved project was found. Would you like to restore it?")) {
        setIsRestoring(true);
        try {
          const savedData = JSON.parse(autoSavedDataString);
          if (savedData.history && typeof savedData.currentIndex === 'number') {
            Promise.all(savedData.history.map(async (hState: any) => {
              let file = null;
              if (hState.originalFileData) {
                file = await dataUrlToFile(hState.originalFileData.dataUrl, hState.originalFileData.name);
              }
              return { ...hState, originalFile: file };
            })).then(reconstructedHistory => {
              loadHistory(reconstructedHistory, savedData.currentIndex);
            }).finally(() => {
                setIsRestoring(false);
            });
          } else {
            setIsRestoring(false);
          }
        } catch (error) {
          console.error("Failed to load auto-saved project:", error);
          alert("Could not load the auto-saved project. The data may be corrupted.");
          localStorage.removeItem(AUTO_SAVE_KEY);
          setIsRestoring(false);
        }
      }
    }
  }, [loadHistory]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      resetAll({ originalFile: file, imageSrc: url, editedImageSrc: null, activeFilter: '' });
    } else {
      alert('Please select a valid image file.');
    }
  };

  const handleGenerateImage = useCallback(async () => {
    if (!generationPrompt) {
      setGenerationError('Please enter a prompt to generate an image.');
      return;
    }
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const newImageData = await generateImageWithAI(generationPrompt, aspectRatio);
      if (newImageData) {
        const dataUrl = `data:image/png;base64,${newImageData}`;
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "generated-image.png", { type: "image/png" });
        resetAll({ originalFile: file, imageSrc: dataUrl, editedImageSrc: null, activeFilter: '' });
      } else {
        throw new Error("The AI model did not return an image.");
      }
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsGenerating(false);
    }
  }, [generationPrompt, resetAll, aspectRatio]);

  const handleAiEdit = useCallback(async () => {
    if (!photoState.originalFile || !editPrompt) {
      setEditError('Please select an image and enter a prompt.');
      return;
    }
    setActiveAiTask('edit');
    setEditError(null);
    try {
      const base64Data = await fileToBase64(photoState.originalFile);
      let newImageData: string | null = null;
      
      const canvas = canvasRef.current;
      const maskCanvas = document.createElement('canvas');
      let maskBase64: string | null = null;

      if (isMasking && canvas) {
        maskCanvas.width = canvas.width;
        maskCanvas.height = canvas.height;
        const maskCtx = maskCanvas.getContext('2d');
        if (maskCtx) {
          maskCtx.drawImage(canvas, 0, 0);
          const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
          const hasDrawing = Array.from(imageData.data).some(channel => channel > 0);
          if(hasDrawing) {
            maskBase64 = maskCanvas.toDataURL('image/png').split(',')[1];
          }
        }
      }

      if (maskBase64) {
        newImageData = await editImageWithMaskAI(base64Data, photoState.originalFile.type, maskBase64, editPrompt);
      } else {
        newImageData = await editImageWithAI(base64Data, photoState.originalFile.type, editPrompt);
      }
      
      if (newImageData) {
        const dataUrl = `data:${photoState.originalFile.type};base64,${newImageData}`;
        const newFile = await dataUrlToFile(dataUrl, `edited-${photoState.originalFile.name}`);
        setPhotoState({
          ...photoState,
          originalFile: newFile,
          imageSrc: dataUrl,
          editedImageSrc: null, // The new state becomes the base
          activeFilter: '',
        });
        setIsMasking(false); 
        clearCanvas();
      } else {
        throw new Error("The AI model did not return an image.");
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setActiveAiTask(null);
    }
  }, [photoState, editPrompt, setPhotoState, isMasking, clearCanvas]);

  const handle3DEffect = useCallback(async () => {
    if (!photoState.originalFile) {
      setEditError('Please select an image first.');
      return;
    }
    setActiveAiTask('3d');
    setEditError(null);
    try {
      const base64Data = await fileToBase64(photoState.originalFile);
      const promptFor3D = editPrompt || "the subject";
      const newImageData = await add3DEffectToImage(base64Data, photoState.originalFile.type, promptFor3D);
      if (newImageData) {
         const dataUrl = `data:${photoState.originalFile.type};base64,${newImageData}`;
         const newFile = await dataUrlToFile(dataUrl, `3d-${photoState.originalFile.name}`);
        setPhotoState({ ...photoState, originalFile: newFile, imageSrc: dataUrl, editedImageSrc: null, activeFilter: '' });
      } else {
        throw new Error("The AI model did not return an image for the 3D effect.");
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setActiveAiTask(null);
    }
  }, [photoState, editPrompt, setPhotoState]);
  
  const handleUpscale = useCallback(async () => {
    if (!photoState.originalFile) {
      setEditError('Please select an image first.');
      return;
    }
    setActiveAiTask('upscale');
    setEditError(null);
    try {
      const base64Data = await fileToBase64(photoState.originalFile);
      const newImageData = await upscaleImageWithAI(base64Data, photoState.originalFile.type, upscalePrompt);
      if (newImageData) {
         const dataUrl = `data:image/png;base64,${newImageData}`; // Upscaled images might be best as PNG
         const newFile = await dataUrlToFile(dataUrl, `upscaled-${photoState.originalFile.name}`);
        setPhotoState({ ...photoState, originalFile: newFile, imageSrc: dataUrl, editedImageSrc: null, activeFilter: '' });
      } else {
        throw new Error("The AI model did not return an upscaled image.");
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'An unknown error occurred during upscaling.');
    } finally {
      setActiveAiTask(null);
    }
  }, [photoState, upscalePrompt, setPhotoState]);

  const handleSuggestPrompt = useCallback(async (context: 'photo' | 'edit') => {
    setIsSuggesting(true);
    try {
      const suggestion = await getAIPromptSuggestion(context);
      if (context === 'photo') {
          setGenerationPrompt(suggestion);
      } else {
          setEditPrompt(suggestion);
      }
    } catch(e) {
      console.error("Suggestion error:", e);
    } finally {
      setIsSuggesting(false);
    }
  }, []);

  const triggerFileInput = useCallback(() => fileInputRef.current?.click(), []);
  
  const downloadImage = useCallback(() => {
    const link = document.createElement('a');
    const currentSrc = photoState.editedImageSrc || photoState.imageSrc || '';
    if(!currentSrc) return;
    link.href = currentSrc;
    const baseName = photoState.originalFile?.name || 'generated.png';
    link.download = photoState.editedImageSrc ? `edited-${baseName}` : baseName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [photoState]);
  
  const handleSaveProject = useCallback(async () => {
    if (!photoState.imageSrc) {
        alert("There is nothing to save.");
        return;
    }
    try {
        const serializableData = await getSerializableState(history, currentIndex);
        if (serializableData) {
            localStorage.setItem(PHOTO_PROJECT_KEY, JSON.stringify(serializableData));
            alert("Project saved successfully!");
        } else {
            throw new Error("Could not create save data.");
        }
    } catch (error) {
        console.error("Failed to save project:", error);
        alert("Could not save the project. The image might be too large.");
    }
  }, [history, currentIndex, photoState.imageSrc, getSerializableState]);

  const handleLoadProject = useCallback(async () => {
    const savedDataString = localStorage.getItem(PHOTO_PROJECT_KEY);
    if (!savedDataString) {
        alert("No saved project found.");
        return;
    }
    try {
        const savedData = JSON.parse(savedDataString);
        const reconstructedHistory = await Promise.all(savedData.history.map(async (hState: any) => {
            let file = null;
            if (hState.originalFileData) {
                file = await dataUrlToFile(hState.originalFileData.dataUrl, hState.originalFileData.name);
            }
            return {
                ...hState,
                originalFile: file,
            };
        }));
        loadHistory(reconstructedHistory, savedData.currentIndex);
        alert("Project loaded successfully!");
    } catch (error) {
        console.error("Failed to load project:", error);
        alert("Could not load the saved project. The data may be corrupted.");
        localStorage.removeItem(PHOTO_PROJECT_KEY);
    }
  }, [loadHistory]);

  const displaySrc = photoState.editedImageSrc || photoState.imageSrc;

  const applyFilter = (filterStyle: string) => {
    setPhotoState({ ...photoState, activeFilter: filterStyle, editedImageSrc: null });
  };
  
  const setupCanvas = useCallback(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (image && canvas) {
      canvas.width = image.clientWidth;
      canvas.height = image.clientHeight;
    }
  }, []);

  useEffect(() => {
    const image = imageRef.current;
    if (image) {
      image.addEventListener('load', setupCanvas);
      window.addEventListener('resize', setupCanvas);
      return () => {
        image.removeEventListener('load', setupCanvas);
        window.removeEventListener('resize', setupCanvas);
      };
    }
  }, [displaySrc, setupCanvas]);
  
  const isEditing = activeAiTask !== null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetIsInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (targetIsInput) return;

      let handled = true;
      if (e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'z': if (canUndo) undo(); break;
          case 'y': if (canRedo) redo(); break;
          case 'o': triggerFileInput(); break;
          case 's': if (displaySrc) { e.preventDefault(); downloadImage(); } break;
          default: handled = false;
        }
      } else if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'g': if (!isGenerating && generationPrompt.trim()) handleGenerateImage(); break;
          case 'e': if (!isEditing && photoState.imageSrc && editPrompt.trim()) handleAiEdit(); break;
          case 'd': if (!isEditing && photoState.imageSrc) handle3DEffect(); break;
          case 'u': if (!isEditing && photoState.imageSrc) handleUpscale(); break;
          default: handled = false;
        }
      } else {
        handled = false;
      }
      
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo, triggerFileInput, displaySrc, downloadImage, isGenerating, handleGenerateImage, generationPrompt, isEditing, photoState.imageSrc, editPrompt, handleAiEdit, handle3DEffect, handleUpscale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isMasking) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const getCoords = (e: MouseEvent | TouchEvent) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }
    const startDrawing = (e: MouseEvent | TouchEvent) => { e.preventDefault(); isDrawing.current = true; const { x, y } = getCoords(e); context.beginPath(); context.moveTo(x, y); };
    const draw = (e: MouseEvent | TouchEvent) => { if (!isDrawing.current) return; e.preventDefault(); const { x, y } = getCoords(e); context.lineTo(x, y); context.strokeStyle = 'rgba(100, 150, 255, 0.7)'; context.lineWidth = brushSize; context.lineCap = 'round'; context.lineJoin = 'round'; context.stroke(); };
    const stopDrawing = () => { if (isDrawing.current) { isDrawing.current = false; context.closePath(); } };
    canvas.addEventListener('mousedown', startDrawing); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseup', stopDrawing); canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing); canvas.addEventListener('touchmove', draw); canvas.addEventListener('touchend', stopDrawing);
    return () => {
      canvas.removeEventListener('mousedown', startDrawing); canvas.removeEventListener('mousemove', draw); canvas.removeEventListener('mouseup', stopDrawing); canvas.removeEventListener('mouseout', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing); canvas.removeEventListener('touchmove', draw); canvas.removeEventListener('touchend', stopDrawing);
    };
  }, [isMasking, brushSize]);

  const AutoSaveIndicator = () => (
    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 h-5">
        {autoSaveStatus === 'saving' && <><SpinnerIcon className="w-4 h-4" /><span>Saving...</span></>}
        {autoSaveStatus === 'saved' && lastAutoSaved && <><CheckIcon className="w-4 h-4 text-green-500" /><span>Saved at {lastAutoSaved}</span></>}
        {autoSaveStatus === 'error' && <span className="text-red-500">Auto-save failed</span>}
        {autoSaveStatus === 'idle' && lastAutoSaved && <span>Last saved at {lastAutoSaved}</span>}
    </div>
  );

  const uploadButtonClass = theme === 'light' ? 'bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600' : 'bg-indigo-600 hover:bg-indigo-700';
  const downloadButtonClass = theme === 'light' ? 'bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-600 hover:to-emerald-600' : 'bg-green-600 hover:bg-green-700';
  const generateButtonClass = theme === 'light' ? 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600' : 'bg-teal-600 hover:bg-teal-700';
  const editButtonClass = theme === 'light' ? 'bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700' : 'bg-purple-600 hover:bg-purple-700';
  const threeDButtonClass = theme === 'light' ? 'bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600' : 'bg-orange-600 hover:bg-orange-700';
  const upscaleButtonClass = theme === 'light' ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600' : 'bg-amber-600 hover:bg-amber-700';

  return (
    <div className="container mx-auto p-4 md:p-8 h-full flex flex-col">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 flex-grow">
        <div className="md:col-span-1 bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-black/5 dark:border-white/10 flex flex-col space-y-6 overflow-y-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-gray-300/50 dark:border-gray-700 pb-4">Photo Controls</h2>
          
          <div className="space-y-4">
            <button onClick={triggerFileInput} title="Upload (Ctrl+O)" className={`w-full text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 ${uploadButtonClass}`}>
              {photoState.imageSrc ? 'Change Image' : 'Upload Image'}
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            <button onClick={downloadImage} disabled={!displaySrc} title="Download (Ctrl+S)" className={`w-full flex items-center justify-center gap-2 text-white font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-gray-500 dark:disabled:bg-gray-600 disabled:cursor-not-allowed ${downloadButtonClass}`}>
              <DownloadIcon /><span>Download Image</span>
            </button>
          </div>
          
           <div className="space-y-4 pt-4 border-t border-gray-300/50 dark:border-gray-700">
              <div className="flex justify-between items-center">
                 <h3 className="text-lg font-semibold">Project</h3>
                 <AutoSaveIndicator />
              </div>
             <div className="grid grid-cols-3 gap-4">
                <button onClick={handleSaveProject} title="Save Project" className="w-full flex items-center justify-center gap-2 bg-gray-500/40 hover:bg-gray-500/60 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-lg transition duration-300">
                    <SaveIcon /><span>Save</span>
                </button>
                <button onClick={handleLoadProject} title="Load Project" className="w-full flex items-center justify-center gap-2 bg-gray-500/40 hover:bg-gray-500/60 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-lg transition duration-300">
                    <LoadIcon /><span>Load</span>
                </button>
                <button onClick={handleClearProject} title="Clear Project" className="w-full flex items-center justify-center gap-2 bg-red-500/80 hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300">
                    <TrashIcon /><span>Clear</span>
                </button>
             </div>
             <h3 className="text-lg font-semibold pt-4 border-t border-gray-300/50 dark:border-gray-700">History</h3>
             <div className="flex gap-4">
               <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" className="w-full flex items-center justify-center gap-2 bg-gray-500/40 hover:bg-gray-500/60 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                  <UndoIcon /><span>Undo</span>
               </button>
               <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" className="w-full flex items-center justify-center gap-2 bg-gray-500/40 hover:bg-gray-500/60 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                  <RedoIcon /><span>Redo</span>
               </button>
            </div>
          </div>
          
          <div className="pt-4 border-t border-gray-300/50 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-2">AI Image Generator</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Create a new image from a text description.</p>
            <div className="relative">
                <textarea value={generationPrompt} onChange={(e) => setGenerationPrompt(e.target.value)} placeholder="e.g., a futuristic cityscape at sunset"
                    className="w-full p-2 pr-10 bg-white/40 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-violet-500 dark:focus:ring-indigo-500 focus:outline-none" rows={3}/>
                <button onClick={() => handleSuggestPrompt('photo')} disabled={isSuggesting} title="Suggest a prompt" className="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white rounded-full bg-white/30 dark:bg-gray-800/30 hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors">
                  {isSuggesting ? <SpinnerIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
                </button>
            </div>
            <div className="my-3">
                <label className="text-sm font-medium">Aspect Ratio</label>
                <div className="grid grid-cols-5 gap-2 mt-1">
                    {(['1:1', '16:9', '9:16', '4:3', '3:4'] as const).map(ratio => (
                        <button key={ratio} onClick={() => setAspectRatio(ratio)} className={`py-1 px-2 text-xs rounded-md transition-all duration-200 ${aspectRatio === ratio ? 'bg-violet-500 text-white dark:bg-indigo-500' : 'bg-gray-500/20 dark:bg-gray-700 hover:bg-gray-500/30 dark:hover:bg-gray-600'}`}>{ratio}</button>
                    ))}
                </div>
            </div>
            <button onClick={handleGenerateImage} disabled={isGenerating} title="Generate (Alt+G)" className={`w-full flex items-center justify-center gap-2 text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:bg-gray-500 dark:disabled:bg-gray-600 ${generateButtonClass}`}>
                {isGenerating ? <><SpinnerIcon /> Generating...</> : 'Generate Image'}
            </button>
            {generationError && <p className="text-red-500 dark:text-red-400 text-sm mt-2">{generationError}</p>}
          </div>

          <div className="pt-4 border-t border-gray-300/50 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-2">AI Image Editor</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Modify your image using text commands.</p>
            <div className="relative">
                <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} placeholder="e.g., add a dragon in the sky"
                    className="w-full p-2 pr-10 bg-white/40 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-violet-500 dark:focus:ring-indigo-500 focus:outline-none" rows={2} disabled={!photoState.imageSrc}/>
                <button onClick={() => handleSuggestPrompt('edit')} disabled={isSuggesting || !photoState.imageSrc} title="Suggest a prompt" className="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white rounded-full bg-white/30 dark:bg-gray-800/30 hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50">
                  {isSuggesting ? <SpinnerIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
                </button>
            </div>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="masking-toggle" className="text-sm font-medium">Edit Area (Mask)</label>
                <button onClick={() => setIsMasking(!isMasking)} disabled={!photoState.imageSrc} className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${isMasking ? 'bg-red-500 text-white' : 'bg-gray-500/30 dark:bg-gray-600'}`}>{isMasking ? 'Cancel' : 'Select'}</button>
              </div>
              {isMasking && (
                <div className="p-3 bg-gray-500/10 dark:bg-gray-900/50 rounded-lg space-y-3">
                  <div className="flex items-center gap-3">
                    <label htmlFor="brush-size" className="text-sm">Brush</label>
                    <input type="range" id="brush-size" min="5" max="50" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full h-2 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500 dark:accent-indigo-500"/>
                  </div>
                    <button onClick={clearCanvas} className="w-full text-xs bg-gray-500 hover:bg-gray-600 text-white py-1 rounded-md">Clear Mask</button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
                <button onClick={handleAiEdit} disabled={isEditing || !photoState.imageSrc} title="Apply Edit (Alt+E)" className={`w-full flex items-center justify-center gap-2 text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:bg-gray-500 dark:disabled:bg-gray-600 ${editButtonClass}`}>
                    {activeAiTask === 'edit' ? <><SpinnerIcon /> Editing...</> : 'Apply Edit'}
                </button>
                <button onClick={handle3DEffect} disabled={isEditing || !photoState.imageSrc} title="Apply 3D Effect (Alt+D)" className={`w-full flex items-center justify-center gap-2 text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:bg-gray-500 dark:disabled:bg-gray-600 ${threeDButtonClass}`}>
                    {activeAiTask === '3d' ? <><SpinnerIcon /> Applying...</> : '3D Effect'}
                </button>
            </div>
            {editError && <p className="text-red-500 dark:text-red-400 text-sm mt-2">{editError}</p>}
          </div>
          
          <div className="pt-4 border-t border-gray-300/50 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-2">AI Upscaler</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Enhance image resolution and details using AI.</p>
            <textarea
              value={upscalePrompt}
              onChange={(e) => setUpscalePrompt(e.target.value)}
              placeholder="Optional: Specify details to enhance (e.g., 'sharpen the textures')"
              className="w-full p-2 bg-white/40 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-violet-500 dark:focus:ring-indigo-500 focus:outline-none"
              rows={2}
              disabled={!photoState.imageSrc || isEditing}
            />
            <button
              onClick={handleUpscale}
              disabled={isEditing || !photoState.imageSrc}
              title="Upscale Image (Alt+U)"
              className={`w-full flex items-center justify-center gap-2 text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:bg-gray-500 dark:disabled:bg-gray-600 mt-3 ${upscaleButtonClass}`}
            >
              {activeAiTask === 'upscale' ? <><SpinnerIcon /> Upscaling...</> : 'Upscale Image'}
            </button>
          </div>

          <div className="pt-4 border-t border-gray-300/50 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-2">Manual Filters</h3>
            <div className="grid grid-cols-3 gap-2">
              {filters.map((filter) => (
                <button key={filter.name} onClick={() => applyFilter(filter.style)} disabled={!photoState.imageSrc} className={`py-2 px-3 text-sm rounded-md transition-all duration-200 ${photoState.activeFilter === filter.style ? 'bg-violet-500 text-white dark:bg-indigo-500' : 'bg-gray-500/20 dark:bg-gray-700 hover:bg-gray-500/30 dark:hover:bg-gray-600'}`}>
                  {filter.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="md:col-span-2 bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg rounded-xl p-4 shadow-2xl border border-black/5 dark:border-white/10 flex items-center justify-center relative overflow-hidden">
          {isRestoring ? (
            <div className="text-center text-gray-500 dark:text-gray-400 space-y-4">
              <SpinnerIcon className="mx-auto h-16 w-16" />
              <h3 className="mt-4 text-xl font-semibold">Restoring Project...</h3>
            </div>
          ) : !displaySrc ? (
            <div className="text-center text-gray-500 dark:text-gray-400">
              <PhotoIcon className="mx-auto h-24 w-24 opacity-10" />
              <h3 className="mt-4 text-xl font-semibold">Photo Editor</h3>
              <p className="mt-1">Upload an image to start editing or generate one with AI.</p>
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                ref={imageRef}
                src={displaySrc}
                alt="Your masterpiece"
                className="max-w-full max-h-full object-contain transition-all duration-300"
                style={{ filter: photoState.activeFilter }}
                onLoad={setupCanvas}
              />
              {isMasking && <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full cursor-crosshair z-10" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoEditor;