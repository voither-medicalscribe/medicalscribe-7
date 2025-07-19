import { useState, useRef, useCallback, useEffect } from 'react';

export const useTimer = (initialSeconds: number = 0, onFinish?: () => void) => {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const onFinishRef = useRef(onFinish);

  // Keep the onFinish callback reference up to date
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const startTimer = useCallback(() => {
    if (isRunning || timeLeft <= 0) return;
    setIsRunning(true);
    intervalRef.current = window.setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime <= 1) {
          stopTimer();
          onFinishRef.current?.();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  }, [isRunning, timeLeft, stopTimer]);

  const setTime = useCallback((seconds: number) => {
    stopTimer();
    setTimeLeft(seconds);
  }, [stopTimer]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if(intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return { timeLeft, startTimer, stopTimer, setTime, isRunning };
};