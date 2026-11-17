// The eight stages of a week (BUILD_SPEC §2) and which deliverables need them.

export const DELIVERABLES = [
  { key: 'pdf', label: 'Interactive PDF' },
  { key: 'png', label: 'Flyer PNGs (2x)' },
  { key: 'mobile', label: 'Mobile HTML' },
  { key: 'carousel', label: 'Instagram carousel' },
  { key: 'caption', label: 'Social caption' },
  { key: 'slides169', label: '16:9 slides' },
  { key: 'video', label: 'Slideshow video' },
];
export const DELIVERABLE_KEYS = DELIVERABLES.map((d) => d.key);

// needs: the stage runs if any of these deliverables is ticked (null = always runs).
export const STAGES = [
  { key: 'intake', label: 'Intake', short: 'Sheet inventory and questions', needs: null },
  { key: 'images', label: 'Images', short: 'Photos matched and cut out', needs: null },
  { key: 'cards', label: 'Cards', short: 'Card list and sections', needs: null },
  { key: 'flyer', label: 'Flyer', short: 'Pages in the week\'s look', needs: ['pdf', 'png', 'mobile'] },
  { key: 'exports', label: 'Exports', short: 'PDF, 2x PNGs, mobile page', needs: ['pdf', 'png', 'mobile'] },
  { key: 'social', label: 'Social', short: 'Carousel and caption', needs: ['carousel', 'caption'] },
  { key: 'video', label: 'Video', short: '16:9 slides and MP4', needs: ['slides169', 'video'] },
  { key: 'delivery', label: 'Delivery', short: 'Finals to Claude outputs', needs: null },
];
export const STAGE_KEYS = STAGES.map((s) => s.key);
export const stageIndex = (k) => STAGE_KEYS.indexOf(k);
export const stageDef = (k) => STAGES.find((s) => s.key === k);

/** Stages that use the card list: a card/price change in or after `cards` means these rebuild. */
export const CARD_DEPENDENT = ['flyer', 'exports', 'social', 'video', 'delivery'];

export function isNeeded(stageKey, deliverables) {
  const s = stageDef(stageKey);
  return !s.needs || s.needs.some((d) => deliverables.includes(d));
}

export const STATUSES = ['pending', 'running', 'awaiting_review', 'editing', 'approved', 'skipped', 'failed'];
