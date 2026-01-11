import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCallback, useRef } from 'react';

interface VoiceCommandButtonProps {
  isListening: boolean;
  isSupported: boolean;
  onClick?: () => void;
  onStart?: () => void;
  onStop?: () => void;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showLabel?: boolean;
  holdToSpeak?: boolean;
}

export function VoiceCommandButton({
  isListening,
  isSupported,
  onClick,
  onStart,
  onStop,
  size = 'icon',
  className,
  showLabel = false,
  holdToSpeak = false,
}: VoiceCommandButtonProps) {
  const isHoldingRef = useRef(false);

  const handlePressStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!holdToSpeak) return;
    e.preventDefault();
    isHoldingRef.current = true;
    onStart?.();
  }, [holdToSpeak, onStart]);

  const handlePressEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!holdToSpeak) return;
    e.preventDefault();
    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      onStop?.();
    }
  }, [holdToSpeak, onStop]);

  const handleClick = useCallback(() => {
    if (holdToSpeak) return; // Don't use click in hold mode
    onClick?.();
  }, [holdToSpeak, onClick]);

  if (!isSupported) {
    return null;
  }

  return (
    <Button
      type="button"
      variant={isListening ? 'default' : 'outline'}
      size={size}
      onClick={handleClick}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onTouchCancel={handlePressEnd}
      className={cn(
        'relative transition-all duration-200 select-none',
        isListening && 'bg-red-500 hover:bg-red-600 animate-pulse',
        holdToSpeak && 'touch-none',
        className
      )}
      title={holdToSpeak 
        ? 'Segure para falar' 
        : (isListening ? 'Parar gravação' : 'Comando por voz')
      }
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
          {showLabel && <span className="ml-2">{holdToSpeak ? 'Segure p/ falar' : 'Voz'}</span>}
        </>
      )}
    </Button>
  );
}
