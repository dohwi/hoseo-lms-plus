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
        const button = elements.createIconButton(
            doc,
            'lms-info-btn',
            'lms-info-btn-icon',
            null,
            false,
            '표기 기준 안내',
            elements.createSvgIcon(doc, 'lms-icon lms-icon-info', null, [
                { d: 'M12 8.5h.01', fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-width': '2.2' },
                { d: 'M11 12h1v4h1', fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2.2' },
                { d: 'M12 21a9 9 0 100-18 9 9 0 000 18z', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }
            ]),
            false
        );
        const bubble = elements.createElement(doc, 'div', {
            className: 'lms-info-tooltip',
            attrs: { role: 'tooltip' }
        });
        const items = [
            { tone: 'success', label: '초록 행', description: '완료한 학습 또는 제출한 항목' },
            { tone: 'urgent', label: '빨간 강조 행', description: '마감까지 7일 이하로 남은 미완료 항목' },
            { tone: 'warning', label: '노란 행', description: '아직 시작 기간이 되지 않은 항목' },
            { tone: 'danger', label: '옅은 붉은 행', description: '시작 기간은 지났지만 마감까지 8일 이상 남은 미완료 항목' },
            { tone: 'neutral', label: '흰색 행', description: '파일, 링크, 참고자료처럼 상태 확인 대상이 아닌 항목' }
        ];
        const detailItems = [
            '동영상: 출석/학습 현황 페이지의 요구시간, 누적시간, 완료 여부를 기준으로 판정',
            '과제/퀴즈: 각 강좌의 과제함, 퀴즈 목록, 상세 페이지의 제출/응시 상태를 기준으로 판정',
            '긴급 여부: 마감일이 오늘부터 7일 이내이고 아직 완료되지 않은 경우 강조',
            '시작 전 여부: 기간의 시작일이 오늘 이후로 잡혀 있으면 노란 행으로 표시',
            '기타 주차: MOOC 등 일반 주차로 분류되지 않는 항목을 별도로 묶어 표시'
        ];

        bubble.appendChild(elements.createElement(doc, 'strong', { className: 'lms-info-tooltip-title', text: '표기 기준' }));
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
            bubble.appendChild(row);
        });
        bubble.appendChild(elements.createElement(doc, 'strong', { className: 'lms-info-tooltip-subtitle', text: '판정 기준 상세' }));
        detailItems.forEach(function (item) {
            bubble.appendChild(elements.createElement(doc, 'div', { className: 'lms-info-tooltip-detail', text: item }));
        });

        wrapper.appendChild(button);
        wrapper.appendChild(bubble);
        return wrapper;
    }

    return {
        createInfoTooltip: createInfoTooltip
    };
});
