import {ThemeConfig} from "antd";

export const themeConfig: ThemeConfig = {
    token: {
        colorBgContainer: '#06131d', // borders & background color calendar
        colorText: '#f2f2f2', // color active month text
    },
    components: {
        Calendar: {
            colorTextDisabled: 'rgba(151,166,190,0.5)', // Цвета для дней за пределами месяца
            colorPrimary: '#1677ff', // Цвета для сегодняшнего дня
        }
    }
}