import { useEffect, useState, useCallback, useRef } from 'react';
import * as signalR from '@microsoft/signalr';

interface UseSignalROptions {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onReconnecting?: () => void;
  onError?: (error: Error) => void;
}

export const useSignalR = (options?: UseSignalROptions) => {
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [connectionState, setConnectionState] = useState<signalR.HubConnectionState>(
    signalR.HubConnectionState.Disconnected
  );
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  // Para Azure Static Web Apps, usa URL relativa
  const API_URL = '/api';

  useEffect(() => {
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/negotiate`, {
        // Em produção, adicionar token de autenticação aqui
        // accessTokenFactory: () => getAccessToken()
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: retryContext => {
          if (retryContext.elapsedMilliseconds < 60000) {
            // Se menos de 60 segundos, tenta a cada 5 segundos
            return 5000;
          } else {
            // Após 60 segundos, tenta a cada 30 segundos
            return 30000;
          }
        }
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();

    // Configurar callbacks de estado
    newConnection.onreconnecting(() => {
      console.log('SignalR reconectando...');
      setConnectionState(signalR.HubConnectionState.Reconnecting);
      options?.onReconnecting?.();
    });

    newConnection.onreconnected(() => {
      console.log('SignalR reconectado');
      setConnectionState(signalR.HubConnectionState.Connected);
      options?.onConnected?.();
    });

    newConnection.onclose(() => {
      console.log('SignalR desconectado');
      setConnectionState(signalR.HubConnectionState.Disconnected);
      options?.onDisconnected?.();
    });

    // Iniciar conexão
    const startConnection = async () => {
      try {
        await newConnection.start();
        console.log('SignalR conectado');
        setConnectionState(signalR.HubConnectionState.Connected);
        connectionRef.current = newConnection;
        setConnection(newConnection);
        options?.onConnected?.();
      } catch (error) {
        console.error('Erro ao conectar SignalR:', error);
        options?.onError?.(error as Error);
        
        // Retry após 5 segundos
        setTimeout(startConnection, 5000);
      }
    };

    startConnection();

    // Cleanup
    return () => {
      newConnection.stop();
    };
  }, [API_URL]);

  const on = useCallback((methodName: string, handler: (...args: any[]) => void) => {
    if (connectionRef.current) {
      connectionRef.current.on(methodName, handler);
    }
  }, []);

  const off = useCallback((methodName: string, handler?: (...args: any[]) => void) => {
    if (connectionRef.current) {
      if (handler) {
        connectionRef.current.off(methodName, handler);
      } else {
        connectionRef.current.off(methodName);
      }
    }
  }, []);

  const invoke = useCallback(async (methodName: string, ...args: any[]) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      try {
        return await connectionRef.current.invoke(methodName, ...args);
      } catch (error) {
        console.error(`Erro ao invocar ${methodName}:`, error);
        throw error;
      }
    } else {
      throw new Error('SignalR não está conectado');
    }
  }, []);

  return {
    connection,
    connectionState,
    isConnected: connectionState === signalR.HubConnectionState.Connected,
    isReconnecting: connectionState === signalR.HubConnectionState.Reconnecting,
    on,
    off,
    invoke
  };
};
