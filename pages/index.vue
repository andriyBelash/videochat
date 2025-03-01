<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useCallStore } from '~/stores/call'

const callStore = useCallStore()
const { localStream, remoteStreams, permissionError, userName } = storeToRefs(callStore)
const { connect } = callStore
const localVideo = ref<HTMLVideoElement | null>(null)
const showControls = ref(true)
const isMuted = ref(false)
const isVideoOff = ref(false)

// Floating local video position
const localVideoPosition = ref({ x: 20, y: 20 })
let isDragging = false
let offset = { x: 0, y: 0 }

// Animation states
const isGridAnimating = ref(false)
const joinedParticipants = ref<string[]>([])

// Compute total number of remote streams
const totalStreams = computed(() => {
  return Object.values(remoteStreams.value).reduce((acc, streams) => acc + streams.length, 0)
})

// Watch for changes in remote streams to trigger animations
watch(remoteStreams.value, (newVal, oldVal) => {
  const newParticipants = Object.keys(newVal)
  const oldParticipants = Object.keys(oldVal || {})

  // Find newly joined participants
  const newlyJoined = newParticipants.filter(id => !oldParticipants.includes(id))

  if (newlyJoined.length > 0) {
    // Add to joined participants array to trigger animation
    joinedParticipants.value = [...joinedParticipants.value, ...newlyJoined]

    // Trigger grid animation
    isGridAnimating.value = true
    setTimeout(() => {
      isGridAnimating.value = false
    }, 800)
  }
})

// Compute grid style based on total streams
const gridStyle = computed(() => {
  const count = totalStreams.value
  if (count === 0) {
    return {
      'grid-template-columns': '1fr',
      'grid-template-rows': '1fr',
    }
  }

  // Create an adaptive grid layout that adjusts to the number of participants
  if (count === 1) {
    return { 'grid-template-columns': '1fr' }
  } else if (count === 2) {
    return { 'grid-template-columns': '1fr 1fr' }
  } else if (count <= 4) {
    return {
      'grid-template-columns': '1fr 1fr',
      'grid-template-rows': '1fr 1fr'
    }
  } else if (count <= 6) {
    return { 'grid-template-columns': 'repeat(3, 1fr)' }
  } else {
    const cols = Math.ceil(Math.sqrt(count))
    return { 'grid-template-columns': `repeat(${cols}, 1fr)` }
  }
})

// Check if participant is new to apply animation
const isNewParticipant = (id: string) => {
  return joinedParticipants.value.includes(id)
}

onMounted(async () => {
  connect()
  try {
    localStream.value = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    if (localVideo.value) {
      localVideo.value.srcObject = localStream.value
    }

    // Auto-hide controls after 3 seconds
    setTimeout(() => {
      showControls.value = false
    }, 3000)
  } catch (error) {
    console.error('Error accessing media devices:', error)
    permissionError.value = error instanceof Error ? error.message : 'Unknown error'
  }
})

// Toggle video controls visibility
const toggleControls = () => {
  showControls.value = !showControls.value
  if (showControls.value) {
    // Auto-hide again after 3 seconds
    setTimeout(() => {
      showControls.value = false
    }, 3000)
  }
}

// Toggle audio mute
const toggleMute = () => {
  if (localStream.value) {
    const audioTracks = localStream.value.getAudioTracks()
    audioTracks.forEach(track => {
      track.enabled = !track.enabled
      isMuted.value = !track.enabled
    })
  }
}

// Toggle video on/off
const toggleVideo = () => {
  if (localStream.value) {
    const videoTracks = localStream.value.getVideoTracks()
    videoTracks.forEach(track => {
      track.enabled = !track.enabled
      isVideoOff.value = !track.enabled
    })
  }
}

// Dragging functionality for local video
const onMouseDown = (e: MouseEvent) => {
  isDragging = true
  offset.x = e.clientX - localVideoPosition.value.x
  offset.y = e.clientY - localVideoPosition.value.y

  // Show controls when starting to drag
  showControls.value = true
}

const onMouseMove = (e: MouseEvent) => {
  if (isDragging) {
    localVideoPosition.value.x = e.clientX - offset.x
    localVideoPosition.value.y = e.clientY - offset.y
  }
}

const onMouseUp = () => {
  isDragging = false

  // Auto-hide controls after drag
  setTimeout(() => {
    showControls.value = false
  }, 3000)
}
</script>

<template>
  <div class="video-chat" @mousemove="toggleControls">
    <!-- Background gradient with animated particles -->
    <div class="particles-background"></div>

    <!-- Header with room info -->
    <div class="room-header">
      <div class="room-info">
        <h1>Video Chat</h1>
        <p>{{ totalStreams }} participant{{ totalStreams !== 1 ? 's' : '' }} in call</p>
      </div>
      <div class="main-controls">
        <button @click="toggleMute" :class="{'active': isMuted}" class="control-btn">
          <span v-if="isMuted">🔇</span>
          <span v-else>🔊</span>
        </button>
        <button @click="toggleVideo" :class="{'active': isVideoOff}" class="control-btn">
          <span v-if="isVideoOff">🚫</span>
          <span v-else>📹</span>
        </button>
        <button class="control-btn end-call">Leave Call</button>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="permissionError" class="error-message">
      <div class="error-icon">⚠️</div>
      <div class="error-content">
        <h3>Camera/Microphone Error</h3>
        <p>{{ permissionError }}</p>
      </div>
    </div>

    <!-- Floating Local Video -->
    <div
      class="local-video-container"
      :class="{ 'video-off': isVideoOff }"
      :style="{ transform: `translate(${localVideoPosition.x}px, ${localVideoPosition.y}px)` }"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
    >
      <video ref="localVideo" autoplay muted playsinline class="local-video"></video>
      <div class="video-overlay">
        <div class="participant-name">
          <span>You ({{ userName }})</span>
          <span v-if="isMuted" class="muted-indicator">🔇</span>
        </div>
        <div v-if="isVideoOff" class="video-off-indicator">
          <div class="avatar">{{ userName.charAt(0) }}</div>
        </div>
      </div>
      <div class="control-bar" :class="{ 'visible': showControls }">
        <button @click.stop="toggleMute" :class="{'active': isMuted}" class="control-btn">
          <span v-if="isMuted">🔇</span>
          <span v-else>🔊</span>
        </button>
        <button @click.stop="toggleVideo" :class="{'active': isVideoOff}" class="control-btn">
          <span v-if="isVideoOff">🚫</span>
          <span v-else>📹</span>
        </button>
      </div>
    </div>

    <!-- Remote Streams Grid -->
    <div
      class="grid-container"
      :style="gridStyle"
      :class="{ 'grid-animating': isGridAnimating }"
    >
      <template v-for="(streams, participantId) in remoteStreams" :key="participantId">
        <div
          v-for="stream in streams"
          :key="stream.id"
          class="grid-item-wrapper"
          :class="{ 'new-participant': isNewParticipant(participantId) }"
        >
          <video
            class="grid-item"
            :srcObject="stream"
            autoplay
            playsinline
          ></video>
          <div class="participant-overlay">
            <div class="participant-name">
              <span>{{ participantId.substring(0, 8) }}</span>
            </div>
            <div class="stream-stats">
              <span class="quality-indicator high">HD</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Placeholder for when no participants are connected -->
      <div v-if="totalStreams === 0" class="empty-grid-message">
        <div class="waiting-animation">
          <div class="pulse-circle"></div>
          <div class="pulse-circle delay-1"></div>
          <div class="pulse-circle delay-2"></div>
        </div>
        <h2>Waiting for participants to join...</h2>
        <p>Share your meeting link to invite others</p>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.video-chat {
  min-height: 100vh;
  padding: 0;
  margin: 0;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background-color: #0f0f1a;
  color: white;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

  /* Animated background with particles */
  .particles-background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(ellipse at bottom, #1B2735 0%, #090A0F 100%);
    overflow: hidden;
    z-index: 0;

    &::before {
      content: '';
      position: absolute;
      width: 100%;
      height: 100%;
      background-image:
        radial-gradient(white, rgba(255,255,255,.2) 2px, transparent 3px),
        radial-gradient(white, rgba(255,255,255,.15) 1px, transparent 2px),
        radial-gradient(white, rgba(255,255,255,.1) 2px, transparent 3px);
      background-size: 550px 550px, 350px 350px, 250px 250px;
      background-position: 0 0, 40px 60px, 130px 270px;
      animation: starsAnimation 300s linear infinite;
    }
  }

  /* Header with room info and controls */
  .room-header {
    z-index: 10;
    padding: 16px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);

    .room-info {
      h1 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        background: linear-gradient(90deg, #38bdf8, #818cf8);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      p {
        margin: 4px 0 0;
        font-size: 14px;
        opacity: 0.7;
      }
    }

    .main-controls {
      display: flex;
      gap: 12px;

      .control-btn {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: white;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }

        &.active {
          background: #ef4444;
        }

        &.end-call {
          background: #ef4444;
          color: white;
          width: auto;
          padding: 0 20px;
          border-radius: 20px;

          &:hover {
            background: #dc2626;
          }
        }
      }
    }
  }

  /* Error message styling */
  .error-message {
    z-index: 20;
    margin: 20px;
    padding: 15px;
    background: rgba(239, 68, 68, 0.15);
    border-left: 4px solid #ef4444;
    border-radius: 4px;
    display: flex;
    align-items: center;
    animation: slideIn 0.5s ease;

    .error-icon {
      font-size: 24px;
      margin-right: 15px;
    }

    .error-content {
      h3 {
        margin: 0 0 5px;
        font-size: 16px;
      }

      p {
        margin: 0;
        font-size: 14px;
        opacity: 0.8;
      }
    }
  }

  /* Local video styling */
  .local-video-container {
    position: absolute;
    z-index: 15;
    width: 220px;
    height: 160px;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    cursor: move;
    transition: transform 0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94);

    &:hover {
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
    }

    &.video-off .local-video {
      opacity: 0;
    }

    .local-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: #000;
      transition: opacity 0.3s ease;
    }

    .video-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 40%);
      pointer-events: none;

      .participant-name {
        position: absolute;
        bottom: 12px;
        left: 12px;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;

        .muted-indicator {
          margin-left: 8px;
          font-size: 12px;
        }
      }

      .video-off-indicator {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(15, 15, 26, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;

        .avatar {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #38bdf8, #818cf8);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 600;
          text-transform: uppercase;
        }
      }
    }

    .control-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      justify-content: center;
      gap: 8px;
      padding: 8px;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(5px);
      opacity: 0;
      transform: translateY(100%);
      transition: all 0.3s ease;

      &.visible {
        opacity: 1;
        transform: translateY(0);
      }

      .control-btn {
        background: rgba(255, 255, 255, 0.15);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        &.active {
          background: #ef4444;
        }
      }
    }
  }

  /* Grid for remote video streams */
  .grid-container {
    flex: 1;
    z-index: 5;
    display: grid;
    gap: 10px;
    padding: 15px;
    margin: 15px;
    border-radius: 16px;
    background: rgba(15, 15, 26, 0.5);
    backdrop-filter: blur(8px);
    transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    position: relative;

    &.grid-animating {
      transform: scale(0.98);
      box-shadow: 0 0 60px rgba(56, 189, 248, 0.1);
    }

    .grid-item-wrapper {
      position: relative;
      overflow: hidden;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      background: #000;
      transform-origin: center;
      transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      border: 2px solid transparent;

      &:hover {
        transform: scale(1.02);
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
        border-color: rgba(56, 189, 248, 0.5);
        z-index: 2;
      }

      &.new-participant {
        animation: newParticipant 1s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .grid-item {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .participant-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 40%);
        opacity: 0;
        transition: opacity 0.3s ease;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 15px;

        .participant-name {
          align-self: flex-start;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
        }

        .stream-stats {
          align-self: flex-end;
          display: flex;
          gap: 8px;

          .quality-indicator {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;

            &.high {
              background: rgba(56, 189, 248, 0.7);
            }

            &.medium {
              background: rgba(250, 204, 21, 0.7);
            }

            &.low {
              background: rgba(239, 68, 68, 0.7);
            }
          }
        }
      }

      &:hover .participant-overlay {
        opacity: 1;
      }
    }

    /* Empty state with waiting animation */
    .empty-grid-message {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      height: 100%;
      gap: 20px;

      h2 {
        font-size: 24px;
        font-weight: 500;
        margin: 0;
        background: linear-gradient(90deg, #38bdf8, #818cf8);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      p {
        font-size: 16px;
        opacity: 0.7;
        margin: 0;
      }

      .waiting-animation {
        position: relative;
        width: 80px;
        height: 80px;

        .pulse-circle {
          position: absolute;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(56, 189, 248, 0.3);
          opacity: 0.6;
          animation: pulse 2s ease-out infinite;

          &.delay-1 {
            animation-delay: 0.6s;
          }

          &.delay-2 {
            animation-delay: 1.2s;
          }
        }
      }
    }
  }
}

/* Animations */
@keyframes pulse {
  0% {
    transform: scale(0.3);
    opacity: 0.6;
  }
  100% {
    transform: scale(1.2);
    opacity: 0;
  }
}

@keyframes starsAnimation {
  from {
    background-position: 0 0, 40px 60px, 130px 270px;
  }
  to {
    background-position: 1000px 1000px, 1040px 1060px, 1130px 1270px;
  }
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes newParticipant {
  0% {
    transform: scale(0.5);
    opacity: 0;
    border-color: rgba(56, 189, 248, 0.8);
    box-shadow: 0 0 30px rgba(56, 189, 248, 0.6);
  }
  50% {
    border-color: rgba(56, 189, 248, 0.8);
    box-shadow: 0 0 30px rgba(56, 189, 248, 0.6);
  }
  100% {
    transform: scale(1);
    opacity: 1;
    border-color: transparent;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }
}

/* Media Queries for Responsive Design */
@media (max-width: 768px) {
  .video-chat {
    .room-header {
      flex-direction: column;
      gap: 15px;
      align-items: center;

      .room-info {
        text-align: center;
      }
    }

    .local-video-container {
      width: 150px;
      height: 110px;
    }

    .grid-container {
      margin: 10px;
      padding: 10px;
      gap: 8px;
    }
  }
}
</style>
