import React, { useEffect, useState } from 'react';
import { useSignalR } from '../hooks/useSignalR';
import { TranscriptionService, TranscriptionUpdate } from '../services/transcriptionService';

const SessionScreen: React.FC = () => {
  const [isConnecting, setIsConnecting] = useState(true);
  const [transcriptionService, setTranscriptionService] = useState<TranscriptionService | null>(null);

  // Hook do SignalR
  const { connection, isConnected, connectionState } = useSignalR({
    onConnected: () => {
      setIsConnecting(false);
      console.log('SignalR conectado com sucesso');
    },
    onDisconnected: () => {
      console.log('SignalR desconectado');
    },
    onError: (error) => {
      console.error('Erro SignalR:', error);
      setIsConnecting(false);
    }
  });

  // Inicializa o serviço de transcrição quando conectado
  useEffect(() => {
    if (connection && isConnected) {
      const service = new TranscriptionService(connection);
      
      // Configura o callback para atualizações
      service.onUpdate((update: TranscriptionUpdate) => {
        if (update.type === 'transcription' && update.segment) {
          setTranscriptionSegments(prev => [...prev, update.segment!]);
        } else if (update.type === 'session_complete') {
          setIsRecording(false);
          console.log('Sessão completa:', update);
          // TODO: Redirecionar ou mostrar resumo
        } else if (update.type === 'error') {
          console.error('Erro na transcrição:', update.message);
        }
      });
      
      setTranscriptionService(service);
      
      return () => {
        service.cleanup();
      };
    }
  }, [connection, isConnected]);

  const [patient, setPatient] = useState({ id: 'mock-patient-id', name: 'Paciente de Teste' }); // TODO: Substituir com a lógica real de seleção de paciente

  const startRecording = async () => {
    if (!transcriptionService || !patient) {
      return;
    }

    try {
      setIsRecording(true);
      setTranscriptionSegments([]);
      
      // Inicia a sessão no backend
      const sessionId = await transcriptionService.startSession(patient.id);
      console.log('Sessão iniciada:', sessionId);
      
      // Inicia a captura de áudio
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      // Usa MediaRecorder para capturar chunks
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          // Converte Blob para ArrayBuffer
          const arrayBuffer = await event.data.arrayBuffer();
          await transcriptionService.sendAudioChunk(arrayBuffer);
        }
      };
      
      // Envia chunks a cada 1 segundo
      mediaRecorder.start(1000);
      
      // Armazena referência para parar depois
      (window as any).currentMediaRecorder = mediaRecorder;
      (window as any).currentAudioStream = stream;
      
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      // Para o MediaRecorder
      const mediaRecorder = (window as any).currentMediaRecorder;
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      
      // Para o stream de áudio
      const stream = (window as any).currentAudioStream;
      if (stream) {
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      
      // Finaliza a sessão no backend
      if (transcriptionService) {
        const result = await transcriptionService.stopSession();
        console.log('Sessão finalizada:', result);
      }
      
      setIsRecording(false);
    } catch (error) {
      console.error('Erro ao parar gravação:', error);
    }
  };

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-gradient-secondary p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Conectando ao servidor...</p>
          <p className="text-white text-sm mt-2">Status: {connectionState}</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-secondary p-6 flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-xl mb-4">Erro de conexão</p>
          <p>Não foi possível conectar ao servidor de transcrição.</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-accent-primary rounded-lg hover:bg-accent-primary-hover"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-secondary p-6 flex flex-col items-center">
      <h1 className="text-2xl text-white mb-4">Sessão de Transcrição</h1>
      <div className="w-full max-w-2xl bg-white rounded-lg p-6 shadow-lg">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Paciente: {patient.name}</h2>
        </div>
        <div className="mb-4 h-64 overflow-y-auto border p-2">
          {/* A transcrição aparecerá aqui */}
        </div>
        <div className="flex justify-center space-x-4">
          <button 
            onClick={startRecording} 
            disabled={isRecording}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            Iniciar Gravação
          </button>
          <button 
            onClick={stopRecording} 
            disabled={!isRecording}
            className="px-6 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400"
          >
            Parar Gravação
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionScreen;