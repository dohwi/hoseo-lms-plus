(function (global, factory) {
    const exports = factory(global.HoseoLmsPlusCore);
    global.HoseoLmsPlusUiDates = exports;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exports;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (_core) {
    'use strict';

    function getActivityDateRange(activity) {
        const text = activity.optionsHtml && activity.optionsHtml !== '-' ? activity.optionsHtml : '';
        const periodStr = activity.periodStr || '';
        let startYear, startMonth, startDay;
        let endYear, endMonth, endDay;

        const koreanFullMatch = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g);
        if (koreanFullMatch && koreanFullMatch.length > 0) {
            const firstDate = koreanFullMatch[0].match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
            const lastDate = koreanFullMatch[koreanFullMatch.length - 1].match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
            if (firstDate) {
                startYear = parseInt(firstDate[1], 10);
                startMonth = parseInt(firstDate[2], 10);
                startDay = parseInt(firstDate[3], 10);
            }
            if (lastDate) {
                endYear = parseInt(lastDate[1], 10);
                endMonth = parseInt(lastDate[2], 10);
                endDay = parseInt(lastDate[3], 10);
            }
        }

        if (!endYear) {
            const dashDateMatch = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/g);
            if (dashDateMatch && dashDateMatch.length > 0) {
                const firstDash = dashDateMatch[0].match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
                const lastDash = dashDateMatch[dashDateMatch.length - 1].match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
                if (firstDash) {
                    startYear = parseInt(firstDash[1], 10);
                    startMonth = parseInt(firstDash[2], 10);
                    startDay = parseInt(firstDash[3], 10);
                }
                if (lastDash) {
                    endYear = parseInt(lastDash[1], 10);
                    endMonth = parseInt(lastDash[2], 10);
                    endDay = parseInt(lastDash[3], 10);
                }
            }
        }

        if (!endYear) {
            const dotDateMatches = text.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/g);
            if (dotDateMatches && dotDateMatches.length > 0) {
                const firstDot = dotDateMatches[0].match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
                const lastDot = dotDateMatches[dotDateMatches.length - 1].match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
                if (firstDot) {
                    startYear = parseInt(firstDot[1], 10);
                    startMonth = parseInt(firstDot[2], 10);
                    startDay = parseInt(firstDot[3], 10);
                }
                if (lastDot) {
                    endYear = parseInt(lastDot[1], 10);
                    endMonth = parseInt(lastDot[2], 10);
                    endDay = parseInt(lastDot[3], 10);
                }
            }
        }

        const now = new Date();
        if (!endYear && periodStr) {
            const periodMatch = periodStr.match(/~\s*(\d{1,2})\.(\d{1,2})/);
            if (periodMatch) {
                endYear = now.getFullYear();
                endMonth = parseInt(periodMatch[1], 10);
                endDay = parseInt(periodMatch[2], 10);
                if (endMonth < now.getMonth() + 1 - 6) {
                    endYear = now.getFullYear() + 1;
                }
            }
        }

        if (!startYear && endYear) {
            startYear = endYear;
            startMonth = endMonth;
            startDay = endDay;
        }

        if (!endYear || !endMonth || !endDay) return null;

        return {
            start: startYear && startMonth && startDay ? new Date(startYear, startMonth - 1, startDay, 0, 0, 0) : null,
            end: new Date(endYear, endMonth - 1, endDay, 0, 0, 0)
        };
    }

    function getDaysUntilDeadline(activity) {
        const range = getActivityDateRange(activity);
        if (!range || !range.end) return null;

        const now = new Date();
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const diffTime = range.end - todayMidnight;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    }

    return {
        getActivityDateRange: getActivityDateRange,
        getDaysUntilDeadline: getDaysUntilDeadline
    };
});
