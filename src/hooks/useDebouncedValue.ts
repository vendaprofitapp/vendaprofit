import { useState, useEffect } from "react";

/**
 * Retorna uma versão "debounced" do valor fornecido.
 * Útil para atrasar buscas até o usuário parar de digitar.
 *
 * @param value   valor que muda a cada keystroke
 * @param delay   atraso em ms (padrão 500)
 */
export function useDebouncedValue<T>(value: T, delay = 500): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
