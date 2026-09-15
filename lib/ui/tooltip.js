(function (global, factory) {
    const elements = global.HoseoLmsPlusUiElements;
    const exports = factory(global.HoseoLmsPlusCore, elements);
    global.HoseoLmsPlusUiTooltip = exports;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exports;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core, elements) {
    'use strict';

    function createInfoTooltip(doc) {
        const wrapper = elements.createElement(doc, 'div', { className: 'lms-info-tooltip-wrap' });
        let lastFocused = null;
        let button = null;
        let bubble = null;
        let hiddenContent = [];

        function setBackgroundHidden(hidden) {
            const dashboard = wrapper.closest('.lms-dashboard');
            if (!dashboard) return;
            if (hidden) {
                const modalAncestors = new Set();
                let ancestor = bubble;
                while (ancestor && ancestor !== dashboard) {
                    modalAncestors.add(ancestor);
                    ancestor = ancestor.parentElement;
                }
                const hideSiblings = function (parent) {
                    Array.from(parent.children).forEach(function (child) {
                        if (child === bubble) return;
                        if (modalAncestors.has(child)) {
                            hideSiblings(child);
                            return;
                        }
                        const state = {
                            element: child,
                            ariaHidden: child.getAttribute('aria-hidden'),
                            inert: 'inert' in child ? child.inert : null
                        };
                        child.setAttribute('aria-hidden', 'true');
                        if (state.inert !== null) child.inert = true;
                        hiddenContent.push(state);
                    });
                };
                hideSiblings(dashboard);
                return;
            }
            hiddenContent.forEach(function (state) {
                if (state.ariaHidden === null) state.element.removeAttribute('aria-hidden');
                else state.element.setAttribute('aria-hidden', state.ariaHidden);
                if (state.inert !== null) state.element.inert = state.inert;
            });
            hiddenContent = [];
        }

        const handleDocumentKeydown = function (event) {
            if (!bubble.isConnected) {
                doc.removeEventListener('keydown', handleDocumentKeydown);
                return;
            }
            if (bubble.hidden) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                closePopup();
                return;
            }
            if (event.key !== 'Tab') return;
            const focusable = Array.from(bubble.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])'));
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && doc.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && doc.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        const closePopup = function (restoreFocus) {
            if (bubble.hidden) return;
            bubble.hidden = true;
            button.setAttribute('aria-expanded', 'false');
            doc.removeEventListener('keydown', handleDocumentKeydown);
            setBackgroundHidden(false);
            if (restoreFocus !== false && lastFocused && lastFocused.isConnected && typeof lastFocused.focus === 'function') lastFocused.focus();
        };
        const openPopup = function () {
            lastFocused = doc.activeElement;
            bubble.hidden = false;
            button.setAttribute('aria-expanded', 'true');
            setBackgroundHidden(true);
            doc.addEventListener('keydown', handleDocumentKeydown);
            const closeButton = bubble.querySelector('.lms-info-popup-close');
            if (closeButton) closeButton.focus();
        };
        button = elements.createIconButton(
            doc,
            'lms-info-btn',
            'lms-info-btn-icon',
            function () {
                if (bubble.hidden) openPopup();
                else closePopup();
            },
            false,
            '표기 기준 안내',
            elements.createSvgIcon(doc, 'lms-icon lms-icon-info', null, [
                { d: 'M12 8.5h.01', fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-width': '2.2' },
                { d: 'M11 12h1v4h1', fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2.2' },
                { d: 'M12 21a9 9 0 100-18 9 9 0 000 18z', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }
            ]),
            false
        );
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', 'lms-info-popup');
        bubble = elements.createElement(doc, 'div', {
            className: 'lms-info-tooltip',
            attrs: {
                id: 'lms-info-popup',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': 'lms-info-popup-title'
            }
        });
        bubble.hidden = true;
        const panel = elements.createElement(doc, 'div', { className: 'lms-info-popup-panel' });
        const items = [
            { tone: 'success', label: '완료', description: '완료한 학습 또는 제출한 항목' },
            { tone: 'urgent', label: '마감 임박', description: '마감까지 7일 이하로 남은 미완료 항목' },
            { tone: 'warning', label: '시작 전', description: '아직 시작 기간이 되지 않은 항목' },
            { tone: 'danger', label: '미완료', description: '시작 기간은 지났지만 마감까지 8일 이상 남은 미완료 항목' },
            { tone: 'notice', label: '공지사항', description: '작성일 기준 해당 주차에 등록된 강좌 공지사항' },
            { tone: 'neutral', label: '참고 항목', description: '파일, 링크처럼 완료 상태를 판정하지 않는 항목' }
        ];
        const detailItems = [
            '동영상: 출석/학습 현황 페이지의 요구시간, 누적시간, 완료 여부를 기준으로 판정',
            '과제/퀴즈: 각 강좌의 과제함, 퀴즈 목록, 상세 페이지의 제출/응시 상태를 기준으로 판정',
            '공지사항: 게시글 작성일이 포함되는 주차에 표시하며, 어떤 주차에도 포함되지 않으면 기타로 분류',
            '긴급 여부: 마감일이 오늘부터 7일 이내이고 아직 완료되지 않은 경우 강조',
            '시작 전 여부: 기간의 시작일이 오늘 이후이면 노란 행으로 표시',
            '기타 주차: MOOC 등 일반 주차로 분류되지 않는 항목을 별도로 묶어 표시'
        ];

        const popupHeader = elements.createElement(doc, 'div', { className: 'lms-info-popup-header' });
        const popupTitle = elements.createElement(doc, 'div');
        popupTitle.appendChild(elements.createElement(doc, 'strong', {
            className: 'lms-info-tooltip-title',
            text: '표기 기준',
            attrs: { id: 'lms-info-popup-title' }
        }));
        popupTitle.appendChild(elements.createElement(doc, 'p', {
            className: 'lms-info-popup-intro',
            text: '행 색상과 상태 표시는 LMS에서 확인한 출석·제출 정보를 기준으로 합니다.'
        }));
        popupHeader.appendChild(popupTitle);
        popupHeader.appendChild(elements.createButton(doc, null, '×', 'lms-info-popup-close', closePopup, false, '표기 기준 닫기'));
        panel.appendChild(popupHeader);

        const criteriaGrid = elements.createElement(doc, 'div', { className: 'lms-info-criteria-grid' });
        items.forEach(function (item) {
            const row = elements.createElement(doc, 'div', { className: 'lms-info-tooltip-item' });
            row.appendChild(elements.createElement(doc, 'span', {
                className: 'lms-info-tooltip-badge lms-info-tooltip-badge-' + item.tone,
                text: item.label
            }));
            row.appendChild(elements.createElement(doc, 'span', {
                className: 'lms-info-tooltip-desc',
                text: item.description
            }));
            criteriaGrid.appendChild(row);
        });
        panel.appendChild(criteriaGrid);

        const detailsPanel = elements.createElement(doc, 'div', { className: 'lms-info-details-panel' });
        detailsPanel.appendChild(elements.createElement(doc, 'strong', { className: 'lms-info-tooltip-subtitle', text: '판정 기준 상세' }));
        detailItems.forEach(function (item) {
            detailsPanel.appendChild(elements.createElement(doc, 'div', { className: 'lms-info-tooltip-detail', text: item }));
        });
        panel.appendChild(detailsPanel);
        bubble.appendChild(panel);
        bubble.addEventListener('click', function (event) {
            if (event.target === bubble) closePopup();
        });
        wrapper.appendChild(button);
        wrapper.appendChild(bubble);
        wrapper.__lmsDispose = function () {
            closePopup(false);
            doc.removeEventListener('keydown', handleDocumentKeydown);
        };
        return wrapper;
    }

    return {
        createInfoTooltip: createInfoTooltip
    };
});
