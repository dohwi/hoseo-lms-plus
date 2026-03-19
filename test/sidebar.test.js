const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const core = require('../lib/core.js');
global.HoseoLmsPlusCore = core;
const sidebar = require('../lib/sidebar.js');

test('sidebar injects dashboard tab and opens dashboard on click', function () {
    const dom = new JSDOM('<!doctype html><html><body><div id="mCSB_1_container"><ul></ul></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.MutationObserver = dom.window.MutationObserver;

    let opened = 0;
    const app = sidebar.create({
        document: dom.window.document,
        onOpenDashboard: function () {
            opened += 1;
        }
    });

    app.start();
    const tab = dom.window.document.getElementById('lms-calendar-tab');
    assert.ok(tab);

    tab.querySelector('a').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(opened, 1);

    app.cleanup();
});
