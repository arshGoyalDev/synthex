export interface DockerStreamFrame {
  type: "stdout" | "stderr";
  payload: Buffer;
}

export function createDockerFrameParser(
  onFrame: (frame: DockerStreamFrame) => void,
) {
  let pending = Buffer.alloc(0);

  return (chunk: Buffer) => {
    pending = Buffer.concat([pending, chunk]);

    while (pending.length >= 8) {
      const streamType = pending[0];
      const payloadLength = pending.readUInt32BE(4);
      const frameLength = 8 + payloadLength;

      if (pending.length < frameLength) {
        return;
      }

      const payload = pending.subarray(8, frameLength);
      pending = pending.subarray(frameLength);

      onFrame({
        type: streamType === 2 ? "stderr" : "stdout",
        payload,
      });
    }
  };
}
