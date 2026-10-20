// The breeding calculator. Every answer comes from the app's own engine
// (js/breed.js, js/species.js, js/campaign.js, copied unchanged), so the site
// and the app can never disagree.
import { cross, findPath, ceilings, floors } from './js/breed.js';
import { FOLIAGE, FLOWERS, TIERS, speciesName, parseSpeciesName, speciesTier, magicOf, CARE } from './js/species.js';
import { packetFor } from './js/campaign.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const same = (x, y) => x.f === y.f && x.w === y.w;

// ---- every species, for the pickers ----
const ALL = [];
for (let f = 1; f <= TIERS; f++) for (let w = 1; w <= TIERS; w++) ALL.push({ f, w, name: speciesName({ f, w }) });
const list = $('speciesList');
for (const s of [...ALL].sort((a, b) => a.name.localeCompare(b.name))) {
  const o = document.createElement('option');
  o.value = s.name;
  list.appendChild(o);
}

/** What a plant is: its two halves, its tier and what it needs, and whether it is magic. */
function describe(s) {
  const t = speciesTier(s);
  const magic = magicOf(s);
  let html = `<p>Leaves: ${FOLIAGE[s.f - 1]} (rank ${s.f} of ${TIERS}). Flowers: ${FLOWERS[s.w - 1]} (rank ${s.w} of ${TIERS}).</p>`;
  html += `<p><span class="tier t${t}">T${t}</span> Needs ${CARE[t].need}.</p>`;
  if (magic) html += `<p class="magic-note">A Magic Plant: the ${magic.name}. Its effect: ${magic.effect}.</p>`;
  return html;
}

function show(out, html, isError = false) {
  out.innerHTML = html;
  out.classList.toggle('is-error', isError);
}

const notAName = (text) =>
  `<p>"${esc(text)}" is not a species name. Pick one from the list: flowers first, then leaves, like "Fabled Lemonbush".</p>`;

// ---- cross two plants ----
const crossA = $('crossA');
const crossB = $('crossB');
const crossOut = $('crossOut');

function crossNow(complain) {
  const a = parseSpeciesName(crossA.value);
  const b = parseSpeciesName(crossB.value);
  crossA.setAttribute('aria-invalid', String(complain && crossA.value.trim() !== '' && !a));
  crossB.setAttribute('aria-invalid', String(complain && crossB.value.trim() !== '' && !b));
  if (a && b) {
    const child = cross(a, b);
    const clone = same(a, b);
    show(crossOut, `<div class="name">${speciesName(child)}</div>`
      + `<p>${clone ? 'A plant crossed with its own kind gives the same plant.' : 'Every seed from this cross is this plant.'}</p>`
      + describe(child));
    return;
  }
  const bad = complain && [crossA, crossB].find((el) => el.value.trim() !== '' && !parseSpeciesName(el.value));
  show(crossOut, bad ? notAName(bad.value.trim()) : '', !!bad);
}
for (const el of [crossA, crossB]) {
  el.addEventListener('input', () => crossNow(false));
  el.addEventListener('change', () => crossNow(true));
}
$('crossForm').addEventListener('submit', (e) => { e.preventDefault(); crossNow(true); });

// ---- from your plants to the one you want ----
const ownInput = $('ownInput');
const ownList = $('ownList');
const target = $('target');
const routeOut = $('routeOut');

let owned = [];
try {
  const saved = JSON.parse(localStorage.getItem('ifj-owned') || '[]');
  owned = saved.map(parseSpeciesName).filter(Boolean);
} catch { owned = []; }
const remember = () => {
  try { localStorage.setItem('ifj-owned', JSON.stringify(owned.map(speciesName))); } catch { /* private window */ }
};

function drawOwned() {
  ownList.textContent = '';
  owned.forEach((s, i) => {
    const li = document.createElement('li');
    li.append(speciesName(s));
    const x = document.createElement('button');
    x.type = 'button';
    x.setAttribute('aria-label', `Remove ${speciesName(s)}`);
    x.innerHTML = '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M3 3 L9 9 M9 3 L3 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    x.addEventListener('click', () => { owned.splice(i, 1); remember(); drawOwned(); route(false); });
    li.appendChild(x);
    ownList.appendChild(li);
  });
}

$('ownForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = ownInput.value.trim();
  if (!text) return;
  const s = parseSpeciesName(text);
  ownInput.setAttribute('aria-invalid', String(!s));
  if (!s) { show(routeOut, notAName(text), true); return; }
  if (!owned.some((o) => same(o, s))) owned.push(s);
  ownInput.value = '';
  remember();
  drawOwned();
  route(false);
});
// Picking from the list fills the box; add it straight away.
ownInput.addEventListener('change', () => {
  if (parseSpeciesName(ownInput.value)) $('ownForm').requestSubmit();
});

/** Why no cross can make it: the wanted plant sits outside the band your plants span. */
function whyNot(t) {
  const hi = ceilings(owned);
  const lo = floors(owned);
  const out = [];
  const axis = (names, what, want, top, bottom) => {
    const packet = packetFor(want);
    if (want > top) {
      out.push(`None of your plants has ${what} as high as ${names[want - 1]} (rank ${want}); your highest is ${names[top - 1]} (${top}). `
        + `No cross goes above your best plant, so buy ${packet.name} ($${packet.price}) until one comes up with ${names[want - 1]} or higher ${what}.`);
    } else if (want < bottom) {
      out.push(`None of your plants has ${what} as low as ${names[want - 1]} (rank ${want}); your lowest is ${names[bottom - 1]} (${bottom}). `
        + `No cross goes below your lowest plant either, so buy ${packet.name} ($${packet.price}) until one comes up with ${names[want - 1]} or lower ${what}.`);
    }
  };
  axis(FOLIAGE, 'leaves', t.f, hi.f, lo.f);
  axis(FLOWERS, 'flowers', t.w, hi.w, lo.w);
  return out;
}

function route(complain) {
  const text = target.value.trim();
  const t = parseSpeciesName(text);
  target.setAttribute('aria-invalid', String(complain && text !== '' && !t));
  if (!t) { show(routeOut, complain && text ? notAName(text) : '', !!(complain && text)); return; }
  const name = speciesName(t);
  if (!owned.length) { show(routeOut, `<p>Add at least one plant you have, and you get the way to ${name}.</p>`); return; }

  const path = findPath(owned, t, { maxDepth: 6 });
  if (path && !path.length) { show(routeOut, `<div class="name">${name}</div><p>You already have it.</p>` + describe(t)); return; }
  if (!path) {
    const reasons = whyNot(t);
    const body = reasons.length
      ? reasons.map((r) => `<p>${r}</p>`).join('')
      : '<p>No route within six crosses from these plants. Add more of the plants you have.</p>';
    show(routeOut, `<div class="name">No cross makes ${name} yet</div>${body}`, true);
    return;
  }
  const steps = path.map((s) => `<li>Cross <b>${speciesName(s.a)}</b> with <b>${speciesName(s.b)}</b>: seeds of <b>${speciesName(s.result)}</b></li>`).join('');
  show(routeOut, `<div class="name">${path.length} cross${path.length === 1 ? '' : 'es'} to ${name}</div>`
    + `<ol class="route">${steps}</ol>`
    + '<p>Plant each new seed and let it grow until it can pollinate before the next cross.</p>'
    + describe(t));
}
target.addEventListener('input', () => route(false));
target.addEventListener('change', () => route(true));
$('targetForm').addEventListener('submit', (e) => { e.preventDefault(); route(true); });

drawOwned();

// ---- the six Magic Plants: "Route from my plants" fills in the wanted plant ----
for (const btn of document.querySelectorAll('[data-target]')) {
  btn.addEventListener('click', () => {
    target.value = btn.dataset.target;
    route(true);
    $('route').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    (owned.length ? target : ownInput).focus({ preventScroll: true });
  });
}

// ---- the chart: leaves down, flowers across ----
const grid = $('chartGrid');
const chartOut = $('chartOut');
let pressed = null;

grid.appendChild(document.createElement('span'));
for (const w of FLOWERS) {
  const h = document.createElement('span');
  h.className = 'col-head';
  h.textContent = w;
  grid.appendChild(h);
}
for (let f = 1; f <= TIERS; f++) {
  const h = document.createElement('span');
  h.className = 'row-head';
  h.textContent = FOLIAGE[f - 1];
  grid.appendChild(h);
  for (let w = 1; w <= TIERS; w++) {
    const s = { f, w };
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `t${speciesTier(s)}${magicOf(s) ? ' is-magic' : ''}`;
    b.title = speciesName(s);
    b.setAttribute('aria-label', speciesName(s));
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      if (pressed) pressed.setAttribute('aria-pressed', 'false');
      pressed = b;
      b.setAttribute('aria-pressed', 'true');
      show(chartOut, `<div class="name">${speciesName(s)}</div>${describe(s)}`
        + `<p><button class="btn-paper" type="button" data-use="crossA">Use as first plant</button> `
        + `<button class="btn-paper" type="button" data-use="crossB">Use as second plant</button> `
        + `<button class="btn-paper" type="button" data-use="target">Find a route to it</button></p>`);
      for (const use of chartOut.querySelectorAll('[data-use]')) {
        use.addEventListener('click', () => {
          const field = $(use.dataset.use);
          field.value = speciesName(s);
          if (use.dataset.use === 'target') { route(true); $('route').scrollIntoView(); }
          else { crossNow(true); $('crossForm').scrollIntoView(); }
          field.focus({ preventScroll: true });
        });
      }
    });
    grid.appendChild(b);
  }
}
