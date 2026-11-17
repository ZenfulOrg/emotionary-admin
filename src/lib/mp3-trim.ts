/**
 * Cuts the silence Google's voices put before a word (up to ~0.9 s), so a
 * pronunciation starts the moment it is tapped. Works on the MP3 frames
 * directly: no decoding, no re-encoding, the word itself is untouched.
 *
 * Each MPEG audio frame carries a "global gain" (its overall loudness) in its
 * side info. Silence sits near the file's floor (and digital silence is
 * encoded at 210), speech rises well above it. Frames before the first loud
 * one are dropped, keeping a few as a soft lead-in.
 */

const BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG-1
  2: [22050, 24000, 16000], // MPEG-2
  0: [11025, 12000, 8000], // MPEG-2.5
};
/** Gain the encoder writes for frames of pure digital silence. */
const DIGITAL_SILENCE = 210;
/** Frames kept before the first loud one (~24 ms each at 24 kHz): a soft lead-in. */
const LEAD_IN_FRAMES = 5;
/** Where between the quiet floor and the loud level speech is said to start. */
const SPEECH_FRACTION = 0.4;
/** Below this many silent frames (~100 ms) the file is left alone, so trimming twice is a no-op. */
const MIN_CUT_FRAMES = 4;

type Frame = { offset: number; gain: number };

/** Reads `count` bits starting `bit` bits into `bytes` at `start`. */
function readBits(bytes: Uint8Array, start: number, bit: number, count: number): number {
  let value = 0;
  for (let i = 0; i < count; i++) {
    const position = bit + i;
    const byte = bytes[start + (position >> 3)] ?? 0;
    value = (value << 1) | ((byte >> (7 - (position & 7))) & 1);
  }
  return value;
}

function id3Length(bytes: Uint8Array): number {
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0; // "ID3"
  return 10 + (((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f));
}

/** Layer III frames with the first granule's global gain. */
export function mp3Frames(bytes: Uint8Array): { start: number; frames: Frame[] } {
  const start = id3Length(bytes);
  const frames: Frame[] = [];
  let i = start;
  while (i + 4 <= bytes.length) {
    const header = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
    const version = (header >>> 19) & 3;
    const layer = (header >>> 17) & 3;
    const bitrateIndex = (header >>> 12) & 15;
    const rateIndex = (header >>> 10) & 3;
    if (
      header >>> 21 !== 0x7ff ||
      layer !== 1 || // Layer III
      version === 1 ||
      bitrateIndex === 0 ||
      bitrateIndex === 15 ||
      rateIndex === 3
    ) {
      i++;
      continue;
    }
    const mpeg1 = version === 3;
    const sampleRate = SAMPLE_RATES[version][rateIndex];
    const padding = (header >>> 9) & 1;
    const size = mpeg1
      ? Math.floor((144000 * BITRATES_V1[bitrateIndex]) / sampleRate) + padding
      : Math.floor((72000 * BITRATES_V2[bitrateIndex]) / sampleRate) + padding;
    const mono = ((header >>> 6) & 3) === 3;
    const crc = ((header >>> 16) & 1) === 0;
    const side = i + 4 + (crc ? 2 : 0);
    // Side info up to the first granule's global_gain:
    // main_data_begin, private bits, (scfsi), part2_3_length (12), big_values (9).
    const before = mpeg1 ? 9 + (mono ? 5 : 3) + (mono ? 4 : 8) : 8 + (mono ? 1 : 2);
    frames.push({ offset: i, gain: readBits(bytes, side, before + 12 + 9, 8) });
    i += size;
  }
  return { start, frames };
}

/** The same MP3 with its leading silence removed (unchanged when there is none). */
export function trimLeadingSilence(input: Uint8Array): Uint8Array {
  const { start, frames } = mp3Frames(input);
  if (frames.length < 10) return input;
  const sounding = frames
    .slice(1)
    .map((frame) => frame.gain)
    .filter((gain) => gain > 0 && gain < DIGITAL_SILENCE)
    .sort((a, b) => a - b);
  if (sounding.length === 0) return input;
  const floor = sounding[Math.floor(sounding.length / 10)];
  const loud = sounding[Math.floor((sounding.length * 9) / 10)];
  const threshold = floor + SPEECH_FRACTION * (loud - floor);
  const firstLoud = frames.findIndex(
    (frame, index) => index > 0 && frame.gain > 0 && frame.gain < DIGITAL_SILENCE && frame.gain >= threshold,
  );
  const keepFrom = Math.max(0, firstLoud - LEAD_IN_FRAMES);
  if (keepFrom < MIN_CUT_FRAMES) return input;
  const out = new Uint8Array(start + (input.length - frames[keepFrom].offset));
  out.set(input.subarray(0, start), 0);
  out.set(input.subarray(frames[keepFrom].offset), start);
  return out;
}
