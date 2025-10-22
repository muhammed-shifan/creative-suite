
export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export enum EditorTab {
  Video = 'video',
  Photo = 'photo',
  Chat = 'chat',
  Audio = 'audio',
}
