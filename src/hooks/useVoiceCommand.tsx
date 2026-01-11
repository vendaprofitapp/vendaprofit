import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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

export interface VoiceCommandResult {
  type: 'sale' | 'stock' | 'product' | 'unknown';
  data: Record<string, any>;
  rawText: string;
}

export interface SmartSaleResult {
  success: boolean;
  quantity?: number;
  productId?: string | null;
  productName?: string;
  paymentMethod?: string | null;
  customerName?: string | null;
  confidence?: number;
  message?: string;
  error?: string;
}

interface UseVoiceCommandOptions {
  onResult?: (result: VoiceCommandResult) => void;
  onSmartSaleResult?: (result: SmartSaleResult, rawText: string) => void;
  onError?: (error: string) => void;
  language?: string;
  smartSaleMode?: boolean;
  userId?: string;
}

export function useVoiceCommand(options: UseVoiceCommandOptions = {}) {
  const { onResult, onSmartSaleResult, onError, language = 'pt-BR', smartSaleMode = false, userId } = options;
  const { user } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiConfig, setAiConfig] = useState<{ provider: string; apiKey: string | null } | null>(null);
  
  // Recognition is created lazily on user interaction - NOT in useEffect
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Fetch user's AI configuration
  useEffect(() => {
    async function fetchAIConfig() {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('preferred_ai_provider, gemini_api_key, openai_api_key')
        .eq('id', user.id)
        .single();
      
      if (!error && data) {
        const provider = data.preferred_ai_provider || 'gemini';
        const apiKey = provider === 'openai' ? data.openai_api_key : data.gemini_api_key;
        setAiConfig({ provider, apiKey });
      }
    }
    
    fetchAIConfig();
  }, [user?.id]);

  // Check if we should use backend transcription (iOS or no Web Speech API)
  const shouldUseBackend = useCallback((): boolean => {
    // Detect iOS (iPhone/iPad)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      console.log('iOS detected - using backend transcription');
      return true;
    }

    // Check for Web Speech API
    const SpeechRecognitionAPI = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      console.log('No Web Speech API - using backend transcription');
      return true;
    }

    // Check secure context
    const isSecureContext = window.isSecureContext || 
      window.location.protocol === 'https:' || 
      window.location.hostname === 'localhost';
    
    if (!isSecureContext) {
      console.log('Not secure context - using backend transcription');
      return true;
    }

    return false;
  }, []);

  // Process transcription - either smart sale mode or regular parsing
  const handleTranscription = useCallback(async (text: string) => {
    if (smartSaleMode && userId) {
      setIsProcessing(true);
      setTranscript('Interpretando...');
      
      try {
        const { data, error } = await supabase.functions.invoke('parse-voice-sale', {
          body: { voiceText: text, userId }
        });
        
        setIsProcessing(false);
        
        if (error) {
          console.error('Smart sale error:', error);
          setTranscript(text);
          onError?.('Erro ao interpretar comando');
          return;
        }
        
        setTranscript(text);
        onSmartSaleResult?.(data, text);
      } catch (err) {
        console.error('Smart sale error:', err);
        setIsProcessing(false);
        setTranscript(text);
        onError?.('Erro ao processar comando');
      }
    } else {
      const result = parseVoiceCommand(text);
      onResult?.(result);
    }
  }, [smartSaleMode, userId, onSmartSaleResult, onResult, onError]);

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
            
            // Build headers with user's AI config
            const headers: Record<string, string> = {};
            if (aiConfig?.apiKey) {
              headers['x-ai-provider'] = aiConfig.provider;
              headers['x-ai-key'] = aiConfig.apiKey;
            }
            
            const { data, error } = await supabase.functions.invoke('transcribe-audio', {
              body: { audioBase64: base64, mimeType },
              headers
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
            
            handleTranscription(transcription);
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
      
    } catch (permError: any) {
      console.error('Microphone permission error:', permError);
      toast.error('Permissão de microfone negada. Habilite nas configurações.');
    }
  }, [handleTranscription, onError, aiConfig]);

  const stopBackendRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Create speech recognition instance ONLY on user click - lazy initialization
  const createRecognition = useCallback((): SpeechRecognitionInstance | null => {
    const SpeechRecognitionAPI = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      return null;
    }

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
          handleTranscription(finalTranscript);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        if (event.error === 'aborted') return;
        
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

      return recognition;
    } catch (error) {
      console.error('Error creating speech recognition:', error);
      return null;
    }
  }, [language, handleTranscription, onError]);

  // Start listening - called ONLY on user click
  const startListening = useCallback(async () => {
    // Check if we should use backend
    if (shouldUseBackend()) {
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

    // Create recognition instance lazily (only on user click)
    try {
      // Stop any existing recognition
      if (recognitionRef.current && isListening) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Create new instance on each click for Safari compatibility
      const recognition = createRecognition();
      
      if (!recognition) {
        // Fall back to backend if creation fails
        console.log('Falling back to backend transcription');
        await startBackendRecording();
        return;
      }

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error: any) {
      console.error('Error starting recognition:', error);
      if (error.message?.includes('already started')) return;
      
      // Fall back to backend
      console.log('Falling back to backend transcription');
      await startBackendRecording();
    }
  }, [shouldUseBackend, isListening, createRecognition, startBackendRecording]);

  const stopListening = useCallback(() => {
    if (shouldUseBackend()) {
      stopBackendRecording();
    } else if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    }
  }, [shouldUseBackend, stopBackendRecording]);

  // isSupported is always true because we have backend fallback
  return {
    isListening,
    isProcessing,
    transcript,
    isSupported: true,
    startListening,
    stopListening,
  };
}

// Parse natural language commands in Portuguese - NO LOOKBEHIND REGEX
function parseVoiceCommand(text: string): VoiceCommandResult {
  const lowerText = text.toLowerCase().trim();
  
  // Sale patterns - using simple match() without lookbehind
  const salePatterns = [
    /(?:vender|venda|vendido|registrar venda)\s*(?:de\s*)?(\d+)?\s*(.+?)(?:\s+para\s+(.+))?$/i,
    /(\d+)\s+(.+?)\s+(?:para|cliente)\s+(.+)/i,
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

  // Stock entry patterns - simple regex without lookbehind
  const stockPatterns = [
    /(?:entrada|adicionar|receber|chegou)\s*(?:de\s*)?(\d+)\s*(?:unidades?\s*(?:de\s*)?)?\s*(.+)/i,
    /(\d+)\s+(.+?)\s+(?:chegou|entrou|recebido)/i,
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

  // Stock exit patterns - simple regex without lookbehind
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

  // Product creation patterns - simple regex
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
