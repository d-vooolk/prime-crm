import React from 'react';
import dayjs from 'dayjs';

import 'dayjs/locale/ru';

import {Calendar as AntCalendar, Flex, Select, theme, Typography} from 'antd';
import type { CalendarProps } from 'antd';
import type { Dayjs } from 'dayjs';
import dayLocaleData from 'dayjs/plugin/localeData';
import {LeftOutlined, RightOutlined} from "@ant-design/icons";

dayjs.extend(dayLocaleData);
dayjs.locale('ru');

const Calendar: React.FC = () => {
    const { token } = theme.useToken();

    const onPanelChange = (value: Dayjs, mode: CalendarProps<Dayjs>['mode']) => {
        console.log(value.format('YYYY-MM-DD'), mode);
    };

    const wrapperStyle: React.CSSProperties = {
        position: 'relative',
        width: '90%',
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
    };

    return (
        <div style={wrapperStyle}>
            <AntCalendar
                fullscreen={false}
                headerRender={({ value, type, onChange, onTypeChange }) => {
                    const year = value.year();
                    const month = value.month();

                    const monthOptions = value
                        .localeData()
                        .monthsShort()
                        .map((label, index) => ({
                            label,
                            value: index,
                        }));

                    const getMonthLabel = (monthNumber: number) =>
                        monthOptions.filter((month) => month.value === monthNumber)[0].label;

                    const navigateMonthHandler = (currentMonth: number) => {
                        const now = value.clone().month(currentMonth);
                        onChange(now);
                    }

                    return (
                        <div style={{ position: 'relative', padding: 8, display: 'flex', justifyContent: 'center' }}>
                            <Flex gap={8} justify="space-between" style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                <LeftOutlined disabled={month - 1 < 0} onClick={() => navigateMonthHandler(month - 1)} />
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontWeight: '600' }}>
                                    <Typography>{getMonthLabel(month)}</Typography>
                                    <Typography>{year}</Typography>
                                </div>
                                <RightOutlined disabled={month + 1 > monthOptions.length - 1} onClick={() => navigateMonthHandler(month + 1)} />
                            </Flex>
                        </div>
                    );
                }}
                onPanelChange={onPanelChange}
            />
        </div>
    );
};

export default Calendar;