import nodeHtmlToImage from 'node-html-to-image';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import config from '../config.js';
import { formatCompact, formatDate } from '../utils/formatters.js';
import { parseGrowth, parseChartData, parseAdvertisers } from '../utils/parsers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logoPath = resolve(__dirname, '../../android-chrome-512x512.png');
const logoBase64 = 'data:image/png;base64,' + readFileSync(logoPath).toString('base64');

/**
 * Генерация картинки статистики канала
 * @param {Object} data
 * @returns {Promise<Buffer>}
 */
export async function generateStatsImage(data) {
    const chartData = parseChartData(data.chartData);
    const hasChartData = chartData.categories.length > 0;
    const advertisers = parseAdvertisers(data.advertisers);
    const advertisersTotal = data.advertisersTotal || 0;
    const advertised = parseAdvertisers(data.advertised);
    const advertisedTotal = data.advertisedTotal || 0;

    const subs = data.subscribers ?? null;
    const dyn = {
        today: data.dynamics?.today !== undefined ? parseGrowth(data.dynamics.today) : null,
        week: data.dynamics?.week !== undefined ? parseGrowth(data.dynamics.week) : null,
        month: data.dynamics?.month !== undefined ? parseGrowth(data.dynamics.month) : null
    };
    const er = data.er ?? null;
    const isSuspicious = data.isSuspicious || false;
    const channelName = data.channelName || 'Название канала';
    const channelAvatar = data.channelAvatar || null;
    const categories = data.categories || [];
    const avgViews = data.avgViews ?? null;
    const views24h = data.views24h ?? null;
    const views48h = data.views48h ?? null;

    const html = buildHtml({
        logoBase64,
        channelName,
        channelAvatar,
        categories,
        isSuspicious,
        subs,
        dyn,
        avgViews,
        views24h,
        views48h,
        er,
        advertisers,
        advertisersTotal,
        advertised,
        advertisedTotal,
        chartData,
        hasChartData,
        updatedAt: data.updatedAt
    });

    const image = await nodeHtmlToImage({
        html,
        quality: 100,
        type: 'png',
        puppeteerArgs: {
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        },
        waitUntil: 'networkidle0',
        timeout: 30000
    });

    return image;
}

function buildHtml(params) {
    const {
        logoBase64,
        channelName,
        channelAvatar,
        categories,
        isSuspicious,
        subs,
        dyn,
        avgViews,
        views24h,
        views48h,
        er,
        advertisers,
        advertisersTotal,
        advertised,
        advertisedTotal,
        chartData,
        hasChartData,
        updatedAt
    } = params;

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            * { font-family: 'Inter', sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
            body { width: ${config.image.width}px; background: #f5f5f5; padding: 28px; }
            .section { background: #fff; border-radius: 20px; padding: 36px; margin-bottom: 20px; }
            .section-title { font-size: 26px; font-weight: 600; color: #333; margin-bottom: 28px; padding-bottom: 16px; border-bottom: 4px solid #7c3aed; display: inline-block; }
            .positive { color: #10b981; }
            .negative { color: #ef4444; }
        </style>
    </head>
    <body>
        <!-- Header -->
        <div class="section" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 24px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <img src="${logoBase64}" style="width: 40px; height: 40px; border-radius: 10px; object-fit: cover;" />
                <div>
                    <div style="font-size: 30px; font-weight: 700; color: #1a1a1a;">MAXFRAME.RU</div>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 24px; font-weight: 600; color: #333;">${formatDate(updatedAt)}</div>
            </div>
        </div>

        <!-- Channel Info -->
        <div class="section" style="padding: 36px;">
            <div style="display: flex; gap: 32px; align-items: center;">
                ${channelAvatar
                    ? `<img src="${channelAvatar}" style="width: 130px; height: 130px; border-radius: 20px; object-fit: cover;" />`
                    : `<div style="width: 130px; height: 130px; background: #7c3aed; border-radius: 20px;"></div>`
                }
                <div style="flex: 1;">
                    <div style="font-size: 34px; font-weight: 600; color: #1a1a1a; margin-bottom: 14px;">${channelName.length > 30 ? channelName.slice(0, 30) + '...' : channelName}</div>
                    <div style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap;">
                        ${categories.slice(0, 2).map(cat => `<span style="font-size: 18px; padding: 10px 20px; background: #f0f0f0; border-radius: 20px; color: #666;">${cat}</span>`).join('')}
                        <span style="font-size: 18px; padding: 10px 20px; background: ${isSuspicious ? '#fef2f2' : '#f0fdf4'}; border-radius: 20px; color: ${isSuspicious ? '#ef4444' : '#10b981'}; font-weight: 600;">Накрутка / Фрод: ${isSuspicious ? 'Обнаружено' : 'Не обнаружено'}</span>
                    </div>
                </div>
                <div style="text-align: right; padding-left: 32px; border-left: 3px solid #eee;">
                    <div style="font-size: 18px; color: #999; margin-bottom: 8px;">Подписчиков</div>
                    <div style="font-size: 86px; font-weight: 700; color: #7c3aed; line-height: 1; white-space: nowrap;">${formatCompact(subs)}</div>
                </div>
            </div>
        </div>

        <!-- Stats Row -->
        <div style="display: flex; gap: 20px; margin-bottom: 20px;">
            <!-- Left Column: Stats + Metrics -->
            <div style="flex: 7; display: flex; flex-direction: column; gap: 20px; min-width: 0;">
                <!-- Subscribers Stats -->
                <div>
                    <div class="section-title">Кол-во подписчиков</div>
                    <div class="section" style="margin-bottom: 0; padding: 28px;">
                        <div style="display: flex; gap: 20px;">
                            ${buildStatCard('Сегодня', dyn.today)}
                            ${buildStatCard('Неделя', dyn.week)}
                            ${buildStatCard('Месяц', dyn.month)}
                        </div>
                    </div>
                </div>
                <!-- Metrics -->
                <div>
                    <div class="section-title">Охваты</div>
                    <div class="section" style="margin-bottom: 0; padding: 28px;">
                        <div style="display: flex; gap: 20px;">
                            ${buildMetricCard('Охват 24ч', views24h, '#3b82f6')}
                            ${buildMetricCard('Охват 48ч', views48h, '#3b82f6')}
                            ${buildMetricCard('ER', er, '#7c3aed', true)}
                        </div>
                    </div>
                </div>
            </div>
            <!-- Right Column: Advertisers -->
            <div class="section" style="flex: 2; min-width: 0; padding: 28px; margin-bottom: 0; display: flex; flex-direction: column;">
                <div class="section-title" style="white-space: nowrap;">Кто рекламировал</div>
                ${buildAdvertisersList(advertisers, advertisersTotal)}
            </div>
            <div class="section" style="flex: 2; min-width: 0; padding: 28px; margin-bottom: 0; display: flex; flex-direction: column;">
                <div class="section-title" style="white-space: nowrap;">Кого рекламировал</div>
                ${buildAdvertisersList(advertised, advertisedTotal)}
            </div>
        </div>

        <!-- Chart -->
        ${hasChartData ? buildChart(chartData) : ''}
    </body>
    </html>
    `;
}

function buildStatCard(label, value) {
    const isPositive = value !== null && value >= 0;
    const displayValue = value !== null ? (value >= 0 ? '+' : '−') + formatCompact(Math.abs(value)) : '—';
    return `
        <div style="flex: 1; background: #f9f9f9; border-radius: 16px; padding: 24px; text-align: center; min-width: 0;">
            <div style="font-size: 62px; font-weight: 700; color: ${value === null ? '#999' : (isPositive ? '#10b981' : '#ef4444')}; white-space: nowrap; overflow: hidden;">${displayValue}</div>
            <div style="font-size: 22px; color: #333; margin-top: 10px; font-weight: 600;">${label}</div>
        </div>
    `;
}

function buildMetricCard(label, value, color = '#333', isPercent = false) {
    const displayValue = value !== null ? formatCompact(value) + (isPercent ? '%' : '') : '—';
    return `
        <div style="flex: 1; background: #f9f9f9; border-radius: 16px; padding: 24px; text-align: center; min-width: 0;">
            <div style="font-size: 72px; font-weight: 700; color: ${value !== null ? color : '#999'}; white-space: nowrap; overflow: hidden;">${displayValue}</div>
            <div style="font-size: 22px; color: #333; margin-top: 10px; font-weight: 600;">${label}</div>
        </div>
    `;
}

function buildAdvertisersList(items, total = 0) {
    if (!items || items.length === 0) {
        return `<div style="color: #999; font-size: 18px; padding: 30px 0; text-align: center;">Нет данных</div>`;
    }
    const shown = Math.min(3, items.length);
    const totalCount = total || items.length;
    const list = items.slice(0, 3).map(row => `
        <div style="display: flex; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid #f0f0f0;">
            ${row.avatar
                ? `<img src="${row.avatar}" style="width: 56px; height: 56px; border-radius: 12px; object-fit: cover;" />`
                : `<div style="width: 56px; height: 56px; border-radius: 12px; background: #e0e0e0;"></div>`}
            <div style="flex: 1; min-width: 0;">
                <div style="font-size: 18px; color: #333; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${row.name}</div>
                <div style="font-size: 20px; color: #999; white-space: nowrap;">${formatCompact(row.subs)} подписчиков</div>
            </div>
        </div>
    `).join('');
    const footer = `<div style="margin-top: auto; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
        <div style="color: #666; font-size: 26px; font-weight: 500;">Показано</div>
        <div style="color: #666; font-size: 26px; font-weight: 500;">${shown} из ${totalCount}</div>
        <div style="font-size: 22px; font-weight: 500;"><span style="color: #666; font-size: 26px; font-weight: 500">подробнее на</span> <span style="color: #666; font-size: 26px; font-weight: 500;">maxframe.ru</span></div>
    </div>`;
    return list + footer;
}

function buildChart(chartData) {
    return `
        <div class="section" style="padding: 36px; margin-top: 20px;">
            <div class="section-title" style="font-size: 26px;">График</div>
            <div id="chart"></div>
        </div>

        <script>
            var options = {
                series: [{
                    name: 'Подписчики',
                    data: ${JSON.stringify(chartData.subscribers)}
                }, {
                    name: 'Охваты 24ч',
                    data: ${JSON.stringify(chartData.views24h)}
                }, {
                    name: 'Охваты 48ч',
                    data: ${JSON.stringify(chartData.views48h)}
                }],
                chart: {
                    height: 380,
                    type: 'line',
                    background: 'transparent',
                    toolbar: { show: false },
                    animations: { enabled: false },
                    fontFamily: 'Inter, sans-serif'
                },
                colors: ['#7c3aed', '#10b981', '#3b82f6'],
                stroke: { width: [6, 5, 5], curve: 'smooth' },
                markers: { size: 8, strokeWidth: 0 },
                dataLabels: { enabled: false },
                xaxis: {
                    categories: ${JSON.stringify(chartData.categories)},
                    labels: { style: { colors: '#666', fontSize: '18px' } },
                    axisBorder: { show: false },
                    axisTicks: { show: false }
                },
                yaxis: {
                    labels: { style: { colors: '#666', fontSize: '18px' }, formatter: v => Math.round(v) }
                },
                grid: { borderColor: '#eee', strokeDashArray: 0 },
                legend: {
                    position: 'top',
                    horizontalAlign: 'center',
                    fontSize: '28px',
                    labels: { colors: '#333' },
                    markers: { width: 20, height: 20, radius: 20 },
                    itemMargin: { horizontal: 32 }
                },
                tooltip: { enabled: false }
            };
            new ApexCharts(document.querySelector("#chart"), options).render();
        </script>
    `;
}
