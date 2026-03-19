const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const core = require('../lib/core.js');

global.HoseoLmsPlusCore = core;
const ui = require('../lib/ui.js');

test('buildHostMount preserves host layout and restoreHost restores original content', function () {
    const dom = new JSDOM('<!doctype html><html><body><main id="page-main"><div class="original">원본 내용</div></main></body></html>');
    const doc = dom.window.document;
    const host = doc.querySelector('main');

    const result = ui.buildHostMount(doc);

    assert.equal(result.host, host);
    assert.equal(host.querySelector('.original'), null);
    assert.equal(host.firstElementChild.id, core.SELECTORS.dashboardMountId);

    ui.restoreHost(host, result.mount);

    assert.equal(host.querySelector('.original').textContent, '원본 내용');
    assert.equal(doc.getElementById(core.SELECTORS.dashboardMountId), null);
});
