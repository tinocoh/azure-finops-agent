import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { buildEChartsOption } from './chart';

let worldMapLoaded = false;
async function ensureWorldMap(): Promise<boolean> {
  if (worldMapLoaded) return true;
  try {
    const res = await fetch('https://fastly.jsdelivr.net/npm/echarts@4.9.0/map/json/world.json');
    const geo = await res.json();
    echarts.registerMap('world', geo);
    worldMapLoaded = true;
    return true;
  } catch {
    return false;
  }
}

export function ChartView({ payload }: { payload: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const option = buildEChartsOption(payload);
    if (!option) return;

    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    const apply = () => chart.setOption(option as echarts.EChartsOption, true);

    if (option._needsMap) {
      ensureWorldMap().then(apply);
    } else {
      apply();
    }

    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
    };
  }, [payload]);

  return <div ref={ref} style={{ width: 'min(560px, 72vw)', height: 320, marginTop: 8 }} />;
}
