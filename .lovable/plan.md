

# Correcao da Gravacao por Voz no Modo Evento (iOS e Android)

## Problema

No mobile (especialmente iOS Safari), o `SpeechRecognition` com `continuous = true` pode parar automaticamente apos alguns segundos de silencio, disparando o evento `onend` e resetando o estado para "nao gravando" sem o usuario ter clicado para parar. Isso quebra o fluxo esperado de "clicar para comecar, clicar para terminar".

Alem disso, no iOS o `webkitSpeechRecognition` tem comportamento inconsistente com modo continuo - ele frequentemente encerra a sessao sozinho.

## Solucao

Modificar `src/pages/EventMode.tsx` para:

1. **Adicionar flag `stoppingRef`**: Um ref booleano que indica se o usuario clicou explicitamente para parar. Isso diferencia uma parada intencional de uma parada automatica do navegador.

2. **Reiniciar automaticamente no `onend`**: Se o reconhecimento parar sozinho (sem o usuario ter clicado no botao de parar), reiniciar a gravacao automaticamente para manter o modo continuo funcionando.

3. **Forcar estado visual correto**: Usar `setIsRecording(true)` de forma controlada, garantindo que o botao continue mostrando "Gravando..." ate o usuario clicar para parar.

4. **Tratamento de erro robusto**: No `onerror`, verificar se o erro e do tipo `no-speech` (comum no mobile) e reiniciar em vez de parar definitivamente.

## Detalhe Tecnico

### Mudancas em `src/pages/EventMode.tsx`

**Novo ref:**
```
const stoppingRef = useRef(false);
```

**toggleRecording atualizado:**
- Ao clicar para parar: `stoppingRef.current = true` antes de chamar `.stop()`
- Ao clicar para comecar: `stoppingRef.current = false` antes de chamar `.start()`

**Handler `onend` atualizado:**
- Se `stoppingRef.current === false` (parada automatica do navegador): reiniciar `recognition.start()` 
- Se `stoppingRef.current === true` (usuario clicou parar): setar `isRecording = false` e limpar

**Handler `onerror` atualizado:**
- Erros `no-speech` e `aborted`: ignorar (nao parar gravacao, deixar o `onend` cuidar do restart)
- Erros `not-allowed` ou `network`: parar definitivamente e avisar o usuario

### Cleanup no useEffect

Adicionar limpeza no unmount para garantir que o reconhecimento e parado se o usuario navegar para outra pagina enquanto grava.

## Arquivo Afetado

| Arquivo | Acao |
|---------|------|
| `src/pages/EventMode.tsx` | Modificar - tornar gravacao robusta no mobile |

