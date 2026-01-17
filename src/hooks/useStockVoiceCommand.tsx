import { useState, useCallback } from 'react';
import { useVoiceCommand, VoiceCommandResult } from './useVoiceCommand';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StockVoiceCommand {
  operation: 'entry' | 'exit';
  quantity: number;
  productSearch: string;
  matchedProduct?: string | null;
  color?: string | null;
  size?: string | null;
  confidence?: number;
  rawText: string;
}

interface UseStockVoiceCommandOptions {
  onCommand: (command: StockVoiceCommand) => void;
  onError?: (error: string) => void;
  userId?: string;
}

export function useStockVoiceCommand({ onCommand, onError, userId }: UseStockVoiceCommandOptions) {
  const [pendingCommand, setPendingCommand] = useState<StockVoiceCommand | null>(null);
  const [isAIProcessing, setIsAIProcessing] = useState(false);

  const processWithAI = useCallback(async (text: string) => {
    if (!userId) {
      onError?.('Usuário não identificado');
      return;
    }

    setIsAIProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('parse-voice-stock', {
        body: { voiceText: text, userId }
      });

      if (error) {
        console.error('AI parsing error:', error);
        // Fallback to regex parsing
        const fallbackCommand = parseStockCommand(text);
        if (fallbackCommand) {
          setPendingCommand(fallbackCommand);
          onCommand(fallbackCommand);
        } else {
          onError?.('Não consegui entender o comando. Tente: "Incluir 2 Camiseta Preta" ou "Retirar 3 Calça Jeans"');
        }
        return;
      }

      if (data?.error) {
        console.error('AI parsing error:', data.error);
        toast.error(data.error);
        onError?.(data.error);
        return;
      }

      if (data?.success && data?.command) {
        const command: StockVoiceCommand = {
          operation: data.command.operation,
          quantity: data.command.quantity || 1,
          productSearch: data.command.matchedProduct || data.command.productSearch,
          matchedProduct: data.command.matchedProduct,
          color: data.command.color,
          size: data.command.size,
          confidence: data.command.confidence,
          rawText: text,
        };
        
        setPendingCommand(command);
        onCommand(command);
        
        // Show confidence feedback with color/size info
        const details = [
          data.command.color && `Cor: ${data.command.color}`,
          data.command.size && `Tamanho: ${data.command.size}`
        ].filter(Boolean).join(', ');
        
        if (data.command.matchedProduct && data.command.confidence >= 0.7) {
          const msg = details 
            ? `Produto: ${data.command.matchedProduct} (${details})`
            : `Produto identificado: ${data.command.matchedProduct}`;
          toast.success(msg, { duration: 2000 });
        } else if (data.command.matchedProduct && data.command.confidence < 0.7) {
          toast.info(`Possível produto: ${data.command.matchedProduct}`, { duration: 2000 });
        }
      } else {
        onError?.('Não consegui entender o comando. Tente: "Incluir 2 Camiseta Preta" ou "Retirar 3 Calça Jeans"');
      }
    } catch (err) {
      console.error('AI processing error:', err);
      // Fallback to regex
      const fallbackCommand = parseStockCommand(text);
      if (fallbackCommand) {
        setPendingCommand(fallbackCommand);
        onCommand(fallbackCommand);
      } else {
        onError?.('Erro ao processar comando de voz');
      }
    } finally {
      setIsAIProcessing(false);
    }
  }, [userId, onCommand, onError]);

  const handleResult = useCallback((result: VoiceCommandResult) => {
    // Use AI for intelligent parsing
    processWithAI(result.rawText);
  }, [processWithAI]);

  const {
    isListening,
    isProcessing,
    transcript,
    isSupported,
    startListening,
    stopListening,
  } = useVoiceCommand({
    onResult: handleResult,
    onError,
    language: 'pt-BR',
  });

  return {
    isListening,
    isProcessing: isProcessing || isAIProcessing,
    transcript,
    isSupported,
    startListening,
    stopListening,
    pendingCommand,
    clearCommand: () => setPendingCommand(null),
  };
}

// Fallback regex parsing (used when AI is unavailable)
function parseStockCommand(text: string): StockVoiceCommand | null {
  const lowerText = text.toLowerCase().trim();
  
  // Entry patterns - expanded synonyms
  const entryPatterns = [
    /(?:incluir|inserir|adicionar|entrada|entrar|receber|chegou|recebi|repor|repondo|colocar|guardar|guardando)\s*(?:de\s*)?(\d+)?\s*(?:unidades?\s*(?:de\s*)?)?\s*(.+)/i,
    /(\d+)\s+(.+?)\s+(?:incluir|inserir|adicionar|entrada|chegou|recebido|repor)/i,
  ];

  // Exit patterns - expanded synonyms
  const exitPatterns = [
    /(?:retirar|remover|saída|sair|baixa|baixar|saiu|excluir|vender|vendido|tirar|tirando|removendo)\s*(?:de\s*)?(\d+)?\s*(?:unidades?\s*(?:de\s*)?)?\s*(.+)/i,
    /(\d+)\s+(.+?)\s+(?:retirar|remover|saída|saiu|baixa|excluir|vendido|tirar)/i,
  ];

  // Try entry patterns
  for (const pattern of entryPatterns) {
    const match = lowerText.match(pattern);
    if (match) {
      const quantity = parseInt(match[1]) || 1;
      const productSearch = cleanProductSearch(match[2]);
      
      if (productSearch && productSearch.length > 1) {
        return {
          operation: 'entry',
          quantity,
          productSearch,
          rawText: text,
        };
      }
    }
  }

  // Try exit patterns
  for (const pattern of exitPatterns) {
    const match = lowerText.match(pattern);
    if (match) {
      const quantity = parseInt(match[1]) || 1;
      const productSearch = cleanProductSearch(match[2]);
      
      if (productSearch && productSearch.length > 1) {
        return {
          operation: 'exit',
          quantity,
          productSearch,
          rawText: text,
        };
      }
    }
  }

  return null;
}

function cleanProductSearch(text: string): string {
  if (!text) return '';
  
  const fillerWords = [
    'unidades', 'unidade', 'peças', 'peça', 
    'do', 'da', 'de', 'no', 'na', 
    'estoque', 'produto', 'item'
  ];
  
  let cleaned = text.toLowerCase().trim();
  
  for (const word of fillerWords) {
    const regex = new RegExp(`^${word}\\s+`, 'i');
    cleaned = cleaned.replace(regex, '');
  }
  
  for (const word of fillerWords) {
    const regex = new RegExp(`\\s+${word}$`, 'i');
    cleaned = cleaned.replace(regex, '');
  }
  
  return cleaned.trim();
}
