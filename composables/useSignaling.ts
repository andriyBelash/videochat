// Define message type
interface SignalingMessage {
  type: string
  [key: string]: any
}

export function useSignaling() {
  const { $ws, $bus } = useNuxtApp()
  const ws: WebSocket = $ws as WebSocket
  const bus = $bus as any // Type assertion due to mitt's dynamic typing; refine if needed

  const send = (message: SignalingMessage): void => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  return {
    send,
    onMessage: (callback: (data: SignalingMessage) => void) => bus.on('ws:message', callback),
    offMessage: (callback: (data: SignalingMessage) => void) => bus.off('ws:message', callback),
  }
}