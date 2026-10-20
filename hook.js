// The one rule, live: two parents' leaf ranks and the seed they make. Uses the
// app's own breeding engine (js/breed.js, copied unchanged from the app).
import { crossTier } from './js/breed.js';
import { FOLIAGE, TIERS } from './js/species.js';

const $ = (id) => document.getElementById(id);
const a = $('rankA');
const b = $('rankB');
const track = $('track');

if (a && b && track) {
  for (let r = 1; r <= TIERS; r++) {
    const cell = document.createElement('span');
    cell.textContent = r;
    track.appendChild(cell);
  }

  const draw = () => {
    const ra = Number(a.value);
    const rb = Number(b.value);
    const rc = crossTier(ra, rb);
    const half = (ra + rb) % 2 === 1;
    $('nameA').textContent = `${FOLIAGE[ra - 1]} (rank ${ra})`;
    $('nameB').textContent = `${FOLIAGE[rb - 1]} (rank ${rb})`;
    $('nameChild').textContent = FOLIAGE[rc - 1];
    $('rankChild').textContent = half
      ? `(${ra} + ${rb}) ÷ 2 = ${(ra + rb) / 2}, rounded up to ${rc}`
      : `(${ra} + ${rb}) ÷ 2 = ${rc}`;
    [...track.children].forEach((cell, i) => {
      const r = i + 1;
      cell.className = [r === ra && 'is-a', r === rb && 'is-b', r === rc && 'is-child'].filter(Boolean).join(' ');
    });
  };
  a.addEventListener('input', draw);
  b.addEventListener('input', draw);
  draw();
}

// The hero loop plays by itself, except for visitors who asked for less motion:
// they get the still and the controls.
const hero = $('heroVideo');
if (hero && matchMedia('(prefers-reduced-motion: reduce)').matches) {
  hero.removeAttribute('autoplay');
  hero.pause();
  hero.controls = true;
}

// Browsers only autoplay muted video, so the music waits for the speaker button.
const sound = $('heroSound');
if (hero && sound) {
  sound.addEventListener('click', () => {
    hero.muted = !hero.muted;
    if (!hero.muted && hero.paused) hero.play().catch(() => {});
    sound.setAttribute('aria-pressed', String(!hero.muted));
    sound.setAttribute('aria-label', hero.muted ? 'Play the music' : 'Mute the music');
  });
}
