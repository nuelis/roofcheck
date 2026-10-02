// Checklist of items that are commonly missing from carrier roofing estimates.
// Scope of v0.1: asphalt-shingle re-roofs. Each rule returns null (nothing wrong)
// or { why, request, qty }.
//
// severity:
//   'likely' = the line is absent and normally belongs on a shingle re-roof
//   'verify' = depends on climate, local code, policy or what is on the roof;
//              a human must confirm before it goes in a letter
//
// Code references are pointers, NOT legal advice. Local adoption and edition vary,
// so confirm each one before sending.

const TEAR_OFF_NO_HAUL = /no haul|w\/\s*out haul|w\/o haul|without haul/;

const sum = (...a) => {
  const v = a.filter((x) => x != null);
  return v.length ? Number(v.reduce((s, x) => s + x, 0).toFixed(2)) : null;
};
const q = (value, unit, basis) => (value == null ? null : { value, unit, basis });

export function makeCtx(parsed) {
  const texts = parsed.items.map((i) => i.description.toLowerCase());
  // "w/out felt" mentions felt but means NO felt is included
  const stripped = texts.map((t) => t.replace(/w\/\s*out\s*felt|w\/o\s*felt|without\s*felt/g, ''));
  return {
    ...parsed,
    m: parsed.measurements,
    texts,
    has: (re, { exclude } = {}) => texts.some((t) => re.test(t) && !(exclude && exclude.test(t))),
    hasUnderlayment: stripped.some((t) => /felt|underlayment|synthetic/.test(t)),
    shingleScope: texts.some((t) => /shingle|composition|comp\. ?rfg|laminated/.test(t)),
  };
}

const steepBand = (p) =>
  p >= 7 && p < 10 ? '7/12 to 9/12 slope' : p >= 10 && p <= 12 ? '10/12 to 12/12 slope' : p > 12 ? 'greater than 12/12 slope' : null;

export const RULES = [
  {
    id: 'drip-edge',
    title: 'Drip edge at eaves and rakes',
    severity: 'likely',
    codeRef: 'IRC R905.2.8.5 (drip edge on shingle roofs)',
    check: (c) =>
      !c.has(/drip\s*edge/) && {
        why: 'The shingle scope has no drip edge line.',
        request: 'Drip edge - eaves and rakes',
        qty: q(sum(c.m.eavesLF, c.m.rakesLF), 'LF', 'eaves + rakes from the measurements'),
      },
  },
  {
    id: 'starter',
    title: 'Starter course',
    severity: 'likely',
    codeRef: 'Shingle manufacturer installation instructions',
    check: (c) =>
      !c.has(/starter/) && {
        why: 'No starter strip line. Shingles are installed over a starter course at eaves and rakes.',
        request: 'Asphalt starter - universal starter course',
        qty: q(sum(c.m.eavesLF, c.m.rakesLF), 'LF', 'eaves + rakes from the measurements'),
      },
  },
  {
    id: 'ridge-cap',
    title: 'Hip and ridge cap',
    severity: 'likely',
    codeRef: 'Shingle manufacturer installation instructions',
    check: (c) =>
      !c.has(/hip\s*\/\s*ridge|hip\s*(?:&|and)\s*ridge|ridge\s*cap|ridge\s*shingle/) && {
        why: 'No hip/ridge cap line on a shingle roof.',
        request: 'Hip / Ridge cap - standard profile - composition shingles',
        qty: q(sum(c.m.ridgesLF, c.m.hipsLF), 'LF', 'ridges + hips from the measurements'),
      },
  },
  {
    id: 'underlayment',
    title: 'Roof underlayment',
    severity: 'likely',
    codeRef: 'IRC R905.1.1 (underlayment)',
    check: (c) =>
      !c.hasUnderlayment && {
        why: 'No felt or synthetic underlayment, and the shingle line is not the "with felt" version.',
        request: 'Roofing felt - 15 lb. (or synthetic underlayment)',
        qty: q(c.m.areaSQ, 'SQ', 'total roof area'),
      },
  },
  {
    id: 'steep-charge',
    title: 'Steep roof charge',
    severity: 'likely',
    codeRef: null,
    check: (c) => {
      const band = steepBand(c.m.pitch);
      return band && !c.has(/steep/) && {
        why: `Pitch is ${c.m.pitch}/12 but there is no steep roof charge.`,
        request: `Additional charge for steep roof - ${band} (remove and install)`,
        qty: q(c.m.areaSQ, 'SQ', 'total roof area'),
      };
    },
  },
  {
    id: 'high-roof',
    title: 'High roof charge (2+ stories)',
    severity: 'likely',
    codeRef: null,
    check: (c) =>
      c.m.stories >= 2 && !c.has(/high\s*roof|(?:2|two)\s*stor/) && {
        why: `The property is ${c.m.stories} stories but there is no high roof charge.`,
        request: 'Additional charge for high roof (2 stories or greater)',
        qty: q(c.m.areaSQ, 'SQ', 'total roof area'),
      },
  },
  {
    id: 'haul-off',
    title: 'Debris haul-off / dumpster',
    severity: 'likely',
    codeRef: null,
    check: (c) =>
      c.has(/^remove\b/) &&
      !c.has(/haul|dumpster|debris|disposal/, { exclude: TEAR_OFF_NO_HAUL }) && {
        why: 'The estimate removes the old roof but has no haul-off, dumpster or disposal line.',
        request: 'Haul debris - per pickup truck load (or dumpster load)',
        qty: null,
      },
  },
  {
    id: 'ice-water',
    title: 'Ice & water barrier',
    severity: 'verify',
    codeRef: 'IRC R905.1.2 (ice barrier where ice forms along eaves)',
    check: (c) =>
      !c.has(/ice\s*(?:&|and)\s*water|ice\s*barrier|self[- ]adhering/) && {
        why: 'No ice & water barrier. Only relevant where local code or the manufacturer calls for it (cold climates, eaves and valleys).',
        request: 'Ice & water barrier at eaves and valleys',
        qty: null,
      },
  },
  {
    id: 'flashing',
    title: 'Flashing (step, counter, chimney, valley)',
    severity: 'verify',
    codeRef: null,
    check: (c) =>
      !c.has(/flashing|step flash|counter|chimney|apron|valley metal|w-valley|\(w\)/) && {
        why: 'No flashing lines. Check the roof for walls, chimneys and valleys that need new flashing.',
        request: 'Flashing - as needed after on-site inspection',
        qty: null,
      },
  },
  {
    id: 'pipe-jacks',
    title: 'Pipe jacks and roof vents',
    severity: 'verify',
    codeRef: null,
    check: (c) =>
      !c.has(/pipe jack|plumbing (?:stack|vent)|pipe boot|roof vent|box vent|exhaust (?:cap|vent)|turbine|lead flashing/) && {
        why: 'No pipe jack or vent lines. Count the penetrations on the roof.',
        request: 'Pipe jacks / roof vents - count from the roof',
        qty: null,
      },
  },
  {
    id: 'permit',
    title: 'Building permit fee',
    severity: 'verify',
    codeRef: null,
    check: (c) =>
      !c.has(/permit/) && {
        why: 'No permit line. Many jurisdictions require a permit for a re-roof.',
        request: 'Building permit fee (actual cost)',
        qty: null,
      },
  },
  {
    id: 'op',
    title: 'Overhead & profit',
    severity: 'verify',
    codeRef: null,
    check: (c) =>
      c.items.length > 0 && !c.hasOP && {
        why: 'No overhead & profit. Contractors often request 10% + 10% when a job needs a general contractor to coordinate trades. Whether it is owed depends on the policy, the state and the scope.',
        request: 'Overhead and profit (10% + 10%)',
        qty: null,
      },
  },
  {
    id: 'waste',
    title: 'Waste factor looks low',
    severity: 'verify',
    codeRef: null,
    check: (c) => {
      const { wastePct: w, shape } = c.m;
      if (w == null || !shape) return false;
      const floor = shape === 'hip' ? 15 : 10;
      return w < floor && {
        why: `Waste is ${w}% on a ${shape} roof. Roofers commonly use about ${floor}% or more for this roof type.`,
        request: `Adjust the waste factor to ${floor}%`,
        qty: null,
      };
    },
  },
  {
    id: 'ridge-vent-reset',
    title: 'Ridge vent set to detach & reset',
    severity: 'verify',
    codeRef: null,
    check: (c) =>
      c.texts.some((t) => /ridge\s*vent/.test(t) && /detach\s*(?:&|and)\s*reset|\bd\s*&\s*r\b|\breset\b/.test(t)) && {
        why: 'Ridge vent is priced as detach & reset. Existing vents are usually damaged during tear-off and cannot be reused.',
        request: 'Replace ridge vent instead of detach & reset',
        qty: q(c.m.ridgesLF, 'LF', 'ridges from the measurements'),
      },
  },
];
