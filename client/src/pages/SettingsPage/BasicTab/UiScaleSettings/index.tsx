import React from 'react';
import { Select } from 'antd';
import { useUiStore } from '@/store/uiStore';
import { autoScale, UI_SCALE_OPTIONS, UiScale } from '@/utils/uiScale';
import styles from '../BasicTab.module.scss';

const percent = (v: number) => `${Math.round(v * 100)}%`;

/** Масштаб интерфейса на этом компьютере — вместо уменьшения масштаба в браузере */
export const UiScaleSettings: React.FC = () => {
  const uiScale = useUiStore(s => s.uiScale);
  const setUiScale = useUiStore(s => s.setUiScale);
  const auto = autoScale(window.screen.width);

  return (
    <div className={styles.row}>
      <div>
        <div className={styles.label}>Масштаб интерфейса</div>
        <div className={styles.hint}>
          На этом компьютере. «Авто» подстраивается под ширину монитора: на 2K и больше — 100%
        </div>
      </div>
      <Select<UiScale>
        value={uiScale}
        onChange={setUiScale}
        className={styles.scaleSelect}
        options={[
          { value: 'auto', label: `Авто (${percent(auto)})` },
          ...UI_SCALE_OPTIONS.map(v => ({ value: v, label: percent(v) })),
        ]}
      />
    </div>
  );
};
