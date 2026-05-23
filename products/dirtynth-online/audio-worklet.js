class DirtynthAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.capacity = 0;
    this.audio = null;
    this.state = null;

    this.port.onmessage = (event) => {
      if (event.data.type === "connect") {
        this.capacity = event.data.capacity;
        this.audio = new Float32Array(event.data.audioBuffer);
        this.state = new Int32Array(event.data.stateBuffer);
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || output[0];

    if (!this.audio || !this.state || this.capacity <= 0) {
      left.fill(0);
      right.fill(0);
      return true;
    }

    let read = Atomics.load(this.state, 0);
    const write = Atomics.load(this.state, 1);
    let available = write >= read ? write - read : this.capacity - read + write;

    for (let i = 0; i < left.length; i += 1) {
      if (available > 0) {
        const offset = read * 2;
        left[i] = this.audio[offset];
        right[i] = this.audio[offset + 1];
        read = (read + 1) % this.capacity;
        available -= 1;
      } else {
        left[i] = 0;
        right[i] = 0;
      }
    }

    Atomics.store(this.state, 0, read);
    return true;
  }
}

registerProcessor("dirtynth-audio", DirtynthAudioProcessor);
