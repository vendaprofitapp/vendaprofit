import { useState, useCallback } from "react";

/**
 * Substitui useState com persistência automática no localStorage.
 * Os dados sobrevivem a recarregamentos, descartes de aba (Memory Saver do Chrome/Edge),
 * troca de abas e até fechar/reabrir o navegador.
 * O rascunho só é apagado quando clearValue() é chamado (ex: após submit bem-sucedido).
 *
 * Uso:
 *   const [value, setValue, clearValue] = useFormPersistence("minha_chave", "");
 *   // Após submit bem-sucedido: clearValue();
 */
export function useFormPersistence<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [state, setStateRaw] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return defaultValue;
      return JSON.parse(stored) as T;
    } catch {
      return defaultValue;
    }
  });

  const setState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStateRaw((prev) => {
        const next =
          typeof value === "function"
            ? (value as (p: T) => T)(prev)
            : value;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // localStorage indisponível (modo privado, quota excedida) — sem problema
        }
        return next;
      });
    },
    [key]
  );

  const clearPersistence = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      // sem problema
    }
  }, [key]);

  return [state, setState, clearPersistence];
}
