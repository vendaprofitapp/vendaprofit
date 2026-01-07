import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface VoiceCommandResult {
  type: 'sale' | 'stock' | 'product' | 'unknown';
  data: Record<string, any>;
  rawText: string;
}

interface UseVoiceCommandOptions {
  onResult?: (result: VoiceCommandResult) => void;
  onError?: (error: string) => void;
  language?: string;
}

export function useVoiceCommand(options: UseVoiceCommandOptions = {}) {
  const { onResult, onError, language = 'pt-BR' } = options;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Prevent double initialization
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    // Check browser support - works on mobile Chrome, Safari, Edge
    const SpeechRecognitionAPI = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition ||
      (window as any).mozSpeechRecognition ||
      (window as any).msSpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      console.log('Speech Recognition API not available');
      setIsSupported(false);
      return;
    }

    // Check if running on HTTPS (required for mobile)
    const isSecureContext = window.isSecureContext || 
      window.location.protocol === 'https:' || 
      window.location.hostname === 'localhost';
    
    if (!isSecureContext) {
      console.log('Speech Recognition requires HTTPS');
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    try {
      const recognition = new SpeechRecognitionAPI() as SpeechRecognitionInstance;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        console.log('Speech recognition started');
        setIsListening(true);
        setTranscript('');
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        setTranscript(finalTranscript || interimTranscript);

        if (finalTranscript) {
          const result = parseVoiceCommand(finalTranscript);
          onResult?.(result);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        // 'aborted' happens when recognition is stopped normally or browser interrupts
        if (event.error === 'aborted') {
          return; // Don't show error for normal abort
        }
        
        let errorMessage = 'Erro no reconhecimento de voz';
        if (event.error === 'not-allowed') {
          errorMessage = 'Permissão de microfone negada. Vá em Configurações > Site > Microfone e permita.';
        } else if (event.error === 'no-speech') {
          errorMessage = 'Nenhuma fala detectada. Tente novamente.';
        } else if (event.error === 'network') {
          errorMessage = 'Erro de rede. Verifique sua conexão.';
        } else if (event.error === 'service-not-allowed') {
          errorMessage = 'Serviço de voz não disponível. Tente usar o Chrome.';
        }
        
        onError?.(errorMessage);
        toast.error(errorMessage);
      };

      recognition.onend = () => {
        console.log('Speech recognition ended');
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (error) {
      console.error('Error initializing speech recognition:', error);
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore abort errors
        }
      }
    };
  }, [language, onResult, onError]);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      toast.error('Reconhecimento de voz não suportado. Use Chrome, Safari ou Edge.');
      return;
    }

    // Request microphone permission first (important for mobile)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately, we just needed permission
      stream.getTracks().forEach(track => track.stop());
    } catch (permError) {
      console.error('Microphone permission error:', permError);
      toast.error('Permissão de microfone negada. Habilite nas configurações do navegador.');
      return;
    }

    try {
      // Stop any existing recognition first
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      recognitionRef.current?.start();
    } catch (error: any) {
      console.error('Error starting recognition:', error);
      if (error.message?.includes('already started')) {
        // Already listening, ignore
        return;
      }
      toast.error('Erro ao iniciar reconhecimento de voz. Tente novamente.');
    }
  }, [isSupported, isListening]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
  };
}

// Parse natural language commands in Portuguese
function parseVoiceCommand(text: string): VoiceCommandResult {
  const lowerText = text.toLowerCase().trim();
  
  // Sale patterns
  // "vender 2 camisetas para João" or "venda de 3 leggings"
  const salePatterns = [
    /(?:vender|venda|vendido|registrar venda)\s*(?:de\s*)?(\d+)?\s*(.+?)(?:\s+para\s+(.+))?$/i,
    /(\d+)\s*(.+?)\s+(?:para|cliente)\s+(.+)/i,
  ];

  for (const pattern of salePatterns) {
    const match = lowerText.match(pattern);
    if (match) {
      return {
        type: 'sale',
        data: {
          quantity: parseInt(match[1]) || 1,
          productSearch: match[2]?.trim(),
          customerName: match[3]?.trim(),
        },
        rawText: text,
      };
    }
  }

  // Stock entry patterns
  // "entrada de 50 camisetas" or "adicionar 20 unidades de legging"
  const stockPatterns = [
    /(?:entrada|adicionar|receber|chegou)\s*(?:de\s*)?(\d+)\s*(?:unidades?\s*(?:de\s*)?)?\s*(.+)/i,
    /(\d+)\s*(.+?)\s+(?:chegou|entrou|recebido)/i,
  ];

  for (const pattern of stockPatterns) {
    const match = lowerText.match(pattern);
    if (match) {
      return {
        type: 'stock',
        data: {
          quantity: parseInt(match[1]) || 1,
          productSearch: match[2]?.trim(),
          operation: 'entry',
        },
        rawText: text,
      };
    }
  }

  // Stock exit patterns
  // "saída de 10 camisetas" or "baixa de 5 leggings"
  const stockExitPatterns = [
    /(?:saída|baixa|retirar|saiu)\s*(?:de\s*)?(\d+)\s*(?:unidades?\s*(?:de\s*)?)?\s*(.+)/i,
  ];

  for (const pattern of stockExitPatterns) {
    const match = lowerText.match(pattern);
    if (match) {
      return {
        type: 'stock',
        data: {
          quantity: parseInt(match[1]) || 1,
          productSearch: match[2]?.trim(),
          operation: 'exit',
        },
        rawText: text,
      };
    }
  }

  // Product creation patterns
  // "novo produto camiseta fitness preta 49 reais"
  const productPatterns = [
    /(?:novo produto|criar produto|cadastrar|adicionar produto)\s+(.+?)\s+(\d+(?:[,\.]\d+)?)\s*(?:reais|r\$)?/i,
    /(?:novo produto|criar produto|cadastrar)\s+(.+)/i,
  ];

  for (const pattern of productPatterns) {
    const match = lowerText.match(pattern);
    if (match) {
      const priceMatch = match[2] ? parseFloat(match[2].replace(',', '.')) : undefined;
      return {
        type: 'product',
        data: {
          name: match[1]?.trim(),
          price: priceMatch,
        },
        rawText: text,
      };
    }
  }

  return {
    type: 'unknown',
    data: {},
    rawText: text,
  };
}
// Web Speech API is accessed via window object with proper type casting
