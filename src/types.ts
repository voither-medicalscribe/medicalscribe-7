
export interface User {
  name: string;
  role: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  isAI?: boolean;
}

export interface TranscriptionSegment {
  speaker: string;
  text: string;
}

// Alias para compatibilidade
export type SpeechSegment = TranscriptionSegment;

export type TranscriptionProvider = 'azure';

export interface LoginScreenProps {
  onLogin: () => void;
}

export interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export interface TranscriptionWidgetProps {
  segments: SpeechSegment[];
  isRecording: boolean;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onClose: () => void;
}

export interface Agent {
    name: string;
    active: boolean;
}