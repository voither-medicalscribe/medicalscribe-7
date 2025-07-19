import { useCallback, useEffect, useRef, useState } from 'react';
import { getAzureSpeechConfig } from '../src/services/azureSpeech';
import type { SpeechSegment, TranscriptionProvider } from '../types';
import { getAzureSpeechToken } from '../src/services/api';

// const SPEECH_CONFIG = {
//   region: 'brazilsouth',
//   language: 'pt-BR',
//   // Token será obtido dinamicamente do backend via Managed Identity
//   tokenEndpoint: '/api/get-azure-speech-token'
// };

const mapAzureErrorCodeToMessage = (errorCode: string) => {
    switch (errorCode) {
        case 'ConnectionFailure':
            return 'Falha na conexão com o serviço de fala. Verifique sua conexão com a internet.';
        case 'AuthenticationFailure':
            return 'Falha na autenticação com o serviço de fala. Token pode estar expirado.';
        case 'ServiceTimeout':
            return 'O serviço de fala não respondeu a tempo. Tente novamente mais tarde.';
        case 'BadRequest':
            return 'Requisição inválida para o serviço de fala. Verifique a configuração.';
        default:
            return `Ocorreu um erro inesperado no serviço de fala (Código: ${errorCode})`;
    }
};

export const useSpeechToText = (provider: TranscriptionProvider) => {
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [segments, setSegments] = useState<SpeechSegment[]>([]);
  const [fullText, setFullText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Azure specific refs
  const transcriberRef = useRef<any>(null);
  const speakerMapRef = useRef<Map<string, 'Médico' | 'Paciente'>>(new Map());

  const isRecorderReady = provider === 'azure' && isSdkReady;

  // Inicialização do SDK do Azure Speech seguindo melhores práticas
  useEffect(() => {
    if (provider === 'azure') {
      setIsSdkReady(false);
      setError(null);
      
      // Verifica se o SDK está carregado
      const checkSdkReady = () => {
        if (typeof window !== 'undefined' && window.Microsoft?.CognitiveServices?.Speech) {
          setIsSdkReady(true);
        } else {
          setError('SDK do Azure Speech não carregado. Verifique a configuração.');
        }
      };

      // Verifica imediatamente ou aguarda carregamento
      if (document.readyState === 'complete') {
        checkSdkReady();
        return; // Retorna undefined quando não há cleanup necessário
      } else {
        const handleLoad = () => checkSdkReady();
        window.addEventListener('load', handleLoad);
        return () => window.removeEventListener('load', handleLoad);
      }
    }
    // Retorna undefined quando provider !== 'azure'
    return;
  }, [provider]);

  const stopAzureTranscription = useCallback(() => {
    if (transcriberRef.current) {
      transcriberRef.current.stopTranscribingAsync(() => {
        transcriberRef.current.close();
        transcriberRef.current = null;
        setIsListening(false);
      });
    }
  }, []);

  const startAzureTranscription = useCallback(async () => {
    try {
      // Usa Managed Identity via backend para obter token
      const { token } = await getAzureSpeechToken();
      const speechConfig = getAzureSpeechConfig(token);
      
      if (!speechConfig) {
        setError("Não foi possível configurar o Azure Speech SDK.");
        return;
      }
      
      const audioConfig = window.Microsoft.CognitiveServices.Speech.Audio.AudioConfig.fromDefaultMicrophoneInput();
      const transcriber = new window.Microsoft.CognitiveServices.Speech.ConversationTranscriber(speechConfig, audioConfig);

      transcriberRef.current = transcriber;
      
      transcriber.transcribed = (_s: any, e: any) => {
        if (e.result.reason === window.Microsoft.CognitiveServices.Speech.ResultReason.RecognizedSpeech && e.result.text) {
          const speakerId = e.result.speakerId;
          let speakerName: 'Médico' | 'Paciente' = speakerMapRef.current.get(speakerId) ?? (speakerMapRef.current.size === 0 ? 'Médico' : 'Paciente');
          if (!speakerMapRef.current.has(speakerId)) {
             speakerMapRef.current.set(speakerId, speakerName);
          }
          const newSegment: SpeechSegment = { speaker: speakerName, text: e.result.text };
          setSegments(prev => [...prev, newSegment]);
          setFullText(prev => (prev ? `${prev}\n` : '') + `${speakerName}: ${e.result.text}`);
        }
      };
      
      transcriber.canceled = (_s: any, e: any) => {
        let errorMessage = `A transcrição foi cancelada (Razão: ${window.Microsoft.CognitiveServices.Speech.CancellationReason[e.reason]}).`;
        if (e.reason === window.Microsoft.CognitiveServices.Speech.CancellationReason.Error) {
            errorMessage = `ERRO: ${mapAzureErrorCodeToMessage(e.errorCode)}. Detalhes: ${e.errorDetails}`;
        }
        setError(errorMessage);
        stopAzureTranscription();
      };
      
      transcriber.sessionStarted = () => {
        setIsListening(true);
        setError(null);
        setSegments([]);
        setFullText('');
        speakerMapRef.current.clear();
      };
      
      transcriber.sessionStopped = () => setIsListening(false);
      transcriber.startTranscribingAsync();
    } catch (err: any) {
      setError(`Não foi possível iniciar a transcrição com Azure: ${err.message || err}`);
    }
  }, [stopAzureTranscription]);

  const startListening = useCallback(async () => {
     try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        if (provider === 'azure') {
          await startAzureTranscription();
        }
     } catch (err) {
        setError("A permissão do microfone é necessária. Habilite-a nas configurações do seu navegador.");
        return;
     }
  }, [provider, startAzureTranscription]);

  const stopListening = useCallback(() => {
    if (provider === 'azure') {
      stopAzureTranscription();
    }
  }, [provider, stopAzureTranscription]);

  useEffect(() => {
    return () => {
      if (transcriberRef.current) stopAzureTranscription();
    };
  }, [stopAzureTranscription]);

  return {
    segments,
    fullText,
    isListening,
    startListening,
    stopListening,
    error,
    isRecorderReady,
  };
};
