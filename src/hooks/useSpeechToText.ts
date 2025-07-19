import { useState, useRef, useCallback, useEffect } from 'react';
import { getAzureSpeechConfig, fetchAzureSpeechToken } from '../services/azureSpeech';
import type { SpeechSegment, TranscriptionProvider } from '../types';

declare global {
  interface Window {
    Microsoft: any;
  }
}

const SDK_URL = 'https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk@latest/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle.js';
let sdkLoadingPromise: Promise<void> | null = null;
const SCRIPT_ID = 'azure-speech-sdk';

const loadAzureSpeechSDK = (): Promise<void> => {
    if (sdkLoadingPromise) {
        return sdkLoadingPromise;
    }

    sdkLoadingPromise = new Promise((resolve, reject) => {
        if (typeof window.Microsoft?.CognitiveServices?.Speech?.SpeechConfig !== 'undefined') {
            return resolve();
        }

        document.getElementById(SCRIPT_ID)?.remove();

        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = SDK_URL;
        script.async = true;

        script.onload = () => {
            const maxAttempts = 50; // Try for 5 seconds (50 * 100ms)
            let attempts = 0;

            const checkInterval = setInterval(() => {
                attempts++;
                if (typeof window.Microsoft?.CognitiveServices?.Speech?.SpeechConfig !== 'undefined') {
                    clearInterval(checkInterval);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    sdkLoadingPromise = null; 
                    document.getElementById(SCRIPT_ID)?.remove();
                    reject(new Error("Timeout: O SDK de Fala do Azure foi carregado, mas a inicialização demorou muito. Verifique o console do navegador para erros detalhados do SDK."));
                }
            }, 100);
        };

        script.onerror = () => {
            sdkLoadingPromise = null;
            document.getElementById(SCRIPT_ID)?.remove();
            reject(new Error('Falha crítica ao carregar o script do SDK de Fala. Verifique sua conexão ou se há bloqueadores de script.'));
        };

        document.body.appendChild(script);
    });

    return sdkLoadingPromise;
};


const mapAzureErrorCodeToMessage = (errorCode: string) => {
    switch (errorCode) {
        case 'ConnectionFailure':
            return 'Falha na conexão com o serviço de fala. Verifique sua conexão com a internet.';
        case 'AuthenticationFailure':
            return 'Falha na autenticação com o serviço de fala. A chave de API pode estar incorreta ou expirada.';
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
  
  // Azure specific
  const transcriberRef = useRef<any>(null);
  const speakerMapRef = useRef<Map<string, 'Médico' | 'Paciente'>>(new Map());

  // Gemini specific
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Calcular se o gravador está pronto
  const isRecorderReady = provider === 'azure' ? isSdkReady : true;

  useEffect(() => {
    if (provider === 'azure') {
      setIsSdkReady(false);
      setError(null);
      loadAzureSpeechSDK()
        .then(() => setIsSdkReady(true))
        .catch((err: Error) => {
          console.error("SDK Initialization Failed:", err);
          setError(err.message || "Ocorreu um erro desconhecido ao carregar o SDK.");
        });
    }
  }, [provider]);

  const stopListening = useCallback(() => {
    if (transcriberRef.current) {
      transcriberRef.current.stopTranscribingAsync(() => {
        transcriberRef.current.close();
        transcriberRef.current = null;
        setIsListening(false);
      });
    }
  }, []);

  const startListening = useCallback(async () => {
    try {
      const authToken = await fetchAzureSpeechToken();
      const speechConfig = getAzureSpeechConfig(authToken.token);
      
      if (!speechConfig) {
        setError("Não foi possível carregar a configuração da Azure. O SDK pode não estar pronto.");
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
        stopListening();
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
  }, [stopListening]);

  useEffect(() => {
    return () => {
      if (transcriberRef.current) stopListening();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, [stopListening]);

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
