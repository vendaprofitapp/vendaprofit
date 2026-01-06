import { Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceCommandFeedbackProps {
  isListening: boolean;
  transcript: string;
}

export function VoiceCommandFeedback({ isListening, transcript }: VoiceCommandFeedbackProps) {
  if (!isListening && !transcript) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-300',
        'bg-background/95 backdrop-blur-lg border border-border rounded-2xl shadow-2xl',
        'px-6 py-4 max-w-md w-[90vw]',
        isListening ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Mic className="h-6 w-6 text-primary" />
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            Ouvindo...
          </p>
          <p className="text-base font-medium truncate">
            {transcript || 'Fale seu comando...'}
          </p>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-border/50">
        <p className="text-xs text-muted-foreground">
          Exemplos: "Vender 2 camisetas para Maria" • "Entrada de 50 leggings"
        </p>
      </div>
    </div>
  );
}
