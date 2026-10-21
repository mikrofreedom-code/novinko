const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('widget mounts once, reports a slow request and recovers when it loads', () => {
  class Element {
    constructor() { this.children = []; this.events = {}; }
    appendChild(child) { child.parentElement = this; this.children.push(child); }
    prepend(child) { child.parentElement = this; this.children.unshift(child); }
    remove() { this.parentElement.children = this.parentElement.children.filter(c => c !== this); }
    querySelector() { return this.children.find(c => c.className?.includes('crypto-widget-error')); }
    addEventListener(event, callback) { this.events[event] = callback; }
  }
  const host = new Element();
  const config = { dataset: { widgetSrc: 'https://s3.tradingview.com/test.js', widgetFallback: 'https://www.tradingview.com/symbols/EURUSD/' }, textContent: '{"symbol":"FX:EURUSD"}', parentElement: host };
  const timers = new Map(); let timerId = 0;
  const context = { window: { NovinkoConsent: { allows: () => true }, addEventListener() {} }, document: { createElement: () => new Element() },
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id) };
  vm.runInNewContext(fs.readFileSync(require.resolve('../assets/market-widgets'), 'utf8'), context);
  const container = { querySelectorAll: () => [config] };
  context.window.NovinkoWidgets.mount(container);
  context.window.NovinkoWidgets.mount(container);
  assert.equal(host.children.length, 1);
  const script = host.children[0];
  assert.equal(script.src, config.dataset.widgetSrc);
  assert.equal(script.textContent, config.textContent);
  Array.from(timers.values())[0]();
  assert.match(host.querySelector().textContent, /trvá dlhšie/);
  assert.equal(host.querySelector().children[0].href, config.dataset.widgetFallback);
  script.events.load();
  assert.equal(host.querySelector(), undefined);
  assert.equal(timers.size, 0);
  script.events.error();
  assert.match(host.querySelector().textContent, /nepodarilo načítať/);
  assert.equal(host.querySelector().children[0].rel, 'noopener noreferrer');
});
