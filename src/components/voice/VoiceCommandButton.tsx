import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoiceCommandButtonProps {
  isListening: boolean;
  isSupported: boolean;
  onClick: () => void;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showLabel?: boolean;
}

export function VoiceCommandButton({
  isListening,
  isSupported,
  onClick,
  size = 'icon',
  className,
  showLabel = false,
}: VoiceCommandButtonProps) {
  if (!isSupported) {
    return null;
  }

  return (
    <Button
      type="button"
      variant={isListening ? 'default' : 'outline'}
      size={size}
      onClick={onClick}
      className={cn(
        'relative transition-all duration-200',
        isListening && 'bg-red-500 hover:bg-red-600 animate-pulse',
        className
      )}
      title={isListening ? 'Parar gravação' : 'Comando por voz'}
    >
      {isListening ? (
        <>
          <MicOff className="h-5 w-5" />
          {showLabel && <span className="ml-2">Ouvindo...</span>}
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-300 animate-ping" />
        </>
      ) : (
        <>
          <Mic className="h-5 w-5" />
          {showLabel && <span className="ml-2">Voz</span>}
        </>
      )}
    </Button>
  );
}
