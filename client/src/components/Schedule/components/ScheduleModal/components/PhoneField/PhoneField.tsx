import React, {useState} from 'react';
import {MaskedInput} from "antd-mask-input";
import {Button, Input} from "antd";
import {FormDataInterface} from "../../types";

interface PhoneFieldProps {
    formData: FormDataInterface;
    setFormData: React.Dispatch<React.SetStateAction<FormDataInterface>>;
}

const PhoneField: React.FC<PhoneFieldProps> = ({ formData, setFormData }) => {
    const [phoneCount, setPhoneCount] = useState(1);

    const handlePhoneChange = (index: number, value: string) => {
        const newPhones = [...(formData.phone || [])];
        newPhones[index] = value;
        setFormData((prev: FormDataInterface) => ({...prev, phone: newPhones}));
    };

    const addPhoneField = () => {
        if (phoneCount < 2) {
            setPhoneCount(prev => prev + 1);
            setFormData((prev: FormDataInterface) => ({...prev, phone: [...(prev.phone || []), ""]}));
        }
    };

    return (
        <>
            {Array.from({ length: phoneCount }, (_, index) => (
                <div key={index} style={{ marginBottom: index < phoneCount - 1 ? 8 : 0 }}>
                    {index === 0 ? (
                        <MaskedInput
                            mask={"+375 (00) 000-00-00"}
                            value={(formData.phone || [])[index] || ""}
                            onChange={(e) => handlePhoneChange(index, e.target.value)}
                            placeholder={"+375 (29) 999-99-99"}
                        />
                    ) : (
                        <Input
                            value={(formData.phone || [])[index] || ""}
                            onChange={(e) => handlePhoneChange(index, e.target.value)}
                            placeholder="Дополнительный номер"
                        />
                    )}
                </div>
            ))}
            {phoneCount < 2 && (
                <div style={{ marginTop: 2 }}>
                    <Button
                        type="link"
                        onClick={addPhoneField}
                        style={{
                            padding: 0,
                            height: 'auto',
                            fontSize: '12px',
                            color: 'rgba(15, 34, 49, 0.5)'
                        }}
                    >
                        дополнительный номер
                    </Button>
                </div>
            )}
        </>
    )
}

export default PhoneField;