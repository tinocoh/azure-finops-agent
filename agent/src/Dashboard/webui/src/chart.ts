// Converts the chart payload emitted by the backend (RenderChart / RenderAdvancedChart,
// surfaced as SSE `{ "type":"chart", "options": <json> }`) into an Apache ECharts option.
// Ported from the backend's reference frontend so the visuals match what the agent intends.

export type EChartsOption = Record<string, unknown> & { _needsMap?: boolean };

// Official Azure brand palette for data viz.
const COLORS = [
  '#0078D4', '#50E6FF', '#008575', '#D83B01', '#8661C5', '#0063B1', '#00B7C3',
  '#E3008C', '#FFB900', '#107C10', '#B4009E', '#002050', '#4F6BED', '#C239B3', '#767676',
];

const mapSeries = (opts: any): boolean =>
  Array.isArray(opts?.series)
    ? opts.series.some((s: any) => s?.coordinateSystem === 'geo' || s?.type === 'map')
    : opts?.series?.coordinateSystem === 'geo' || opts?.series?.type === 'map' || !!opts?.geo;

export function buildEChartsOption(raw: string | object): EChartsOption | null {
  let parsed: any;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }

  // Raw ECharts options (RenderAdvancedChart — world maps, heatmaps, gauges, etc.)
  if (parsed?.raw === true && parsed.options) {
    try {
      const opts = typeof parsed.options === 'string' ? JSON.parse(parsed.options) : parsed.options;
      opts._needsMap = mapSeries(opts);
      return opts as EChartsOption;
    } catch {
      return null;
    }
  }

  let data: any[];
  try {
    data = typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed.data;
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;

  let type = String(parsed.type || 'bar').toLowerCase();
  const isHorizontal = type === 'horizontal_bar';
  if (isHorizontal) type = 'bar';
  const title = parsed.title || '';
  const seriesName = parsed.seriesName || '';
  const xName = parsed.xAxisName || '';
  const yName = parsed.yAxisName || '';

  const titleBlock = {
    text: title,
    left: 'center',
    top: 0,
    textStyle: { fontSize: 14, color: '#1f2328', fontWeight: 600 },
    subtextStyle: { fontSize: 11, color: '#656d76' },
  };

  if (type === 'pie' || type === 'funnel') {
    const pieData = data.map((d) => (Array.isArray(d) ? { name: String(d[0]), value: d[1] } : d));
    const total = pieData.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    return {
      title: { ...titleBlock, subtext: type === 'pie' ? `Total ${total.toLocaleString()}` : undefined },
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 6, left: 'center', type: 'scroll', textStyle: { color: '#656d76', fontSize: 11 } },
      color: COLORS,
      series: [
        {
          name: seriesName,
          type,
          radius: type === 'pie' ? '62%' : undefined,
          center: ['50%', '54%'],
          selectedMode: type === 'pie' ? 'single' : undefined,
          data: pieData,
          label: { show: true, formatter: '{b}', color: '#1f2328', fontSize: 11 },
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } },
        },
      ],
    };
  }

  const categories = data.map((d) => (Array.isArray(d) ? String(d[0]) : d.name));
  const catAxis = (name: string) => ({
    type: 'category' as const,
    data: categories,
    name,
    nameLocation: 'middle',
    nameGap: 28,
    axisLabel: { fontSize: 11, color: '#1f2328', interval: 0, rotate: categories.length > 6 && !isHorizontal ? 30 : 0 },
  });
  const valAxis = (name: string) => ({
    type: 'value' as const,
    name,
    axisLabel: { fontSize: 11, color: '#1f2328' },
    splitLine: { lineStyle: { color: '#eee' } },
  });

  // Multi-series? objects with keys beyond name/value.
  const first = data[0];
  const seriesKeys =
    first && typeof first === 'object' && !Array.isArray(first)
      ? Object.keys(first).filter((k) => k !== 'name' && k !== 'value')
      : [];
  const isMulti = seriesKeys.length > 0 && !('value' in (first as object));

  const mkSeries = (key: string, idx: number) => ({
    name: isMulti ? key : seriesName,
    type,
    data: data.map((d) => (Array.isArray(d) ? d[1] : isMulti ? d[key] : d.value)),
    itemStyle: { color: COLORS[idx % COLORS.length] },
    smooth: type === 'line',
    barMaxWidth: 48,
  });
  const series = (isMulti ? seriesKeys : ['__single__']).map((k, i) => mkSeries(k, i));

  return {
    title: titleBlock,
    color: COLORS,
    tooltip: { trigger: type === 'scatter' ? 'item' : 'axis' },
    legend: isMulti ? { bottom: 4, textStyle: { color: '#656d76', fontSize: 11 } } : undefined,
    grid: { left: isHorizontal ? 110 : 56, right: 24, bottom: isMulti ? 40 : 48, top: 44, containLabel: true },
    xAxis: isHorizontal ? valAxis(xName) : catAxis(xName),
    yAxis: isHorizontal ? catAxis(yName) : valAxis(yName),
    series,
  };
}
