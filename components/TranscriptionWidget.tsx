import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ICONS } from '../constants';
import Spinner from './Spinner';
import type { SpeechSegment } from '../types';

interface TranscriptionWidgetProps {
    segments: SpeechSegment[];
    isRecording: boolean;
    isMinimized: boolean;
    onToggleMinimize: () => void;
    onClose: () => void;
}

const TranscriptionWidget: React.FC<TranscriptionWidgetProps> = ({ segments, isRecording, isMinimized, onToggleMinimize, onClose }) => {
    const widgetRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ x: number, y: number } | null>(null);
    const dragInfo = useRef({ isDragging: false, offsetX: 0, offsetY: 0 });

    useEffect(() => {
        // When the widget first mounts, its position is controlled by CSS.
        // This effect captures that initial position into the state,
        // so that dragging can seamlessly take over.
        if (widgetRef.current && position === null) {
            const rect = widgetRef.current.getBoundingClientRect();
            setPosition({ x: rect.left, y: rect.top });
        }
    }, [position]);

    const onDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!widgetRef.current) return;
        const rect = widgetRef.current.getBoundingClientRect();
        dragInfo.current = {
            isDragging: true,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top,
        };
        document.body.style.userSelect = 'none';
        e.currentTarget.style.cursor = 'grabbing';
        e.preventDefault();
    };

    const onDragEnd = useCallback(() => {
        if (dragInfo.current.isDragging) {
            dragInfo.current.isDragging = false;
            document.body.style.userSelect = 'auto';
            if (widgetRef.current) {
                widgetRef.current.style.cursor = 'grab';
            }
        }
    }, []);

    const onDrag = useCallback((e: MouseEvent) => {
        if (dragInfo.current.isDragging) {
            const x = e.clientX - dragInfo.current.offsetX;
            const y = e.clientY - dragInfo.current.offsetY;
            setPosition({ x, y });
        }
    }, []);

    useEffect(() => {
        const currentRef = widgetRef.current;
        if(currentRef) currentRef.style.cursor = 'grab';

        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', onDragEnd);
        return () => {
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', onDragEnd);
        };
    }, [onDrag, onDragEnd]);

    const widgetStyle = position ? { top: `${position.y}px`, left: `${position.x}px`, transform: 'none' } : {};
    const initialPositionClasses = position === null ? 'top-6 right-6' : '';

    if (isMinimized) {
        return (
             <div
                ref={widgetRef}
                style={widgetStyle}
                className={`fixed z-50 flex items-center gap-3 p-3 pr-2 rounded-2xl bg-white/95 backdrop-blur-lg shadow-2xl cursor-grab animate-fade-in-up
                            ${isRecording ? 'border border-red-500 shadow-lg shadow-red-500/20' : 'border border-gray-200'} ${initialPositionClasses}`}
                onMouseDown={onDragStart}
            >
                <div className="flex items-center gap-2">
                    <span className={`flex-shrink-0 ${isRecording ? 'text-red-500 animate-pulse' : 'text-brand-text-secondary'}`}>
                        {ICONS.soundwave}
                    </span>
                    <h2 className="text-sm font-semibold text-brand-text-primary whitespace-nowrap">
                        {isRecording ? "Gravando..." : "Pausado"}
                    </h2>
                </div>
                <div className="flex items-center">
                     <button onClick={onToggleMinimize} className="p-1.5 text-brand-text-secondary hover:text-brand-text-primary rounded-full hover:bg-slate-200/50 transition-colors" aria-label="Maximizar">
                        {ICONS.plus}
                    </button>
                    <button onClick={onClose} className="p-1.5 text-brand-text-secondary hover:text-red-500 rounded-full hover:bg-red-100/50 transition-colors" aria-label="Fechar e parar gravação">
                        {ICONS.close}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={widgetRef}
            style={widgetStyle}
            className={`fixed z-50 w-full max-w-lg bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl flex flex-col animate-fade-in-up ${isRecording ? 'border border-red-500' : 'border border-gray-200'} ${initialPositionClasses}`}
        >
            <header
                onMouseDown={onDragStart}
                className="flex items-center justify-between p-3 border-b border-gray-200 flex-shrink-0 cursor-grab"
            >
                <div className="flex items-center gap-2 text-red-500">
                    <span className="animate-pulse">{ICONS.soundwave}</span>
                    <h2 className="text-md font-bold font-display">
                        {isRecording ? "Transcrição em Tempo Real" : "Transcrição Pausada"}
                    </h2>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={onToggleMinimize} className="p-2 text-brand-text-secondary hover:text-brand-text-primary rounded-full hover:bg-slate-200/50 transition-colors" aria-label="Minimizar">
                        {ICONS.minus}
                    </button>
                    <button onClick={onClose} className="p-2 text-brand-text-secondary hover:text-red-500 rounded-full hover:bg-red-100/50 transition-colors" aria-label="Fechar e parar gravação">
                        {ICONS.close}
                    </button>
                </div>
            </header>
            <main className="p-4 flex-1 overflow-y-auto min-h-[150px] max-h-[40vh]">
                {segments.length > 0 ? (
                    <div className="space-y-3 font-mono text-sm text-brand-text-secondary">
                        {segments.map((segment, index) => (
                            <p key={index}>
                                <span className={segment.speaker === 'Médico' ? 'font-semibold text-blue-700' : 'font-semibold text-emerald-700'}>
                                    {segment.speaker}:
                                </span>
                                {' '}
                                {segment.text}
                            </p>
                        ))}
                    </div>
                ) : (
                    <p className="whitespace-pre-wrap font-mono text-sm text-brand-text-secondary">
                        {isRecording ? <span className="flex items-center gap-2">Ouvindo... <Spinner /></span> : 'Aguardando início da gravação...'}
                    </p>
                )}
            </main>
        </div>
    );
};

export default TranscriptionWidget;