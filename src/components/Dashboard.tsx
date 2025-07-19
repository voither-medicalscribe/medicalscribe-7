import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ICONS, LOGO_URL } from '../constants';
import type { Document, ChatMessage, Agent, User } from '../types';
import Modal from './Modal';
import Spinner from './Spinner';
import { useTimer } from '../hooks/useTimer';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { generateSoapDocument, getChatResponse } from '../services/api';
import TranscriptionWidget from './TranscriptionWidget';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

interface Toast {
    id: number;
    message: string;
    type: 'error' | 'info';
}

export type TranscriptionProvider = 'azure';

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const [timerDuration, setTimerDuration] = useState(30); // in minutes
  const [transcriptionProvider, setTranscriptionProvider] = useState<TranscriptionProvider>('azure');

  const [isWidgetVisible, setWidgetVisible] = useState(false);
  const [isWidgetMinimized, setWidgetMinimized] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);

  const addToast = useCallback((message: string, type: 'error' | 'info' = 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const playAlarm = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const context = audioContextRef.current;
    if (context.state === 'suspended') {
      context.resume();
    }
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, context.currentTime);
    gainNode.gain.setValueAtTime(0.5, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 1);
    addToast("O tempo da consulta terminou.", 'info');
  }, [addToast]);

  const { segments, fullText, isListening, startListening, stopListening, error: speechError, isRecorderReady } = useSpeechToText(transcriptionProvider);
  const { timeLeft, startTimer, stopTimer, setTime, isRunning: isTimerRunning } = useTimer(timerDuration * 60, playAlarm);

  useEffect(() => {
    if (speechError) {
      addToast(speechError, 'error');
    }
  }, [speechError, addToast]);

  const isRecording = isListening;
  const hasFinishedRecording = !isListening && fullText.length > 0;
  
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleToggleRecording = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
      setWidgetVisible(true);
      setWidgetMinimized(false);
    }
  }, [isListening, startListening, stopListening]);

  const handleCloseWidget = useCallback(() => {
    stopListening();
    setWidgetVisible(false);
  }, [stopListening]);
  
  const handleStartTimer = useCallback(() => {
      setTime(timerDuration * 60);
      startTimer();
  }, [startTimer, setTime, timerDuration]);
  
  const handleTimerDurationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const newDuration = Number(e.target.value);
      if (newDuration > 0) {
          setTimerDuration(newDuration);
          if (!isTimerRunning) {
              setTime(newDuration * 60);
          }
      }
  }, [isTimerRunning, setTime]);


  const handleGenerateDocs = useCallback(async () => {
    if (!fullText) {
      addToast("Não há transcrição para gerar documentos.", 'info');
      return;
    }
    setIsGeneratingDocs(true);
    try {
      const soapContent = await generateSoapDocument(fullText);
      const newDoc: Document = {
        id: `soap-ai-${Date.now()}`,
        title: 'Nota SOAP (IA)',
        content: soapContent,
        isAI: true,
      };
      setDocuments(prev => [...prev, newDoc]);
      setSelectedDocument(newDoc);
      setActiveModal('document');

    } catch (error) {
      console.error("Docs Generation Error:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      addToast(`Falha ao gerar documento com a IA. Detalhes: ${errorMessage}`);
    } finally {
      setIsGeneratingDocs(false);
    }
  }, [fullText, addToast]);

  const handleExportTranscription = useCallback(() => {
    if (segments.length === 0) {
        addToast("Não há transcrição para exportar.", 'info');
        return;
    }

    const fileContent = segments.map(seg => `${seg.speaker}: ${seg.text}`).join('\n\n');
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transcricao-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }, [segments, addToast]);

  const handleSendChatMessage = useCallback(async () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = { role: 'user', content: chatInput };
    const historyForApi = [...chatHistory, userMessage];

    setChatHistory(historyForApi);
    setChatInput('');
    setIsChatting(true);

    try {
        const modelResponse = await getChatResponse(historyForApi, fullText);
        const modelMessage: ChatMessage = { role: 'assistant', content: modelResponse };
        setChatHistory(prev => [...prev, modelMessage]);
    } catch (error) {
        console.error("Chat Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        addToast(`Falha ao comunicar com o assistente. Detalhes: ${errorMessage}`);
        const errorChatMessage: ChatMessage = { role: 'assistant', content: `Desculpe, ocorreu um erro ao processar sua pergunta.` };
        setChatHistory(prev => [...prev, errorChatMessage]);
    } finally {
        setIsChatting(false);
    }
  }, [chatInput, chatHistory, fullText, addToast]);


  const agents: Agent[] = useMemo(() => [
    { name: 'Transcrição', active: isRecording },
    { name: 'Geração de Docs', active: isGeneratingDocs },
    { name: 'Assistente de Chat', active: isChatting },
  ], [isRecording, isGeneratingDocs, isChatting]);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="flex h-screen w-screen bg-brand-background">
      <ToastContainer toasts={toasts} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col h-screen">
        <Navbar onMenuClick={() => setSidebarOpen(o => !o)} onLogout={onLogout} isRecording={isRecording} user={user} />
        <AgentStatus agents={agents} />
        
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 h-full">
            <div className="lg:col-span-1 xl:col-span-1 flex flex-col gap-6">
              <ControlsPanel 
                isRecording={isRecording}
                onToggleRecording={handleToggleRecording}
                hasFinishedRecording={hasFinishedRecording}
                onGenerateDocs={handleGenerateDocs}
                isGeneratingDocs={isGeneratingDocs}
                onExportTranscription={handleExportTranscription}
                timerDisplay={formatTime(timeLeft)}
                onTimerDurationChange={handleTimerDurationChange}
                timerDuration={timerDuration}
                onStartTimer={handleStartTimer}
                onStopTimer={stopTimer}
                isTimerRunning={isTimerRunning}
                isRecorderReady={isRecorderReady}
                provider={transcriptionProvider}
                onProviderChange={(e) => setTranscriptionProvider(e.target.value as TranscriptionProvider)}
              />
              <DocumentsPanel 
                documents={documents} 
                onSelectDocument={(doc) => {
                  setSelectedDocument(doc);
                  setActiveModal('document');
                }}
              />
            </div>

            <div className="lg:col-span-2 xl:col-span-3 flex flex-col">
              <ChatPanel 
                chatHistory={chatHistory} 
                chatInput={chatInput} 
                onChatInputChange={(e) => setChatInput(e.target.value)}
                onSendChatMessage={handleSendChatMessage}
                isChatting={isChatting}
                chatMessagesRef={chatMessagesRef}
              />
            </div>
          </div>
        </main>
      </div>
      
      {isWidgetVisible && (
        <TranscriptionWidget
          segments={segments}
          isRecording={isRecording}
          isMinimized={isWidgetMinimized}
          onToggleMinimize={() => setWidgetMinimized(m => !m)}
          onClose={handleCloseWidget}
        />
      )}

      {activeModal === 'document' && selectedDocument && (
        <Modal title={selectedDocument.title} onClose={() => setActiveModal(null)} size="large">
            <textarea
                readOnly
                title="Conteúdo do documento"
                placeholder="Conteúdo do documento será exibido aqui..."
                className="w-full h-[60vh] p-4 font-mono bg-gray-100 rounded-lg border border-brand-border focus:ring-2 focus:ring-blue-500 shadow-neumorphic-inset"
                value={selectedDocument.content}
            />
        </Modal>
      )}
    </div>
  );
};

// --- Sub-components ---

const ToastContainer: React.FC<{toasts: Toast[]}> = ({ toasts }) => (
    <div className="fixed top-5 right-5 z-[100] w-full max-w-sm space-y-3">
        {toasts.map(toast => (
            <div key={toast.id} className={`flex items-start p-4 rounded-lg shadow-xl text-white animate-fade-in-down ${toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}>
                <div className="flex-shrink-0">
                    {toast.type === 'error' ? ICONS.alert : ICONS.info}
                </div>
                <div className="ml-3">
                    <p className="text-sm font-medium">{toast.message}</p>
                </div>
            </div>
        ))}
    </div>
)

const Navbar: React.FC<{onMenuClick: () => void, onLogout: () => void, isRecording: boolean, user: User}> = ({onMenuClick, onLogout, isRecording, user}) => (
    <header className="flex-shrink-0 bg-brand-surface/95 backdrop-blur-sm border-b border-brand-border h-20 flex items-center px-6 justify-between z-20 shadow-neumorphic">
        <div className="flex items-center gap-4">
            <button onClick={onMenuClick} className="p-2 -ml-2 text-brand-text-secondary hover:text-brand-text-primary">{ICONS.menu}</button>
            <img src={LOGO_URL} alt="Voither Logo" className="h-10" />
        </div>
        <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 text-sm ${isRecording ? 'text-red-500' : 'text-brand-text-secondary'}`}>
                <span className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></span>
                {isRecording ? 'Gravando' : 'Inativo'}
            </div>
            <span className="text-sm font-medium text-brand-text-secondary">{user.name}</span>
            <button onClick={onLogout} title="Sair" className="p-2 text-brand-text-secondary hover:text-red-500 transition-colors">{ICONS.logout}</button>
        </div>
    </header>
);

const AgentStatus: React.FC<{agents: Agent[]}> = ({agents}) => (
    <div className="flex-shrink-0 bg-brand-background border-b border-brand-border h-10 flex items-center px-6 justify-center gap-6 shadow-neumorphic-inset">
        {agents.map(agent => (
            <div key={agent.name} className="flex items-center gap-2 text-xs text-brand-text-secondary">
                <span>{agent.name}</span>
                <span className={`w-2 h-2 rounded-full transition-colors ${agent.active ? 'bg-green-500' : 'bg-gray-400'}`}></span>
            </div>
        ))}
    </div>
);

const Sidebar: React.FC<{isOpen: boolean, onClose: () => void}> = ({isOpen, onClose}) => (
    <>
      <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}></div>
      <aside className={`fixed top-0 left-0 h-full bg-brand-surface border-r border-brand-border w-72 p-6 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <h2 className="text-lg font-bold font-display">Detalhes da Consulta</h2>
          <div className="mt-6 space-y-4">
              <div>
                  <label className="text-xs text-brand-text-secondary">ID da Sessão</label>
                  <input type="text" readOnly value="SESS-001" title="ID da Sessão" className="w-full mt-1 p-2 bg-gray-100 rounded-md border-brand-border text-sm shadow-neumorphic-inset" />
              </div>
              <div>
                  <label className="text-xs text-brand-text-secondary">Nome do Paciente</label>
                  <input type="text" placeholder="Opcional" className="w-full mt-1 p-2 bg-white rounded-md border-brand-border text-sm shadow-neumorphic-inset" />
              </div>
          </div>
      </aside>
    </>
);

interface ControlsPanelProps {
  isRecording: boolean;
  onToggleRecording: () => void;
  hasFinishedRecording: boolean;
  onGenerateDocs: () => void;
  isGeneratingDocs: boolean;
  onExportTranscription: () => void;
  timerDisplay: string;
  onTimerDurationChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  timerDuration: number;
  onStartTimer: () => void;
  onStopTimer: () => void;
  isTimerRunning: boolean;
  isRecorderReady: boolean;
  provider: TranscriptionProvider;
  onProviderChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

const ControlsPanel: React.FC<ControlsPanelProps> = ({ isRecording, onToggleRecording, hasFinishedRecording, onGenerateDocs, isGeneratingDocs, onExportTranscription, timerDisplay, onTimerDurationChange, timerDuration, onStartTimer, onStopTimer, isTimerRunning, isRecorderReady, provider, onProviderChange }) => (
    <div className="bg-brand-surface rounded-2xl shadow-neumorphic p-6 flex flex-col gap-4">
      <h3 className="font-bold font-display text-brand-text-primary">Controles da Consulta</h3>
      
      <div className="border-b border-brand-border pb-4 space-y-3">
        <div>
            <label htmlFor="provider-select" className="text-xs font-medium text-brand-text-secondary mb-1 block">Provedor de Transcrição</label>
            <select 
                id="provider-select"
                value={provider}
                onChange={onProviderChange}
                disabled={isRecording}
                className="w-full p-2 text-sm bg-white rounded-md border border-brand-border shadow-neumorphic-inset focus:ring-2 focus:ring-blue-300 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
                <option value="azure">Azure Speech (Diarização)</option>
            </select>
        </div>
        <button 
          onClick={onToggleRecording} 
          disabled={!isRecorderReady}
          className={`w-full py-3 px-4 rounded-lg font-semibold text-white shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 ${isRecording ? 'bg-accent-red hover:bg-accent-red-hover text-white' : 'bg-accent-primary hover:bg-accent-primary-hover'} disabled:bg-slate-400 disabled:cursor-not-allowed`}
        >
          {!isRecorderReady ? (
            <>
              <Spinner />
              <span>Carregando SDK...</span>
            </>
          ) : (
            <>
              <span className="w-6 h-6">{isRecording ? ICONS.stop : ICONS.play}</span>
              <span>{isRecording ? 'Parar Gravação' : 'Iniciar Gravação'}</span>
            </>
          )}
        </button>
      </div>

      <div className="border-b border-brand-border pb-4 pt-2">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-brand-text-secondary">Timer</span>
          
          {isTimerRunning ? (
              <span className="font-mono text-xl text-brand-text-primary px-2">{timerDisplay}</span>
          ) : (
              <div className="flex items-center gap-1">
                  <label htmlFor="timer-duration-input" className="sr-only">Duração do timer em minutos</label>
                  <input 
                      id="timer-duration-input"
                      type="number" 
                      title="Duração do timer em minutos"
                      placeholder="30"
                      onChange={onTimerDurationChange} 
                      value={timerDuration} 
                      disabled={isTimerRunning} 
                      className="w-16 p-1 text-center bg-white rounded-md border border-brand-border shadow-neumorphic-inset disabled:bg-gray-100" 
                  />
                  <span className="text-sm text-brand-text-secondary">min</span>
              </div>
          )}

          <button 
              onClick={isTimerRunning ? onStopTimer : onStartTimer} 
              className="py-2 px-4 rounded-lg font-semibold text-white shadow-sm hover:shadow-md transition-all text-sm w-24
                          bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-500"
          >
              {isTimerRunning ? 'Parar' : 'Iniciar'}
          </button>
        </div>
      </div>
      
       {hasFinishedRecording && (
         <div className="pt-2 flex flex-col gap-3">
            <button onClick={onGenerateDocs} disabled={isGeneratingDocs} className="w-full py-3 px-4 rounded-lg font-semibold text-white bg-accent-ai hover:bg-accent-ai-hover shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50">
              {isGeneratingDocs ? (
                <>
                  <Spinner />
                  <span>Gerando...</span>
                </>
              ) : (
                <>
                  <span role="img" aria-label="sparkles" className="mr-1">✨</span>
                  <span>Gerar Documentos</span>
                </>
              )}
            </button>
            <button onClick={onExportTranscription} className="w-full py-3 px-4 rounded-lg font-semibold text-brand-accent border border-brand-accent bg-white hover:bg-slate-50 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-center gap-2">
                {ICONS.download}
                <span>Exportar Transcrição</span>
            </button>
         </div>
       )}
    </div>
);

const DocumentsPanel: React.FC<{documents: Document[], onSelectDocument: (doc: Document) => void}> = ({ documents, onSelectDocument }) => (
    <div className="bg-brand-surface rounded-2xl shadow-neumorphic p-6 flex-1 flex flex-col min-h-0">
        <h3 className="font-bold font-display text-brand-text-primary mb-4">
            <span className="flex items-center gap-2">{ICONS.file} <span>Documentos</span></span>
        </h3>
        <div className="flex-1 overflow-y-auto -mr-2 pr-2">
            {documents.length > 0 ? (
                <div className="space-y-2">
                    {documents.map(doc => (
                        <div key={doc.id} onClick={() => onSelectDocument(doc)} className="p-3 bg-accent-primary rounded-lg cursor-pointer hover:bg-accent-primary-hover transition-colors">
                            <p className="font-semibold text-sm text-white">{doc.title}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex items-center justify-center h-full text-sm text-brand-text-secondary">
                    <p>Nenhum documento gerado.</p>
                </div>
            )}
        </div>
    </div>
);

const ChatPanel: React.FC<{ chatHistory: ChatMessage[], chatInput: string, onChatInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void, onSendChatMessage: () => void, isChatting: boolean, chatMessagesRef: React.RefObject<HTMLDivElement> }> = ({ chatHistory, chatInput, onChatInputChange, onSendChatMessage, isChatting, chatMessagesRef }) => (
    <div className="bg-brand-surface rounded-2xl shadow-neumorphic p-6 flex flex-col h-full">
        <h3 className="font-bold font-display text-brand-text-primary mb-4">
           <span className="flex items-center gap-2">{ICONS.comments} <span>Assistente Consultivo</span></span>
        </h3>
        <div ref={chatMessagesRef} className="flex-1 overflow-y-auto bg-gray-100 shadow-neumorphic-inset rounded-lg p-4 space-y-4 mb-4">
            {chatHistory.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-brand-text-secondary">
                    <p>Faça uma pergunta sobre a consulta.</p>
                </div>
            ) : (
                chatHistory.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-xl ${msg.role === 'user' ? 'bg-brand-accent text-white' : 'bg-white text-brand-text-primary shadow-sm'}`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                    </div>
                ))
            )}
            {isChatting && (
              <div className="flex justify-start">
                  <div className="p-3 rounded-xl bg-white text-brand-text-primary shadow-sm">
                    <Spinner/>
                  </div>
              </div>
            )}
        </div>
        <div className="flex items-center gap-2">
            <input type="text" value={chatInput} onChange={onChatInputChange} onKeyDown={(e) => e.key === 'Enter' && onSendChatMessage()} placeholder="Pergunte algo..." className="flex-1 p-3 bg-white rounded-lg border border-brand-border focus:ring-2 focus:ring-blue-300 focus:outline-none transition shadow-neumorphic-inset" />
            <button onClick={onSendChatMessage} disabled={isChatting} className="p-3 bg-accent-primary text-white rounded-lg hover:bg-accent-primary-hover disabled:opacity-50 transition-all shadow-md hover:shadow-lg">
                <span className="w-6 h-6">{ICONS.send}</span>
            </button>
        </div>
    </div>
);

export default Dashboard;