import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";

export const generateImageWithAI = async (
    prompt: string,
    aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' = '1:1'
): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio: aspectRatio,
        },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      return response.generatedImages[0].image.imageBytes;
    }
    
    return null;
  } catch (error) {
    console.error("Error generating image with AI:", error);
    throw new Error("Failed to communicate with the AI model for image generation. Please try again.");
  }
};

export const editImageWithAI = async (
  base64ImageData: string,
  mimeType: string,
  prompt: string
): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64ImageData,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    
    const textResponse = response.text?.trim();
    if (textResponse) {
       throw new Error(`AI could not edit the image: ${textResponse}`);
    }

    return null;
  } catch (error) {
    console.error("Error editing image with AI:", error);
    throw new Error("Failed to communicate with the AI model. Please try again.");
  }
};

export const editImageWithMaskAI = async (
  base64ImageData: string,
  mimeType: string,
  maskBase64Data: string,
  prompt: string
): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: `You are a precise photo editor. The user wants to edit an image using a mask. You MUST apply the following edit: '${prompt}'. The edit must be applied ONLY to the areas of the original image that correspond to the white parts of the provided mask. The black areas of the mask indicate parts of the image that MUST remain unchanged. Do not alter the unmasked parts of the image or the overall image dimensions. Output only the final edited image.`},
          {
            inlineData: {
              data: base64ImageData,
              mimeType: mimeType,
            },
          },
          { text: "This is the mask. Apply the edit to the white areas:" },
          {
            inlineData: {
                data: maskBase64Data,
                mimeType: 'image/png'
            }
          }
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    
    const textResponse = response.text?.trim();
    if (textResponse) {
       throw new Error(`AI could not edit the image: ${textResponse}`);
    }

    return null;
  } catch (error) {
    console.error("Error editing image with AI mask:", error);
    throw new Error("Failed to communicate with the AI model for masked editing. Please try again.");
  }
};

export const add3DEffectToImage = async (
  base64ImageData: string,
  mimeType: string,
  prompt: string
): Promise<string | null> => {
    const enhancedPrompt = `User wants to make this image 3D. The subject is '${prompt}'. Transform the image to give it a 3D effect with cinematic lighting, depth of field, and a photorealistic render quality.`;
    return editImageWithAI(base64ImageData, mimeType, enhancedPrompt);
}

export const upscaleImageWithAI = async (
  base64ImageData: string,
  mimeType: string,
  prompt: string
): Promise<string | null> => {
    const enhancedPrompt = `Upscale this image to a higher resolution. Enhance details, sharpen textures, and improve overall clarity to make it look like a high-resolution photograph. The user provided this additional guidance: "${prompt || 'General quality improvement.'}". You must only output the resulting image.`;
    return editImageWithAI(base64ImageData, mimeType, enhancedPrompt);
};

export const getVideoFilterFromPrompt = async (
  prompt: string
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Based on the user's request: "${prompt}", determine the best CSS filter property string to apply.`,
      config: {
        systemInstruction: `You are an AI assistant for a video editor. Your task is to interpret a user's text prompt and map it to a valid CSS 'filter' property string. You can use any valid CSS filter functions like grayscale(), sepia(), saturate(), hue-rotate(), invert(), opacity(), brightness(), contrast(), blur(), drop-shadow(). You can combine multiple functions. For example, for a 'vintage film' look, you might return 'sepia(0.6) contrast(1.4) brightness(0.9) grayscale(0.2)'. Your response must be a JSON object with a single key "filter" which contains the CSS filter string. If the prompt cannot be reasonably mapped to filters, the "filter" value should be an empty string.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            filter: {
              type: Type.STRING,
              description: 'The CSS filter property string to apply.',
            },
          },
        },
      },
    });

    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);

    if (typeof result.filter === 'string') {
      return result.filter;
    }
    
    throw new Error("AI response did not contain valid filter data.");
  } catch (error) {
    console.error("Error getting video filter from AI:", error);
    throw new Error("Failed to get AI video editing suggestions. Please try a different prompt.");
  }
};

export const getAIPromptSuggestion = async (context: 'photo' | 'edit' | 'video' | 'audio'): Promise<string> => {
  let prompt = '';
  switch (context) {
    case 'photo':
      prompt = "Generate a short, creative, and visually descriptive prompt for an AI image generator. The prompt should be something unique and inspiring. For example: 'a giant crystalline snail crawling on a rainbow-colored mushroom in a bioluminescent forest'.";
      break;
    case 'edit':
      prompt = "Generate a short, creative, and transformative prompt for an AI image editor. The prompt should suggest a significant change to an existing image. For example: 'change the season to a snowy winter' or 'add a fleet of futuristic spaceships in the sky'.";
      break;
    case 'video':
      prompt = "Generate a short, creative, and dynamic prompt for an AI text-to-video generator. The prompt should describe a scene with movement. For example: 'a majestic eagle soaring through a dramatic mountain range at sunset' or 'a bustling cyberpunk city street at night, with neon signs reflecting in puddles on the ground'.";
      break;
    case 'audio':
        prompt = "Generate a short, interesting topic for an AI script writer. The topic should be something that could be turned into a short audio segment. For example: 'the surprising history of the rubber duck' or 'a brief explanation of the butterfly effect'.";
        break;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are a creative assistant. Your only job is to provide a single, concise, creative prompt based on the user's request. Do not add any extra text, explanation, or quotation marks. Just provide the prompt text itself."
      }
    });
    return response.text.trim().replace(/^"|"$/g, ''); // Remove surrounding quotes if any
  } catch (error) {
    console.error(`Error suggesting ${context} prompt:`, error);
    throw new Error("Could not generate a suggestion at this time.");
  }
};

export const generateComeback = async (insult: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `The user was told: "${insult}". Generate a witty, clever, and funny comeback.`,
        config: {
            systemInstruction: `You are a world-class comedian known for your sharp, witty comebacks. Your response should be clever and funny, but not mean-spirited. Keep it concise.`,
        },
    });
    return response.text;
  } catch (error) {
    console.error("Error generating comeback:", error);
    throw new Error("I'm speechless... and not in a good way. My wit-generation circuit seems to be on the fritz.");
  }
};

export const generateAudioScript = async (topic: string): Promise<string> => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `Write a short, engaging audio script about the following topic: "${topic}". The script should be around 150-200 words and suitable for a text-to-speech engine.`,
        config: {
          systemInstruction: `You are a professional scriptwriter. Your task is to write a concise and informative audio script. The tone should be engaging and clear. Do not include any formatting like "HOST:" or scene descriptions. Just provide the narrative text.`,
        },
      });
      return response.text;
    } catch (error) {
      console.error("Error generating audio script:", error);
      throw new Error("Failed to generate a script. The topic might be too complex or there was a network issue.");
    }
  };
  
export const generateSpeech = async (text: string, voiceName: string): Promise<string | null> => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return base64Audio || null;
    } catch (error) {
      console.error("Error generating speech:", error);
      throw new Error("Failed to generate speech. The text might be too long or contain unsupported characters.");
    }
  };