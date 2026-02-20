import { useState, useCallback } from "react";

/**
 * Substitui useState com persistência automática no sessionStorage.
 * Os dados sobrevivem a recarregamentos de aba (ex: Safari descarrega abas da memória)
 * e são limpos quando a aba é fechada.
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
      const stored = sessionStorage.getItem(key);
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
          sessionStorage.setItem(key, JSON.stringify(next));
        } catch {
          // sessionStorage indisponível (modo privado, etc.) — sem problema
        }
        return next;
      });
    },
    [key]
  );

  const clearPersistence = useCallback(() => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // sem problema
    }
  }, [key]);

  return [state, setState, clearPersistence];
}
