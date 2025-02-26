<script setup lang="ts">

interface GridItem {
  name: string;
}

const grids = ref<GridItem[]>([{ name: "Pre" }]);


const gridStyle = computed(() => {
  const count = grids.value.length;
  
  if (count === 1) {
    return { 
      'grid-template-columns': '1fr',
      'grid-template-rows': '1fr'
    };
  }

  // Calculate optimal rows and columns
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  
  return {
    'grid-template-columns': `repeat(${cols}, 1fr)`,
    'grid-template-rows': `repeat(${rows}, 1fr)`
  };
});

const callStore = useCallStore()
const { localStream, remoteStreams } = storeToRefs(callStore)
const {connect} = callStore
const localVideo = ref<HTMLVideoElement | null>(null)

   
onMounted(async () => {
  connect()
  await nextTick()
  try {
    localStream.value = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    if (localVideo.value) {
      localVideo.value.srcObject = localStream.value
    }
  } catch (error) {
    console.error('Error accessing media devices.', error)
  }
})

</script>

<template>
  <div class="video-layout">
    <video ref="localVideo" autoplay muted style="width: 300px;"></video>
    <div class="grid-container" :style="gridStyle">
      <template  v-for="(streams, participantId) in remoteStreams" :key="participantId">
        <video class="grid-item" v-for="stream in streams" :key="stream.id" :srcObject="stream" autoplay style="width: 300px;"></video>
      </template>
    </div>
  </div>
</template>

<style lang="scss">
.video-layout {
  padding: 15px;
  
  button {
    margin-right: 10px;
    padding: 5px 10px;
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .grid-container {
    height: calc(100vh - 83px); // Adjusted for padding and buttons
    background-color: rgba(0, 0, 0, 0.1);
    display: grid;
    grid-gap: 3px;
    margin-top: 15px;
    overflow: auto;
    
    .grid-item {
      background-color: rgba(0, 0, 0, 0.5);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0; // Prevents grid items from overflowing
    }
  }
}
</style>