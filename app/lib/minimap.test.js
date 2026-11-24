import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyLineTone,
  computeLineSegments,
  computeMinimapLayout,
  getMinimapPalette,
  yToScrollRatio,
} from './minimap';

test('classifyLineTone detects VS Code semantic categories accurately', () => {
  assert.equal(classifyLineTone('   '), 'empty');
  assert.equal(classifyLineTone('  // comment here'), 'comment');
  assert.equal(classifyLineTone('  <div class="card">'), 'tag');
  assert.equal(classifyLineTone('  const total = 42;'), 'keyword');
  assert.equal(classifyLineTone('  title: "CodeLab"'), 'string');
  assert.equal(classifyLineTone('  renderView(item)'), 'func');
  assert.equal(classifyLineTone('  width: 460px;'), 'number');
  assert.equal(classifyLineTone('  body'), 'text');
});

test('computeLineSegments preserves indentation offsets and token clusters', () => {
  const segs = computeLineSegments('    const x = 10;', 40);
  assert.deepEqual(segs, [
    { start: 4, length: 5 },
    { start: 10, length: 1 },
    { start: 12, length: 1 },
    { start: 14, length: 3 },
  ]);
  assert.deepEqual(computeLineSegments('', 40), []);
});

test('computeMinimapLayout scales long files cleanly to canvas height', () => {
  const shortLayout = computeMinimapLayout({
    totalLines: 20,
    firstVisibleLine: 1,
    lastVisibleLine: 20,
    canvasHeight: 600,
    lineStepPx: 3,
  });
  assert.equal(shortLayout.fitsInViewport, true);
  assert.equal(shortLayout.contentHeight, 60);
  assert.equal(shortLayout.sliderTop, 0);

  const longLayout = computeMinimapLayout({
    totalLines: 1000,
    firstVisibleLine: 500,
    lastVisibleLine: 540,
    canvasHeight: 400,
    lineStepPx: 3,
  });
  assert.equal(longLayout.fitsInViewport, false);
  assert.equal(longLayout.contentHeight, 400);
  assert.ok(longLayout.sliderTop > 180 && longLayout.sliderTop < 220);
  assert.ok(longLayout.sliderHeight >= 18);
});

test('yToScrollRatio clamps between 0 and 1 across top, middle, and bottom', () => {
  assert.equal(yToScrollRatio({ y: 0, contentHeight: 400, sliderHeight: 40 }), 0);
  assert.equal(yToScrollRatio({ y: 400, contentHeight: 400, sliderHeight: 40 }), 1);
  const mid = yToScrollRatio({ y: 200, contentHeight: 400, sliderHeight: 40 });
  assert.ok(mid > 0.4 && mid < 0.6);
});

test('getMinimapPalette supports dark and light themes', () => {
  assert.equal(getMinimapPalette('dark').bg, '#1e1e1e');
  assert.equal(getMinimapPalette('light').bg, '#ffffff');
});
