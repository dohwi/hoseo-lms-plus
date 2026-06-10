(function (global, factory) {
    const exports = factory(global.HoseoLmsPlusCore);
    global.HoseoLmsPlusUiElements = exports;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exports;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
    'use strict';

    function createElement(doc, tagName, options) {
        const element = doc.createElement(tagName);
        const config = options || {};
        if (config.className) element.className = config.className;
        if (config.text !== null && config.text !== undefined) element.textContent = config.text;
        if (config.attrs) {
            Object.keys(config.attrs).forEach(function (name) {
                if (config.attrs[name] !== null && config.attrs[name] !== undefined) element.setAttribute(name, config.attrs[name]);
            });
        }
        return element;
    }

    function createSvgElement(doc, tagName, options) {
        const element = doc.createElementNS('http://www.w3.org/2000/svg', tagName);
        const config = options || {};
        if (config.className) element.setAttribute('class', config.className);
        if (config.text !== null && config.text !== undefined) element.textContent = config.text;
        if (config.attrs) {
            Object.keys(config.attrs).forEach(function (name) {
                if (config.attrs[name] !== null && config.attrs[name] !== undefined) element.setAttribute(name, config.attrs[name]);
            });
        }
        return element;
    }

    function appendSanitizedHtml(target, html, baseUrl) {
        const fragment = core.sanitizeHtmlFragment(target.ownerDocument, html, { baseUrl: baseUrl || core.DEFAULT_BASE_URL });
        target.appendChild(fragment);
    }

    function clearChildren(target) {
        while (target.firstChild) target.removeChild(target.firstChild);
    }

    function createButton(doc, id, text, className, onClick, disabled, ariaLabel, title) {
        const button = createElement(doc, 'button', {
            className: className,
            text: text,
            attrs: { type: 'button', id: id, 'aria-label': ariaLabel || text, title: title }
        });
        button.disabled = Boolean(disabled);
        if (onClick) button.addEventListener('click', onClick);
        return button;
    }

    function createSvgIcon(doc, className, title, paths, viewBox) {
        const svg = createSvgElement(doc, 'svg', {
            className: className,
            attrs: {
                viewBox: viewBox || '0 0 24 24',
                'aria-hidden': 'true',
                focusable: 'false'
            }
        });
        if (title) svg.appendChild(createSvgElement(doc, 'title', { text: title }));
        paths.forEach(function (path) {
            svg.appendChild(createSvgElement(doc, 'path', { attrs: path }));
        });
        return svg;
    }

    function createIconButton(doc, id, className, onClick, disabled, ariaLabel, icon, useTitleTooltip) {
        const button = createButton(doc, id, '', className, onClick, disabled, ariaLabel, useTitleTooltip ? ariaLabel : null);
        button.appendChild(icon);
        return button;
    }

    function createHtmlCell(doc, className, html, baseUrl) {
        const cell = createElement(doc, 'td', { className: className });
        if (!html || html === '-') {
            cell.textContent = '-';
        } else {
            appendSanitizedHtml(cell, html, baseUrl);
        }
        return cell;
    }

    function createCourseCell(doc, activity, rowspan, isFirst) {
        if (!isFirst) return null;
        const cell = createElement(doc, 'td', { className: 'lms-td-course' });
        cell.rowSpan = rowspan;
        const link = createElement(doc, 'a', {
            text: activity.courseName,
            attrs: { href: '/course/view.php?id=' + activity.courseId, target: '_blank', rel: 'noopener noreferrer' }
        });
        cell.appendChild(link);
        return cell;
    }

    return {
        appendSanitizedHtml: appendSanitizedHtml,
        clearChildren: clearChildren,
        createButton: createButton,
        createCourseCell: createCourseCell,
        createElement: createElement,
        createHtmlCell: createHtmlCell,
        createIconButton: createIconButton,
        createSvgElement: createSvgElement,
        createSvgIcon: createSvgIcon
    };
});
