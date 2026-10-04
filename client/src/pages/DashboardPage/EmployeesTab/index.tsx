import React, { useState } from 'react';
import { Alert, Button, Card, Row, Col, Skeleton } from 'antd';
import { Serviceman } from '@/types';
import { useEmployeeSalaries } from '../hooks';
import { useChartColors } from '../useChartColors';
import { EmployeeCard } from '../EmployeeCard';
import { EmployeeModal } from '../EmployeeModal';
import styles from './EmployeesTab.module.scss';

/** Вкладка «Сотрудники»: карточки с заработком, по клику — подробности и график */
export const EmployeesTab: React.FC = () => {
  const { employees, salaries, histories, failedNames, loading, servicemenError, refetchServicemen } = useEmployeeSalaries();
  const colors = useChartColors();
  const [selected, setSelected] = useState<Serviceman | null>(null);

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
    if (employees.length === 0) return <div className={styles.empty}>Нет сотрудников</div>;
    return (
      <Row gutter={[16, 16]}>
        {employees.map(m => (
          <Col key={m.id} xs={24} sm={12} lg={8}>
            <EmployeeCard
              employee={m}
              salary={salaries[m.name]}
              history={histories[m.name] ?? []}
              lineColor={colors.primary}
              onClick={() => setSelected(m)}
            />
          </Col>
        ))}
      </Row>
    );
  };

  return (
    <div className={styles.tab}>
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
        onClose={() => setSelected(null)}
      />
    </div>
  );
};
