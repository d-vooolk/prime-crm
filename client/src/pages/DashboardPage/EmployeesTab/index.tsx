import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, Row, Col, Skeleton } from 'antd';
import { Serviceman } from '@/types';
import { useEmployeeSalaries, useMissedWiki } from '../hooks';
import { useChartColors } from '../useChartColors';
import { EmployeeCard } from '../EmployeeCard';
import { EmployeeModal } from '../EmployeeModal';
import { LeadersPodium } from '../LeadersPodium';
import { MissedWikiCard } from '../MissedWikiCard';
import styles from './EmployeesTab.module.scss';

interface Props {
  /** Сотрудник видит пьедестал, свою карточку и свою упущенную прибыль; руководитель — всех */
  onlyName?: string;
}

/** Вкладка «Сотрудники»: пьедестал лидеров, карточки с заработком и упущенной прибылью за вики */
export const EmployeesTab: React.FC<Props> = ({ onlyName }) => {
  const { employees, salaries, histories, failedNames, loading, servicemenError, refetchServicemen } = useEmployeeSalaries(onlyName);
  const { data: missedData } = useMissedWiki();
  const colors = useChartColors();
  const [selected, setSelected] = useState<Serviceman | null>(null);

  // Рейтинг: по заработку за текущий период, места — только у тех, кто уже заработал
  const ranked = useMemo(() => [...employees].sort(
    (a, b) => (salaries[b.name]?.adjustedTotal ?? 0) - (salaries[a.name]?.adjustedTotal ?? 0),
  ), [employees, salaries]);

  const missedOf = (name: string) => {
    const m = missedData?.employees.find(e => e.servicemanName === name);
    return m ? { amount: m.amount, bonus: missedData!.bonus, items: m.items } : undefined;
  };
  const ownMissed = onlyName ? missedOf(onlyName) : undefined;

  const renderBody = () => {
    if (loading) {
      return (
        <Row gutter={[16, 16]}>
          {[1, 2, 3].map(i => (
            <Col key={i} xs={24} sm={12} lg={8}>
              <Card><Skeleton active avatar paragraph={{ rows: 3 }} /></Card>
            </Col>
          ))}
        </Row>
      );
    }
    if (servicemenError) {
      return (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить сотрудников"
          description={servicemenError}
          action={<Button size="small" onClick={() => refetchServicemen()}>Повторить</Button>}
        />
      );
    }
    if (employees.length === 0) return onlyName ? null : <div className={styles.empty}>Нет сотрудников</div>;
    return (
      <Row gutter={[16, 16]}>
        {ranked.map((m, i) => {
          const missed = missedOf(m.name);
          return (
            <Col key={m.id} xs={24} sm={12} lg={8}>
              <EmployeeCard
                employee={m}
                // У сотрудника одна карточка — место показывает пьедестал
                rank={!onlyName && (salaries[m.name]?.adjustedTotal ?? 0) > 0 ? i + 1 : null}
                salary={salaries[m.name]}
                history={histories[m.name] ?? []}
                missed={missed && { amount: missed.amount, count: missed.items.length }}
                lineColor={colors.lime}
                onClick={() => setSelected(m)}
              />
            </Col>
          );
        })}
        {ownMissed && (
          <Col xs={24} sm={12} lg={8}>
            <MissedWikiCard amount={ownMissed.amount} bonus={ownMissed.bonus} items={ownMissed.items} />
          </Col>
        )}
      </Row>
    );
  };

  return (
    <div className={styles.tab}>
      <LeadersPodium />
      {!loading && failedNames.length > 0 && (
        <Alert
          className={styles.alert}
          type="warning"
          showIcon
          message="Не удалось загрузить заработок части сотрудников"
          description={failedNames.join(', ')}
        />
      )}
      {renderBody()}

      <EmployeeModal
        employee={selected}
        salary={selected ? salaries[selected.name] : undefined}
        history={selected ? (histories[selected.name] ?? []) : []}
        missed={selected ? missedOf(selected.name) : undefined}
        onClose={() => setSelected(null)}
      />
    </div>
  );
};
