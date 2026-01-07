import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
  const [isSupported, setIsSupported] = useState(true); // Always supported now (fallback to recording)
  const [useBackendTranscription, setUseBackendTranscription] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    // Check if Web Speech API is available
    const SpeechRecognitionAPI = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;
    
    // Detect iOS (iPhone/iPad)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (!SpeechRecognitionAPI || isIOS) {
      console.log('Using backend transcription (iOS or no Web Speech API)');
      setUseBackendTranscription(true);
      return;
    }

    // Check if running on HTTPS
    const isSecureContext = window.isSecureContext || 
      window.location.protocol === 'https:' || 
      window.location.hostname === 'localhost';
    
    if (!isSecureContext) {
      console.log('Using backend transcription (not secure context)');
      setUseBackendTranscription(true);
      return;
    }

    // Try to use native Web Speech API
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
        
        if (event.error === 'aborted') return;
        
        // If service not available, fall back to backend
        if (event.error === 'service-not-allowed' || event.error === 'not-allowed') {
          console.log('Falling back to backend transcription');
          setUseBackendTranscription(true);
          return;
        }
        
        let errorMessage = 'Erro no reconhecimento de voz';
        if (event.error === 'not-allowed') {
          errorMessage = 'Permissão de microfone negada.';
        } else if (event.error === 'no-speech') {
          errorMessage = 'Nenhuma fala detectada. Tente novamente.';
        } else if (event.error === 'network') {
          errorMessage = 'Erro de rede. Verifique sua conexão.';
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
      setUseBackendTranscription(true);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, [language, onResult, onError]);

  // Backend transcription using audio recording
  const startBackendRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      
      audioChunksRef.current = [];
      
      // Try to use a compatible format
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : MediaRecorder.isTypeSupported('audio/mp4') 
          ? 'audio/mp4' 
          : 'audio/wav';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length === 0) {
          setIsListening(false);
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setTranscript('Processando...');
        
        try {
          // Convert to base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          
          reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1];
            
            const { data, error } = await supabase.functions.invoke('transcribe-audio', {
              body: { audioBase64: base64, mimeType }
            });
            
            setIsListening(false);
            
            if (error || data?.error) {
              const errorMsg = data?.error || 'Erro ao transcrever áudio';
              setTranscript('');
              onError?.(errorMsg);
              toast.error(errorMsg);
              return;
            }
            
            const transcription = data.transcription;
            setTranscript(transcription);
            
            const result = parseVoiceCommand(transcription);
            onResult?.(result);
          };
        } catch (err) {
          console.error('Transcription error:', err);
          setIsListening(false);
          setTranscript('');
          toast.error('Erro ao processar áudio');
        }
      };
      
      mediaRecorder.start();
      setIsListening(true);
      setTranscript('Ouvindo...');
      
      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 10000);
      
    } catch (permError) {
      console.error('Microphone permission error:', permError);
      toast.error('Permissão de microfone negada. Habilite nas configurações.');
    }
  }, [onResult, onError]);

  const stopBackendRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startListening = useCallback(async () => {
    if (useBackendTranscription) {
      await startBackendRecording();
      return;
    }

    // Request microphone permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch (permError) {
      console.error('Microphone permission error:', permError);
      toast.error('Permissão de microfone negada.');
      return;
    }

    try {
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      recognitionRef.current?.start();
    } catch (error: any) {
      console.error('Error starting recognition:', error);
      if (error.message?.includes('already started')) return;
      
      // Fall back to backend
      console.log('Falling back to backend transcription');
      setUseBackendTranscription(true);
      await startBackendRecording();
    }
  }, [useBackendTranscription, isListening, startBackendRecording]);

  const stopListening = useCallback(() => {
    if (useBackendTranscription) {
      stopBackendRecording();
    } else {
      recognitionRef.current?.stop();
    }
  }, [useBackendTranscription, stopBackendRecording]);

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
