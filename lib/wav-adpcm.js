/**
 * Конвертация IMA ADPCM WAV → PCM WAV для браузера и pgz.
 * Алгоритм decodeBlock — MIT (Rafael da Silva Rocha / imaadpcm).
 */
(function () {
  'use strict';

  var INDEX_TABLE = [
    -1, -1, -1, -1, 2, 4, 6, 8,
    -1, -1, -1, -1, 2, 4, 6, 8
  ];

  var STEP_TABLE = [
    7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31,
    34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143,
    157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544,
    598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878,
    2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894,
    6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818,
    18500, 20350, 22385, 24623, 27086, 29794, 32767
  ];

  var decoderPredicted = 0;
  var decoderIndex = 0;
  var decoderStep = 7;

  function readFourCC(view, offset) {
    return String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
  }

  function writeFourCC(view, offset, str) {
    for (var i = 0; i < 4; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  function sign16(num) {
    return num > 32768 ? num - 65536 : num;
  }

  function updateDecoder(nibble) {
    decoderIndex += INDEX_TABLE[nibble];
    if (decoderIndex < 0) decoderIndex = 0;
    else if (decoderIndex > 88) decoderIndex = 88;
    decoderStep = STEP_TABLE[decoderIndex];
  }

  function decodeSample(nibble) {
    var difference = 0;
    if (nibble & 4) difference += decoderStep;
    if (nibble & 2) difference += decoderStep >> 1;
    if (nibble & 1) difference += decoderStep >> 2;
    difference += decoderStep >> 3;
    if (nibble & 8) difference = -difference;
    decoderPredicted += difference;
    if (decoderPredicted > 32767) decoderPredicted = 32767;
    else if (decoderPredicted < -32768) decoderPredicted = -32768;
    updateDecoder(nibble);
    return decoderPredicted;
  }

  function decodeBlock(block) {
    decoderPredicted = sign16((block[1] << 8) | block[0]);
    decoderIndex = block[2];
    decoderStep = STEP_TABLE[decoderIndex];
    var result = [decoderPredicted, decoderPredicted];
    for (var i = 4; i < block.length; i++) {
      var b = block[i];
      var hi = b >> 4;
      var lo = b & 0x0f;
      result.push(decodeSample(lo));
      result.push(decodeSample(hi));
    }
    return result;
  }

  function decodeMonoImaAdpcm(bytes, blockAlign) {
    var out = [];
    for (var i = 0; i < bytes.length; i += blockAlign) {
      var end = Math.min(i + blockAlign, bytes.length);
      if (end - i < 4) continue;
      var block = Array.prototype.slice.call(bytes, i, end);
      var decoded = decodeBlock(block);
      for (var j = 0; j < decoded.length; j++) out.push(decoded[j]);
    }
    return new Int16Array(out);
  }

  function parseWav(buffer) {
    var view = new DataView(buffer);
    if (buffer.byteLength < 12 || readFourCC(view, 0) !== 'RIFF' || readFourCC(view, 8) !== 'WAVE') {
      throw new Error('Некорректный WAV');
    }

    var fmt = null;
    var dataOffset = null;
    var dataSize = null;
    var offset = 12;

    while (offset + 8 <= buffer.byteLength) {
      var id = readFourCC(view, offset);
      var size = view.getUint32(offset + 4, true);
      var chunkStart = offset + 8;
      if (id === 'fmt ') {
        fmt = {
          audioFormat: view.getUint16(chunkStart, true),
          numChannels: view.getUint16(chunkStart + 2, true),
          sampleRate: view.getUint32(chunkStart + 4, true),
          blockAlign: view.getUint16(chunkStart + 12, true),
          bitsPerSample: view.getUint16(chunkStart + 14, true)
        };
      } else if (id === 'data') {
        dataOffset = chunkStart;
        dataSize = size;
      }
      offset = chunkStart + size + (size % 2);
    }

    if (!fmt || dataOffset == null || dataSize == null) {
      throw new Error('WAV без fmt/data');
    }
    return { fmt: fmt, dataOffset: dataOffset, dataSize: dataSize };
  }

  function buildPcmWav(samples, sampleRate, numChannels) {
    var dataSize = samples.length * 2;
    var buffer = new ArrayBuffer(44 + dataSize);
    var view = new DataView(buffer);
    writeFourCC(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeFourCC(view, 8, 'WAVE');
    writeFourCC(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeFourCC(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    new Int16Array(buffer, 44).set(samples);
    return buffer;
  }

  function isImaAdpcm(fmt) {
    return fmt && fmt.audioFormat === 0x11;
  }

  function ensurePlayableWav(arrayBuffer) {
    var parsed = parseWav(arrayBuffer);
    if (!isImaAdpcm(parsed.fmt)) {
      return { buffer: arrayBuffer, converted: false };
    }
    if (parsed.fmt.numChannels !== 1) {
      throw new Error('Поддерживаются только моно ADPCM');
    }

    var adpcm = new Uint8Array(arrayBuffer, parsed.dataOffset, parsed.dataSize);
    var pcm = decodeMonoImaAdpcm(adpcm, parsed.fmt.blockAlign || 512);
    return {
      buffer: buildPcmWav(pcm, parsed.fmt.sampleRate, 1),
      converted: true
    };
  }

  window.WavAdpcm = {
    ensurePlayableWav: ensurePlayableWav,
    isImaAdpcm: isImaAdpcm,
    parseWav: parseWav
  };

  window._wavAdpcmTest = {
    decodeMonoImaAdpcm: decodeMonoImaAdpcm,
    buildPcmWav: buildPcmWav,
    isImaAdpcm: isImaAdpcm
  };
})();
