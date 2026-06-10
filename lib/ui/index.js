(function (global, factory) {
    const combined = factory(
        global.HoseoLmsPlusUiElements,
        global.HoseoLmsPlusUiDates,
        global.HoseoLmsPlusUiTooltip,
        global.HoseoLmsPlusUiRender
    );
    global.HoseoLmsPlusUi = combined;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = combined;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (elements, dates, tooltip, render) {
    'use strict';

    return {
        appendSanitizedHtml: elements.appendSanitizedHtml,
        buildHostMount: render.buildHostMount,
        clearChildren: elements.clearChildren,
        createButton: elements.createButton,
        createCourseCell: elements.createCourseCell,
        createElement: elements.createElement,
        createHtmlCell: elements.createHtmlCell,
        createIconButton: elements.createIconButton,
        createSvgElement: elements.createSvgElement,
        createSvgIcon: elements.createSvgIcon,
        renderDashboard: render.renderDashboard,
        renderLoading: render.renderLoading,
        renderMessage: render.renderMessage,
        restoreHost: render.restoreHost,
        updateProgress: render.updateProgress
    };
});
