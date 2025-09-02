import React, {useEffect, useState} from 'react'
import {Select} from "antd";
import {Brand} from "../../../../../../api/carsApi/types";
import {carApi} from "../../../../../../api/carsApi/cars.api";

const CarSelector = () => {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState({
        brands: false,
        models: false,
        generations: false,
        carInfo: false
    });

    useEffect(() => {
        fetchBrands();
    }, []);

    const fetchBrands = async () => {
        try {
            setLoading(prev => ({ ...prev, brands: true }));
            const brandsData = await carApi.fetchBrands();
            setBrands(brandsData);
        } catch (error) {
            throw new Error(error, 'Ошибка при загрузке марок');
        } finally {
            setLoading(prev => ({ ...prev, brands: false }));
        }
    };

    return (
        <div>
            <Select
                showSearch
                placeholder="Выберите марку"
                style={{ width: '100%' }}
                loading={loading.brands}
                // value={selectedBrand || undefined}
                onChange={(e) => console.log(e)}
                filterOption={(input, option) =>
                    option?.['data-brand-name']?.toLowerCase().includes(input.toLowerCase())
                }
            >
                {brands.map((brand) => (
                    <Select.Option
                        key={brand.id}
                        value={brand.id}
                        data-brand-name={brand.name}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {brand.logo && (
                                <img
                                    src={brand.logo}
                                    alt={brand.name}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        objectFit: 'contain',
                                    }}
                                />
                            )}
                            <span>{brand.name}</span>
                        </div>
                    </Select.Option>
                ))}
            </Select>
        </div>
    )
}

export default CarSelector;