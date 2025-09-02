import {Car} from "../../types";

export interface CarSelectorProps {
    car: Car;
    setFormData: (prevState: any) => any;
}