// stores/call.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'

interface SignalingMessage {
  type: string
  [key: string]: any
}

interface SignalingMessage {
  type: string
  participants?: { id: string; name: string }[]
  target?: string
  offer?: RTCSessionDescriptionInit
  answer?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
  source?: string
  sourceName?: string
}

interface PeerConnections {
  [key: string]: RTCPeerConnection
}

interface RemoteStreams {
  [key: string]: MediaStream[]
}

export const useCallStore = defineStore('call', () => {

  const config = useRuntimeConfig()
  const signalingUrl: string = config.public.signalingUrl
  // State
  const localStream = ref<MediaStream | null>(null)
  const remoteStreams = ref<RemoteStreams>({})
  const peerConnections = ref<PeerConnections>({})
  const userName = ref<string>('')
  const roomId = ref<string>('main_room')
  const permissionError = ref<string | null>(null)

  const ws: Ref<WebSocket | null> = ref(null)

  const send = (message: SignalingMessage): void => {
    if(!ws.value) return
    if (ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(message))
    }
  }

  const connect = (): void => {
    ws.value = new WebSocket(signalingUrl)
    ws.value.onopen = () => {
      ws.value?.send(JSON.stringify({ type: 'register', name: uuidv4(), room: 'main_room' }))
    }

    ws.value.onmessage = (event: MessageEvent) => {
      handleMessage(JSON.parse(event.data))
    }
  }

  // Actions

  function createPeerConnection(participantId: string): void {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    if (localStream.value) {
      localStream.value.getTracks().forEach((track: MediaStreamTrack) => {
        pc.addTrack(track, localStream.value as MediaStream)
      })
    }

    pc.ontrack = (event: RTCTrackEvent) => {
      if (!remoteStreams.value[participantId]) {
        remoteStreams.value[participantId] = []
      }
      remoteStreams.value[participantId].push(event.streams[0])
      remoteStreams.value = { ...remoteStreams.value } // Trigger reactivity
    }

    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        send({
          type: 'ice-candidate',
          target: participantId,
          candidate: event.candidate,
        })
      }
    }

    peerConnections.value[participantId] = pc
  }

  function handleNewParticipant(participantId: string): void {
    createPeerConnection(participantId)
    const pc = peerConnections.value[participantId]
    pc.createOffer().then((offer: RTCSessionDescriptionInit) => {
      pc.setLocalDescription(offer)
      send({
        type: 'offer',
        target: participantId,
        offer,
      })
    })
  }

  function handleOffer(data: SignalingMessage): void {
    const participantId = data.source as string
    createPeerConnection(participantId)
    const pc = peerConnections.value[participantId]
    pc.setRemoteDescription(new RTCSessionDescription(data.offer as RTCSessionDescriptionInit))
    pc.createAnswer().then((answer: RTCSessionDescriptionInit) => {
      pc.setLocalDescription(answer)
      send({
        type: 'answer',
        target: participantId,
        answer,
      })
    })
  }

  function handleAnswer(data: SignalingMessage): void {
    const participantId = data.source as string
    const pc = peerConnections.value[participantId]
    if (pc) {
      pc.setRemoteDescription(new RTCSessionDescription(data.answer as RTCSessionDescriptionInit))
    }
  }

  function handleIceCandidate(data: SignalingMessage): void {
    const participantId = data.source as string
    const pc = peerConnections.value[participantId]
    if (pc) {
      pc.addIceCandidate(new RTCIceCandidate(data.candidate as RTCIceCandidateInit))
    }
  }

  function handleMessage(data: SignalingMessage | null | undefined): void {
    if (!data || typeof data.type !== 'string') {
      console.warn('Received invalid or empty signaling message:', data)
      return
    }

    switch (data.type) {
      case 'participants':
        const participants = data.participants || []
        participants.forEach((participant) => {
          if (
            participant &&
            participant.id &&
            participant.name &&
            participant.name !== userName.value &&
            !peerConnections.value[participant.id]
          ) {
            handleNewParticipant(participant.id)
          }
        })
        break

      case 'offer':
        if (data.source && data.offer) {
          handleOffer(data)
        } else {
          console.warn('Invalid offer message:', data)
        }
        break

      case 'answer':
        if (data.source && data.answer) {
          handleAnswer(data)
        } else {
          console.warn('Invalid answer message:', data)
        }
        break

      case 'ice-candidate':
        if (data.source && data.candidate) {
          handleIceCandidate(data)
        } else {
          console.warn('Invalid ICE candidate message:', data)
        }
        break

      default:
        console.warn('Unknown signaling message type:', data.type)
        break
    }

  }

  return {
    localStream,
    remoteStreams,
    peerConnections,
    userName,
    roomId,
    permissionError,
    connect,
    createPeerConnection,
    handleNewParticipant,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handleMessage,
  }
})