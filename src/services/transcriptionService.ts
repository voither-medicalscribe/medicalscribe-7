import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

const API_BASE_URL = '/api';

// Helper functions
const getHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? window.localStorage?.getItem('authToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

async function handleApiResponse<T = unknown>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' })) as { message?: string };
    throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
  }
  
  return response.json() as Promise<T>;
}

export interface TranscriptionSegment {
  timestamp: string;
  text: string;
  speaker: string;
  confidence: number;
}

export interface TranscriptionUpdate {
  type: 'transcription' | 'processing' | 'error' | 'session_complete';
  sessionId: string;
  segment?: TranscriptionSegment;
  status?: string;
  message?: string;
  audioUrl?: string;
  totalSegments?: number;
  duration?: number;
}

interface StartSessionResponse {
  sessionId: string;
  status: string;
}

interface StopSessionResponse extends TranscriptionUpdate {
  transcription?: string;
}

export class TranscriptionService {
  private connection: HubConnection | null = null;
  private onUpdateCallback: ((update: TranscriptionUpdate) => void) | null = null;
  private sessionId: string | null = null;

  constructor(connection: HubConnection) {
    this.connection = connection;
    this.setupHandlers();
  }

  private setupHandlers(): void {
    if (!this.connection) return;

    // Handler para novos segmentos de transcrição
    this.connection.on('newTranscriptionSegment', (update: TranscriptionUpdate) => {
      if (this.onUpdateCallback) {
        this.onUpdateCallback(update);
      }
    });

    // Handler para sessão iniciada
    this.connection.on('sessionStarted', (data: StartSessionResponse) => {
      console.log('Sessão iniciada:', data);
    });

    // Handler para sessão completa
    this.connection.on('sessionCompleted', (update: TranscriptionUpdate) => {
      if (this.onUpdateCallback) {
        this.onUpdateCallback(update);
      }
    });

    // Handler para erros
    this.connection.on('error', (error: { message: string; sessionId?: string }) => {
      console.error('Erro na transcrição:', error);
      if (this.onUpdateCallback && error.sessionId) {
        this.onUpdateCallback({
          type: 'error',
          sessionId: error.sessionId,
          message: error.message,
          status: 'error'
        });
      }
    });
  }

  public onUpdate(callback: (update: TranscriptionUpdate) => void): void {
    this.onUpdateCallback = callback;
  }

  public async startSession(patientId: string): Promise<string> {
    try {
      const response = await fetch(`${API_BASE_URL}/transcription`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          action: 'start',
          patientId,
          clinicianId: 'current-clinician',
        }),
      });

      const data = await handleApiResponse<StartSessionResponse>(response);
      
      if (!data.sessionId) {
        throw new Error('Resposta inválida do servidor: sessionId não encontrado');
      }

      this.sessionId = data.sessionId;
      return data.sessionId;
    } catch (error) {
      console.error('Erro ao iniciar sessão:', error);
      throw new Error(`Falha ao iniciar sessão de transcrição: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  public async sendAudioChunk(audioData: ArrayBuffer): Promise<void> {
    if (!this.sessionId) {
      throw new Error('Sessão de transcrição não iniciada');
    }

    try {
      // Converte ArrayBuffer para base64
      const base64Audio = btoa(
        new Uint8Array(audioData).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );

      const response = await fetch(`${API_BASE_URL}/transcription`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          action: 'audio',
          sessionId: this.sessionId,
          audioData: base64Audio,
        }),
      });

      await handleApiResponse(response);
    } catch (error) {
      console.error('Erro ao enviar áudio:', error);
      throw new Error(`Falha ao enviar chunk de áudio: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  public async stopSession(): Promise<TranscriptionUpdate> {
    if (!this.sessionId) {
      throw new Error('Sessão de transcrição não iniciada');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/transcription`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          action: 'stop',
          sessionId: this.sessionId,
        }),
      });

      const result = await handleApiResponse<StopSessionResponse>(response);
      this.sessionId = null;
      
      // Retorna o resultado completo com tipo correto
      return {
        type: 'session_complete',
        sessionId: result.sessionId || this.sessionId!,
        status: result.status || 'completed',
        message: result.message || 'Sessão finalizada',
        audioUrl: result.audioUrl,
        totalSegments: result.totalSegments,
        duration: result.duration,
      };
    } catch (error) {
      console.error('Erro ao parar sessão:', error);
      throw new Error(`Falha ao finalizar sessão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public isSessionActive(): boolean {
    return this.sessionId !== null;
  }

  public cleanup(): void {
    if (this.connection) {
      this.connection.off('newTranscriptionSegment');
      this.connection.off('sessionStarted');
      this.connection.off('sessionCompleted');
      this.connection.off('error');
    }
    this.onUpdateCallback = null;
    this.sessionId = null;
  }
}

// Factory function para criar uma instância do TranscriptionService
export function createTranscriptionService(hubUrl?: string): TranscriptionService {
  const url = hubUrl || `${API_BASE_URL.replace('/api', '')}/transcriptionHub`;
  
  const connection = new HubConnectionBuilder()
    .withUrl(url, {
      accessTokenFactory: () => {
        const token = typeof window !== 'undefined' ? window.localStorage?.getItem('authToken') : null;
        return token || '';
      }
    })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Information)
    .build();

  return new TranscriptionService(connection);
}
