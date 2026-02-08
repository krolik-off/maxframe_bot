/**
 * Форматирование чисел с разделителями пробелами
 * @param {number|null|undefined} num
 * @returns {string}
 */
export function formatNum(num) {
    if (num === undefined || num === null) return '—';
    return Math.abs(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Компактное форматирование чисел (1K, 1.2M и т.д.)
 * @param {number|null|undefined} num
 * @returns {string}
 */
export function formatCompact(num) {
    if (num === undefined || num === null) return '—';
    const absNum = Math.abs(num);
    if (absNum >= 1000000) {
        return (absNum / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (absNum >= 1000) {
        return (absNum / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return absNum.toString();
}

/**
 * Форматирование дельты (с плюсом/минусом)
 * @param {number|null|undefined} num
 * @returns {string}
 */
export function formatDelta(num) {
    if (num === undefined || num === null) return '—';
    if (num > 0) return '+' + formatNum(num);
    if (num < 0) return '−' + formatNum(Math.abs(num));
    return '0';
}

/**
 * Форматирование даты
 * @param {Date} [date]
 * @returns {string}
 */
export function formatDate(date) {
    const d = date || new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}
