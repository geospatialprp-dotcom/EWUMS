"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeBoqUnit = normalizeBoqUnit;
exports.looksLikeUnit = looksLikeUnit;
exports.resolveUnitColumn = resolveUnitColumn;
exports.extractBoqUnit = extractBoqUnit;
exports.nonAmountColumnIndices = nonAmountColumnIndices;
exports.isUnitHeaderKey = isUnitHeaderKey;
const KNOWN_UNIT_PATTERN = /^(nos?|no\.?s\.?|cum|c\.?u\.?m\.?|rmt|r\.?m\.?t\.?|rm|qtl|quintal)$/i;
function normalizeBoqUnit(raw) {
    const cleaned = raw.trim();
    if (!cleaned)
        return '';
    const key = cleaned.toLowerCase().replace(/\./g, '').replace(/\s+/g, '');
    const aliases = {
        nos: 'Nos',
        no: 'Nos',
        cum: 'cum',
        cumt: 'cum',
        rmt: 'Rmt',
        rm: 'Rmt',
        qtl: 'Qtl',
        quintal: 'Qtl',
    };
    return aliases[key] ?? cleaned;
}
function looksLikeUnit(value) {
    const v = String(value ?? '').trim();
    if (!v || v.length > 20)
        return false;
    if (/^\d+([.,]\d+)?$/.test(v))
        return false;
    return KNOWN_UNIT_PATTERN.test(v) || /^[a-zA-Z]{2,5}$/.test(v);
}
/** Resolve Unit column index — by header or by position between Qty and Rate. */
function resolveUnitColumn(map, cells) {
    if (map.unit !== undefined)
        return map.unit;
    if (map.qty !== undefined) {
        const afterQty = map.qty + 1;
        if (map.rate !== afterQty && map.amount !== afterQty && map.total_amount !== afterQty
            && looksLikeUnit(cells[afterQty])) {
            return afterQty;
        }
    }
    if (map.qty !== undefined && map.rate !== undefined && map.rate > map.qty + 1) {
        for (let i = map.qty + 1; i < map.rate; i += 1) {
            if (looksLikeUnit(cells[i]))
                return i;
        }
    }
    if (map.qty === 2 && looksLikeUnit(cells[3]))
        return 3;
    return undefined;
}
function extractBoqUnit(cells, map) {
    const idx = resolveUnitColumn(map, cells);
    if (idx !== undefined) {
        const unit = normalizeBoqUnit(String(cells[idx] ?? ''));
        if (unit)
            return unit;
    }
    return '';
}
/** Column indices that must never be treated as amount/qty/rate in numeric scans. */
function nonAmountColumnIndices(map) {
    const skip = new Set();
    for (const key of ['serial', 'description', 'sor_code', 'unit', 'qty', 'rate']) {
        if (map[key] !== undefined)
            skip.add(map[key]);
    }
    return skip;
}
function isUnitHeaderKey(key, raw) {
    return key === 'unit' || key === 'units' || key === 'uom' || key === 'um'
        || (key.includes('unit') && !key.includes('amount') && !key.includes('community'));
}
