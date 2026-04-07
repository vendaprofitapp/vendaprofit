import { useState, useCallback, useEffect } from "react";

/**
 * useDialogPersistence — mantém o estado `open` de um dialog sobrevivendo a:
 * - Troca de aba (e volta)
 * - Memory Saver do Chrome/Edge que desmonta componentes inativos
 * - Recarregamentos acidentais
 *
 * Uso:
 *   const [open, setOpen, closeAndClear] = useDialogPersistence("sale_dialog");
 *
 * Chamar closeAndClear() ao submeter ou cancelar — apaga a persistência.
 * Chamar setOpen(true) para abrir — persiste automaticamente.
 */
export function useDialogPersistence(
  key: string,
  /**
   * Se true, o dialog não reabre automaticamente ao montar o componente.
   * Use quando o dialog deve abrir somente por ação do usuário, não por estado persistido.
   * Default: false (reabre automaticamente se estava aberto antes da troca de aba).
   */
  skipAutoRestore = false
): [boolean, (open: boolean) => void, () => void] {
  const storageKey = `vp_dialog_open_${key}`;

  const [open, setOpenRaw] = useState<boolean>(() => {
    if (skipAutoRestore) return false;
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  const setOpen = useCallback(
    (value: boolean) => {
      setOpenRaw(value);
      try {
        if (value) {
          localStorage.setItem(storageKey, "1");
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch {
        // localStorage indisponível — sem problema
      }
    },
    [storageKey]
  );

  const closeAndClear = useCallback(() => {
    setOpenRaw(false);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // sem problema
    }
  }, [storageKey]);

  // Sincroniza o estado se outra aba alterar o localStorage
  useEffect(() => {
    if (skipAutoRestore) return;
    const handler = (e: StorageEvent) => {
      if (e.key === storageKey) {
        setOpenRaw(e.newValue === "1");
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [storageKey, skipAutoRestore]);

  return [open, setOpen, closeAndClear];
}
