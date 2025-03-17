// stores/call.ts
import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { useCookieStore } from '~/composables/useCookieStore'

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
  const localParticipantId = ref<string>('')
  const permissionError = ref<string | null>(null)

  // Get user name from cookie
  const { get: getName } = useCookieStore()
  const userName = ref<string>(getName() || 'Anonymous')

  const ws: Ref<WebSocket | null> = ref(null)

  // Send message over WebSocket
  const send = (message: SignalingMessage): void => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not open, cannot send message:', message);
      return;
    }
    ws.value.send(JSON.stringify(message));
    console.log('Sent message:', message.type, message);
  }

  // Establish WebSocket connection
  const connect = (): void => {
    ws.value = new WebSocket(signalingUrl)
    ws.value.onopen = () => {
      console.log('WebSocket connection opened');
      ws.value?.send(JSON.stringify({ type: 'register', name: userName.value, room: 'main_room' }))
    }

    ws.value.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data)
      console.log('Received message:', data.type, data);
      if (data.type === 'registered') {
        localParticipantId.value = data.id
        console.log('Registered with ID:', localParticipantId.value)
      } else {
        handleMessage(data)
      }
    }

    ws.value.onclose = () => {
      console.log('WebSocket connection closed')
      // Clear existing connections
      Object.keys(peerConnections.value).forEach(id => {
        if (peerConnections.value[id]) {
          peerConnections.value[id].close();
          delete peerConnections.value[id];
        }
      });
      // Clear remote streams
      remoteStreams.value = {};
      
      // Attempt to reconnect after a delay
      setTimeout(() => {
        console.log('Attempting to reconnect...');
        connect();
      }, 3000);
    }
    
    ws.value.onerror = (error) => {
      console.error('WebSocket error:', error);
    }
  }

  // Create a peer connection
  function createPeerConnection(participantId: string): void {
    if (peerConnections.value[participantId]) {
      console.log(`Peer connection for ${participantId} already exists`)
      return
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    if (localStream.value) {
      localStream.value.getTracks().forEach((track: MediaStreamTrack) => {
        pc.addTrack(track, localStream.value as MediaStream)
      })
    }

    pc.ontrack = (event: RTCTrackEvent) => {
      const stream = event.streams[0];
      if (!stream) {
        console.warn('Received track event without a stream');
        return;
      }

      console.log(`Received track from ${participantId}: ${event.track.kind}`);

      // Initialize array if needed
      if (!remoteStreams.value[participantId]) {
        remoteStreams.value[participantId] = [];
      }

      // Check if we already have this stream
      if (!remoteStreams.value[participantId].some(s => s.id === stream.id)) {
        console.log(`Adding new stream from ${participantId}: ${stream.id}`);
        remoteStreams.value[participantId].push(stream);

        // Important: Create a new object to trigger Vue's reactivity
        remoteStreams.value = { ...remoteStreams.value };
      }
    };

    // In the oniceconnectionstatechange handler in call.ts
    pc.oniceconnectionstatechange = () => {
      const disconnectedStates = ['disconnected', 'failed', 'closed'];

      if (disconnectedStates.includes(pc.iceConnectionState)) {
        console.log(`Peer ${participantId} disconnected with state: ${pc.iceConnectionState}`);

        if (remoteStreams.value[participantId]) {
          delete remoteStreams.value[participantId];
          remoteStreams.value = { ...remoteStreams.value };
        }

        pc.close();
        delete peerConnections.value[participantId];
        console.log(`Removed peer connection for ${participantId}`);
      }
    }

    // Add this to your createPeerConnection function
    pc.onconnectionstatechange = () => {
      console.log(`Connection state for ${participantId} changed to: ${pc.connectionState}`);

      if (pc.connectionState === 'connected') {
        console.log(`Successfully connected to ${participantId}`);
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        console.log(`Connection to ${participantId} ${pc.connectionState}`);
        if (remoteStreams.value[participantId]) {
          delete remoteStreams.value[participantId];
          remoteStreams.value = { ...remoteStreams.value }; // Trigger reactivity
        }

        // Only close and remove if really disconnected (avoid premature removal)
        if (pc.connectionState === 'closed') {
          pc.close();
          delete peerConnections.value[participantId];
        }
      }
    };

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

  // Handle a new participant by initiating an offer
  function handleNewParticipant(participantId: string): void {
    if (!localParticipantId.value) {
      console.warn('Local participant ID not set; cannot initiate offer');
      return;
    }

    console.log(`Setting up connection with participant: ${participantId}`);

    // Create peer connection if it doesn't exist or is closed
    if (!peerConnections.value[participantId] ||
      peerConnections.value[participantId].connectionState === 'closed' ||
      peerConnections.value[participantId].iceConnectionState === 'closed') {

      createPeerConnection(participantId);
    }

    const pc = peerConnections.value[participantId];
    if (!pc) {
      console.error(`Failed to create peer connection for ${participantId}`);
      return;
    }

    // Only initiate an offer if we're in a stable state
    if (pc.signalingState === 'stable') {
      console.log(`Creating offer for ${participantId}`);
      pc.createOffer()
        .then((offer: RTCSessionDescriptionInit) => {
          console.log(`Setting local description for ${participantId}`);
          return pc.setLocalDescription(offer);
        })
        .then(() => {
          if (pc.localDescription) {
            console.log(`Sending offer to ${participantId}`);
            send({
              type: 'offer',
              target: participantId,
              offer: pc.localDescription,
            });
          } else {
            console.error('Local description is null');
          }
        })
        .catch((error) => console.error('Error creating offer:', error));
    } else {
      console.log(`Cannot create offer; signaling state is ${pc.signalingState}`);
    }
  }

  // Handle incoming offer
  function handleOffer(data: SignalingMessage): void {
    const participantId = data.source as string
    createPeerConnection(participantId)
    const pc = peerConnections.value[participantId]
    if (!pc) {
      console.error(`No peer connection found for ${participantId}`)
      return
    }

    pc.setRemoteDescription(new RTCSessionDescription(data.offer as RTCSessionDescriptionInit))
      .then(() => {
        if (pc.signalingState === 'have-remote-offer') {
          return pc.createAnswer()
        } else {
          throw new Error(`Unexpected signaling state ${pc.signalingState} after setting remote offer`)
        }
      })
      .then((answer: RTCSessionDescriptionInit) => {
        return pc.setLocalDescription(answer)
      })
      .then(() => {
        if (pc.localDescription) {
          send({
            type: 'answer',
            target: participantId,
            answer: pc.localDescription,
          })
        } else {
          console.error('Local description is null when trying to send answer')
        }
      })
      .catch((error) => console.error('Error handling offer:', error))
  }

  // Handle incoming answer
  function handleAnswer(data: SignalingMessage): void {
    const participantId = data.source as string
    const pc = peerConnections.value[participantId]
    if (!pc) {
      console.warn(`No peer connection found for ${participantId}`)
      return
    }

    if (pc.signalingState !== 'have-local-offer') {
      console.warn(`Cannot set remote answer; signaling state is ${pc.signalingState}`)
      // Optionally, initiate a new offer if we're in stable state
      if (pc.signalingState === 'stable') {
        console.log(`Initiating new offer to recover from state ${pc.signalingState}`)
        handleNewParticipant(participantId)
      }
      return
    }

    pc.setRemoteDescription(new RTCSessionDescription(data.answer as RTCSessionDescriptionInit))
      .catch((error) => console.error('Error setting remote answer:', error))
  }

  // Handle incoming ICE candidate
  function handleIceCandidate(data: SignalingMessage): void {
    const participantId = data.source as string
    const pc = peerConnections.value[participantId]
    if (pc) {
      pc.addIceCandidate(new RTCIceCandidate(data.candidate as RTCIceCandidateInit))
        .catch((error) => console.error('Error adding ICE candidate:', error))
    }
  }

  // Process signaling messages
  function handleMessage(data: SignalingMessage | null | undefined): void {
    if (!data || typeof data.type !== 'string') {
      console.warn('Received invalid or empty signaling message:', data)
      return
    }

    switch (data.type) {
      case 'participants':
        const participants = data.participants || [];
        const participantIds = participants.map(p => p.id);

        console.log('Current participants:', participantIds);

        // Process new participants
        participants.forEach((participant) => {
          if (
            participant &&
            participant.id &&
            participant.id !== localParticipantId.value
          ) {
            console.log(`Detected participant: ${participant.id} (${participant.name})`);
            
            // Check if we need to create or recreate the connection
            const needsNewConnection = !peerConnections.value[participant.id] || 
              peerConnections.value[participant.id].connectionState === 'closed' || 
              peerConnections.value[participant.id].iceConnectionState === 'closed' ||
              peerConnections.value[participant.id].connectionState === 'failed';
            
            // Check if we have a connection but no stream
            const hasConnectionButNoStream = peerConnections.value[participant.id] && 
              !remoteStreams.value[participant.id];
              
            if (needsNewConnection || hasConnectionButNoStream) {
              console.log(`Setting up connection with: ${participant.id}`);
              
              // Always create a peer connection
              createPeerConnection(participant.id);
              
              // Use a deterministic approach to decide who initiates
              if (localParticipantId.value < participant.id) {
                console.log(`Initiating connection to: ${participant.id}`);
                handleNewParticipant(participant.id);
              } else {
                console.log(`Waiting for connection from: ${participant.id}`);
                // After a short delay, check if we've received an offer
                setTimeout(() => {
                  const pc = peerConnections.value[participant.id];
                  if (pc && pc.signalingState === 'stable' && !remoteStreams.value[participant.id]) {
                    console.log(`No offer received from ${participant.id}, initiating connection anyway`);
                    handleNewParticipant(participant.id);
                  }
                }, 2000); // 2 second timeout
              }
            }
          }
        });

        // Check for disconnected participants
        Object.keys(peerConnections.value).forEach(id => {
          if (!participantIds.includes(id)) {
            console.log(`Participant disconnected: ${id}`);
            if (peerConnections.value[id]) {
              peerConnections.value[id].close();
              delete peerConnections.value[id];
            }
            if (remoteStreams.value[id]) {
              delete remoteStreams.value[id];
              remoteStreams.value = { ...remoteStreams.value }; // Trigger reactivity
            }
          }
        });
        break;

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
    localParticipantId,
    userName,
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
