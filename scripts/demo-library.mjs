// Generates a small, copyright-free demo library: synthesized WAV tracks with
// RIFF INFO tags and a generated PNG cover per album. Useful for development,
// screenshots and trying Plak without your own music.
//
//   npm run demo-library            -> writes into ./music/Plak Demo
//   npm run demo-library -- <dir>   -> writes into <dir>

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const target = path.resolve(process.argv[2] ?? 'music/Plak Demo');
const SAMPLE_RATE = 22050;

const ALBUMS = [
  {
    artist: 'Gece Treni',
    title: 'İstasyon Işıkları',
    year: 2024,
    color: [232, 93, 4],
    tracks: ['Son Vapur', 'Şehir Uyurken', 'Kırık Saat', 'Gölgeler'],
    root: 220,
  },
  {
    artist: 'Mavi Kuşlar',
    title: 'Ege Rüzgârı',
    year: 2023,
    color: [3, 105, 161],
    tracks: ['Dalga', 'Çınar Altında', 'Öğle Sıcağı'],
    root: 261.63,
  },
  {
    artist: 'Synthwave Collective',
    title: 'Neon Lines',
    year: 2025,
    color: [168, 85, 247],
    tracks: ['Midnight Drive', 'Arcade', 'Afterglow', 'Static Bloom', 'Home'],
    root: 196,
  },
];

function tone(rootHz, seconds, seed) {
  const samples = Math.floor(seconds * SAMPLE_RATE);
  const data = Buffer.alloc(samples * 2);
  const scale = [0, 3, 5, 7, 10, 12];
  const noteLength = Math.floor(SAMPLE_RATE * 0.25);
  for (let i = 0; i < samples; i++) {
    const step = Math.floor(i / noteLength);
    const semitone = scale[(step * 7 + seed * 3 + Math.floor(step / 4)) % scale.length];
    const hz = rootHz * 2 ** (semitone / 12);
    const t = i / SAMPLE_RATE;
    const local = (i % noteLength) / noteLength;
    const envelope = Math.min(1, local * 20) * (1 - local) ** 2;
    const pad = Math.sin(2 * Math.PI * (rootHz / 2) * t) * 0.15;
    const fade = Math.min(1, t / 0.5, (seconds - t) / 1.5);
    const value = (Math.sin(2 * Math.PI * hz * t) * 0.35 * envelope + pad) * fade;
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), i * 2);
  }
  return data;
}

function syncsafe(n) {
  return Buffer.from([(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f]);
}

// An ID3v2.4 tag inside a RIFF "id3 " chunk. Unlike RIFF INFO tags, which
// readers decode as Latin-1, ID3 frames can declare UTF-8, so "Işık" survives.
function id3Chunk(tags) {
  const frames = Object.entries(tags).map(([id, value]) => {
    const body = Buffer.concat([Buffer.from([3]), Buffer.from(value, 'utf8')]);
    return Buffer.concat([Buffer.from(id, 'ascii'), syncsafe(body.length), Buffer.alloc(2), body]);
  });
  const content = Buffer.concat(frames);
  const tag = Buffer.concat([Buffer.from('ID3', 'ascii'), Buffer.from([4, 0, 0]), syncsafe(content.length), content]);
  const padded = tag.length % 2 ? Buffer.concat([tag, Buffer.alloc(1)]) : tag;
  const header = Buffer.alloc(8);
  header.write('id3 ', 0, 'ascii');
  header.writeUInt32LE(tag.length, 4);
  return Buffer.concat([header, padded]);
}

function wav(pcm, tags) {
  const fmt = Buffer.alloc(24);
  fmt.write('fmt ', 0, 'ascii');
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(1, 8); // PCM
  fmt.writeUInt16LE(1, 10); // mono
  fmt.writeUInt32LE(SAMPLE_RATE, 12);
  fmt.writeUInt32LE(SAMPLE_RATE * 2, 16);
  fmt.writeUInt16LE(2, 20);
  fmt.writeUInt16LE(16, 22);
  const dataHeader = Buffer.alloc(8);
  dataHeader.write('data', 0, 'ascii');
  dataHeader.writeUInt32LE(pcm.length, 4);
  const info = id3Chunk(tags);
  const riff = Buffer.alloc(12);
  riff.write('RIFF', 0, 'ascii');
  riff.writeUInt32LE(4 + fmt.length + info.length + dataHeader.length + pcm.length, 4);
  riff.write('WAVE', 8, 'ascii');
  return Buffer.concat([riff, fmt, info, dataHeader, pcm]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

function cover([r, g, b], seed, size = 400) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const dx = x - size * 0.62;
      const dy = y - size * 0.4;
      const ring = Math.sin(Math.hypot(dx, dy) / (9 + seed * 2)) * 0.5 + 0.5;
      const shade = 0.35 + 0.65 * (1 - y / size) * 0.6 + ring * 0.25;
      row[1 + x * 3] = Math.min(255, r * shade);
      row[2 + x * 3] = Math.min(255, g * shade);
      row[3 + x * 3] = Math.min(255, b * shade);
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

let count = 0;
ALBUMS.forEach((album, albumIndex) => {
  const folder = path.join(target, album.artist, album.title);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'cover.png'), cover(album.color, albumIndex));
  album.tracks.forEach((title, index) => {
    const seconds = 20 + ((index * 7 + albumIndex * 5) % 15);
    const file = path.join(folder, `${String(index + 1).padStart(2, '0')} ${title}.wav`);
    const tags = {
      TIT2: title,
      TPE1: album.artist,
      TALB: album.title,
      TDRC: String(album.year),
      TRCK: `${index + 1}/${album.tracks.length}`,
      TCON: 'Demo',
    };
    fs.writeFileSync(file, wav(tone(album.root, seconds, index + albumIndex), tags));
    count++;
  });
});

console.log(`Wrote ${count} demo tracks to ${target}`);
