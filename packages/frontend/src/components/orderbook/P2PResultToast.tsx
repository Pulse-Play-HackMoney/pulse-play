'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { useClearnode } from '@/providers/ClearnodeProvider';

interface Toast {
  id: string;
  result: 'WIN' | 'LOSS';
  amount: number;
  profit?: number;
  refunded?: number;
}

interface P2PResultToastProps {
  duration?: number;
}

export function P2PResultToast({ duration = 5000 }: P2PResultToastProps) {
  const { subscribe } = useWebSocket();
  const { refreshBalance } = useClearnode();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return subscribe((message) => {
      if (message.type === 'P2P_BET_RESULT') {
        const toast: Toast = {
          id: `${Date.now()}-${Math.random()}`,
          result: message.result,
          amount: message.result === 'WIN' ? message.payout ?? 0 : message.loss ?? 0,
          profit: message.profit,
          refunded: message.refunded,
        };
        setToasts((prev) => [...prev, toast]);

        refreshBalance();

        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }, duration);
      }
    });
  }, [subscribe, duration, refreshBalance]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2" data-testid="p2p-toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg animate-slide-in ${
            toast.result === 'WIN'
              ? 'bg-green-500/90 text-white border border-green-400/30'
              : 'bg-red-500/90 text-white border border-red-400/30'
          }`}
          data-testid={`p2p-toast-${toast.result.toLowerCase()}`}
        >
          <div className="flex-1">
            <div className="font-medium" data-testid="p2p-toast-title">
              {toast.result === 'WIN' ? 'P2P Order Won!' : 'P2P Order Lost'}
            </div>
            <div className="text-sm opacity-90" data-testid="p2p-toast-amount">
              {toast.result === 'WIN'
                ? `+$${toast.amount.toFixed(2)}`
                : `-$${toast.amount.toFixed(2)}`}
            </div>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-white/70 hover:text-white"
            data-testid="p2p-toast-dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
