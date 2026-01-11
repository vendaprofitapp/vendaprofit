import { useState, useCallback } from 'react';
import { useVoiceCommand, VoiceCommandResult } from './useVoiceCommand';

export interface StockVoiceCommand {
  operation: 'entry' | 'exit';
  quantity: number;
  productSearch: string;
  rawText: string;
}

interface UseStockVoiceCommandOptions {
  onCommand: (command: StockVoiceCommand) => void;
  onError?: (error: string) => void;
}

export function useStockVoiceCommand({ onCommand, onError }: UseStockVoiceCommandOptions) {
  const [pendingCommand, setPendingCommand] = useState<StockVoiceCommand | null>(null);

  const handleResult = useCallback((result: VoiceCommandResult) => {
    // Parse the voice command for stock operations
    const command = parseStockCommand(result.rawText);
    
    if (command) {
      setPendingCommand(command);
      onCommand(command);
    } else {
      onError?.('Comando não reconhecido. Tente: "Incluir 2 Camiseta Preta M" ou "Retirar 3 Calça Jeans"');
    }
  }, [onCommand, onError]);

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
    isProcessing,
    transcript,
    isSupported,
    startListening,
    stopListening,
    pendingCommand,
    clearCommand: () => setPendingCommand(null),
  };
}

function parseStockCommand(text: string): StockVoiceCommand | null {
  const lowerText = text.toLowerCase().trim();
  
  // Entry patterns - more flexible matching
  const entryPatterns = [
    // "incluir X produto" or "incluir produto X"
    /(?:incluir|adicionar|entrada|entrar|receber|chegou|recebi)\s*(?:de\s*)?(\d+)?\s*(?:unidades?\s*(?:de\s*)?)?\s*(.+)/i,
    // "X produto incluir/chegou"
    /(\d+)\s+(.+?)\s+(?:incluir|adicionar|entrada|chegou|recebido)/i,
  ];

  // Exit patterns - more flexible matching
  const exitPatterns = [
    // "retirar X produto" or "saida X produto"
    /(?:retirar|saída|sair|baixa|baixar|saiu|remover)\s*(?:de\s*)?(\d+)?\s*(?:unidades?\s*(?:de\s*)?)?\s*(.+)/i,
    // "X produto saiu/retirar"
    /(\d+)\s+(.+?)\s+(?:retirar|saída|saiu|baixa)/i,
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
  
  // Remove common filler words and clean up
  const fillerWords = [
    'unidades', 'unidade', 'peças', 'peça', 
    'do', 'da', 'de', 'no', 'na', 
    'estoque', 'produto', 'item'
  ];
  
  let cleaned = text.toLowerCase().trim();
  
  // Remove filler words at the start
  for (const word of fillerWords) {
    const regex = new RegExp(`^${word}\\s+`, 'i');
    cleaned = cleaned.replace(regex, '');
  }
  
  // Remove filler words at the end
  for (const word of fillerWords) {
    const regex = new RegExp(`\\s+${word}$`, 'i');
    cleaned = cleaned.replace(regex, '');
  }
  
  return cleaned.trim();
}
