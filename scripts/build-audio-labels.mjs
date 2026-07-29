/**
 * Build locales/sound-labels.{en,es}.json and music-labels.{en,es}.json
 * Run: node scripts/build-audio-labels.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../locales');

const sounds = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../assets/sound-library/game-sounds.json'), 'utf8')
);
const music = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../assets/sound-library/game-music.json'), 'utf8')
);

const SOUND_EN = {
  click: 'Button click',
  select: 'Menu select',
  confirm: 'Confirm',
  switch: 'Switch',
  ui_error: 'UI error',
  tick: 'Timer tick',
  back: 'Back',
  jump: 'Jump',
  footsteps: 'Footsteps',
  land: 'Landing',
  dash: 'Dash',
  shoot: 'Shoot',
  laser: 'Laser',
  hit: 'Hit',
  collision: 'Collision',
  punch: 'Punch',
  explosion: 'Explosion',
  glass_break: 'Glass break',
  coin: 'Coin',
  collect: 'Item pickup',
  powerup: 'Power-up',
  magic: 'Magic',
  hurt: 'Hurt',
  death: 'Character death',
  oops: 'Miss',
  win: 'Win',
  success: 'Success',
  lose: 'Lose',
  game_start: 'Game start',
  game_over: 'Game over',
  level_up: 'Level up',
  alert: 'Alert'
};

const SOUND_ES = {
  click: 'Clic de botón',
  select: 'Selección de menú',
  confirm: 'Confirmación',
  switch: 'Interruptor',
  ui_error: 'Error de interfaz',
  tick: 'Tic del temporizador',
  back: 'Atrás',
  jump: 'Salto',
  footsteps: 'Pasos',
  land: 'Aterrizaje',
  dash: 'Impulso',
  shoot: 'Disparo',
  laser: 'Láser',
  hit: 'Impacto',
  collision: 'Colisión',
  punch: 'Golpe',
  explosion: 'Explosión',
  glass_break: 'Cristal roto',
  coin: 'Moneda',
  collect: 'Recoger objeto',
  powerup: 'Bonificación',
  magic: 'Magia',
  hurt: 'Daño',
  death: 'Muerte del personaje',
  oops: 'Fallo',
  win: 'Victoria',
  success: 'Éxito',
  lose: 'Derrota',
  game_start: 'Inicio de partida',
  game_over: 'Fin de partida',
  level_up: 'Subir de nivel',
  alert: 'Alerta'
};

const MUSIC_EN = {
  menu: 'Game menu',
  gameplay: 'Gameplay',
  action: 'Action',
  space: 'Space',
  fantasy: 'Fantasy',
  racing: 'Racing',
  calm: 'Calm',
  relaxed: 'Relaxed',
  cave: 'Cave',
  piano: 'Piano',
  lounge: 'Lounge',
  reggae: 'Reggae',
  retro: 'Retro game',
  retro_beat: '8-bit beat',
  retro_comedy: '8-bit comedy',
  retro_mystic: '8-bit mystic',
  retro_polka: '8-bit arcade',
  retro_reggae: '8-bit chiptune',
  victory: 'Victory',
  retro_jingle: '8-bit jingle'
};

const MUSIC_ES = {
  menu: 'Menú del juego',
  gameplay: 'Jugabilidad',
  action: 'Acción',
  space: 'Espacio',
  fantasy: 'Fantasía',
  racing: 'Carreras',
  calm: 'Calma',
  relaxed: 'Relajada',
  cave: 'Cueva',
  piano: 'Piano',
  lounge: 'Lounge',
  reggae: 'Reggae',
  retro: 'Juego retro',
  retro_beat: 'Bit 8-bit',
  retro_comedy: 'Comedia 8-bit',
  retro_mystic: 'Mística 8-bit',
  retro_polka: 'Arcade 8-bit',
  retro_reggae: 'Chiptune 8-bit',
  victory: 'Victoria',
  retro_jingle: 'Jingle 8-bit'
};

function buildMap(entries, enMap, esMap) {
  const en = {};
  const es = {};
  entries.forEach(function (entry) {
    en[entry.id] = enMap[entry.id] || entry.label;
    es[entry.id] = esMap[entry.id] || entry.label;
  });
  return { en, es };
}

const soundMaps = buildMap(sounds, SOUND_EN, SOUND_ES);
const musicMaps = buildMap(music, MUSIC_EN, MUSIC_ES);

fs.writeFileSync(path.join(localesDir, 'sound-labels.en.json'), JSON.stringify(soundMaps.en, null, 2));
fs.writeFileSync(path.join(localesDir, 'sound-labels.es.json'), JSON.stringify(soundMaps.es, null, 2));
fs.writeFileSync(path.join(localesDir, 'music-labels.en.json'), JSON.stringify(musicMaps.en, null, 2));
fs.writeFileSync(path.join(localesDir, 'music-labels.es.json'), JSON.stringify(musicMaps.es, null, 2));

console.log('sound labels:', Object.keys(soundMaps.en).length);
console.log('music labels:', Object.keys(musicMaps.en).length);
