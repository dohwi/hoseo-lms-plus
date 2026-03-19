const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const core = require('../lib/core.js');

global.HoseoLmsPlusCore = core;
global.HoseoLmsPlusUi = {
    buildHostMount: function (doc) {
        const mount = doc.createElement('section');
        mount.id = core.SELECTORS.dashboardMountId;
        doc.body.appendChild(mount);
        return { mount: mount, host: doc.body };
    },
    renderLoading: function (doc, mount) {
        mount.setAttribute('data-loading', 'true');
    },
    renderMessage: function (doc, mount, title) {
        mount.setAttribute('data-message', title);
    },
    renderDashboard: function (doc, mount, state) {
        mount.setAttribute('data-week', String(state.week));
        mount.setAttribute('data-courses', String(state.courseNames.length));
    },
    restoreHost: function () {},
    updateProgress: function () {}
};
global.HoseoLmsPlusDataService = {
    create: function () {
        return {
            fetchAllCourseData: async function () {
                return {
                    allItems: [{ weekNum: 1, periodStr: '[03.01~03.07]' }],
                    allAssigns: [],
                    allActivities: [{ courseId: '101', courseName: '테스트 강의', weekNum: 1, periodStr: '[03.01~03.07]', type: '동영상', href: '/video', nameHtml: '<span>OT 영상</span>', optionsHtml: '-', statusText: '완료', isCompleted: true, isNeutral: false }],
                    allCourseNames: [{ courseName: '테스트 강의', courseId: '101' }],
                    warnings: [],
                    sessionExpired: false
                };
            }
        };
    }
};

const dashboardController = require('../lib/dashboard-controller.js');

test('dashboard controller renders dashboard from fetched data', async function () {
    const dom = new JSDOM('<!doctype html><html><body><div class="lists"><div class="course" data-id="101"></div></div><div data-userid="u1"></div></body></html>', { url: 'https://learn.hoseo.ac.kr/' });
    global.window = dom.window;
    global.document = dom.window.document;

    let resets = 0;
    const controller = dashboardController.create({
        document: dom.window.document,
        extensionStorage: null,
        runtime: {
            getRequestQueue: function () {
                return {
                    enqueue: function (task) {
                        return task({});
                    }
                };
            },
            resetRequestQueue: function () {
                resets += 1;
            }
        },
        storage: {
            getItem: function () { return null; },
            setItem: function () {},
            removeItem: function () {},
            key: function () { return null; },
            length: 0
        }
    });

    controller.replacePageContent(false);
    await new Promise(function (resolve) { setTimeout(resolve, 0); });

    const mount = dom.window.document.getElementById(core.SELECTORS.dashboardMountId);
    assert.ok(mount);
    assert.equal(mount.getAttribute('data-week'), '1');
    assert.equal(mount.getAttribute('data-courses'), '1');
    assert.equal(resets > 0, true);

    controller.cleanup();
});
