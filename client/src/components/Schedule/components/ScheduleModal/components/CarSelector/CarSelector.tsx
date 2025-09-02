import React, {useEffect, useState} from 'react'
import {Input, Select} from "antd";
import {Brand, Generation, Model} from "../../../../../../api/carsApi/types";
import {carApi} from "../../../../../../api/carsApi/cars.api";
import {CarSelectorProps} from "./types";
import styles from "./CarSelector.module.scss";

const CarSelector = ({car, setFormData}: CarSelectorProps) => {
    const [selectedBrand, setSelectedBrand] = useState<string | null>(car.brand || null);
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [selectedGenerationId, setSelectedGenerationId] = useState<string | null>(null);

    const [brands, setBrands] = useState<Brand[]>([]);
    const [models, setModels] = useState<Model[]>([]);
    const [generations, setGenerations] = useState<Generation[]>([]);

    const [loading, setLoading] = useState({
        brands: true,
        models: false,
        generations: false,
        carInfo: false
    });

    const [isOpenOtherField, setIsOpenOtherField] = useState(false);

    useEffect(() => {
        if (brands.length === 0) {
            fetchBrands()
                .then(() =>
                    setLoading((prevState) => ({...prevState, brands: false}))
                );
        }
    }, []);

    const fetchBrands = async () => {
        try {
            setLoading(prev => ({...prev, brands: true}));
            const brandsData = await carApi.fetchBrands();
            setBrands(brandsData);
        } catch (error) {
            throw new Error('Ошибка при загрузке марок');
        } finally {
            setLoading(prev => ({...prev, brands: false}));
        }
    };

    const handleBrandChange = async (brandId: string) => {
        setSelectedBrand(brandId);
        setSelectedModel(null);
        setSelectedGenerationId(null);
        setModels([]);
        setGenerations([]);

        setFormData((prevState: { car: any; }) => ({...prevState, car: {...prevState.car, brand: brandId}}));

        try {
            setLoading(prev => ({...prev, models: true}));
            const modelsData = await carApi.fetchModels(brandId);
            setModels(modelsData);
        } catch (error) {
            throw new Error('Ошибка при загрузке моделей');
        } finally {
            setLoading(prev => ({...prev, models: false}));
        }
    };

    const handleModelChange = async (modelId: string) => {
        setSelectedModel(modelId);
        setSelectedGenerationId(null);
        setGenerations([]);

        setFormData((prevState: { car: any; }) => ({...prevState, car: {...prevState.car, model: modelId}}));


        if (selectedBrand) {
            try {
                setLoading(prev => ({...prev, generations: true}));
                const generationsData = await carApi.fetchGenerations(selectedBrand, modelId);
                setGenerations(generationsData);
            } catch (error) {
                throw new Error('Ошибка при загрузке поколений');
            } finally {
                setLoading(prev => ({...prev, generations: false}));
            }
        }
    };

    const handleGenerationChange = async (generationId: string) => {
        const generationData = generations.filter(gen => gen.id === generationId)[0];
        setSelectedGenerationId(generationId);

        setFormData((prevState: { car: any; }) => ({...prevState, car: {...prevState.car, generation: generationId}}));
        setFormData((prevState: { car: any; }) => ({
            ...prevState,
            car: {...prevState.car, generationName: generationData.name}
        }));
    }

    return (
        <div className={styles.carSelectWrapper}>
            <div className={styles.carSelectFirstRow}>
                <Select
                    showSearch
                    placeholder="Выберите марку"
                    style={{width: '100%'}}
                    loading={loading.brands}
                    disabled={loading.brands}
                    value={selectedBrand || undefined}
                    onChange={handleBrandChange}
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
                            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
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

                <Select
                    onChange={handleModelChange}
                    value={selectedModel || undefined}
                    disabled={!selectedBrand}
                    loading={loading.models}
                    placeholder="Выберите модель"
                    style={{width: '100%'}}
                >
                    {models.map(model => (
                        <Select.Option key={model.id} value={model.id}>{model.name}</Select.Option>
                    ))}
                </Select>
            </div>

            <div className={styles.carSelectSecondRow}>
                <Select
                    onChange={handleGenerationChange}
                    value={selectedGenerationId || undefined}
                    disabled={!selectedModel}
                    loading={loading.generations}
                    placeholder="Выберите поколение"
                    style={{width: '100%'}}
                >
                    {generations.map(generation => (
                        <Select.Option key={generation.id} value={generation.id}>
                            {`${generation.name} (${generation.year_from}-${generation.year_to})`}
                        </Select.Option>
                    ))}
                </Select>

                <div className={styles.wikiTextWrapper}>
                    {!isOpenOtherField && <div className={styles.underText} onClick={() => setIsOpenOtherField(true)}>нет подходящего варианта</div>}
                    {isOpenOtherField && <div className={styles.underText} onClick={() => setIsOpenOtherField(false)}>скрыть дополнительное поле</div>}
                </div>

                {
                    isOpenOtherField && (
                        <Input
                            onChange={
                                (e) => setFormData((prevState: { car: any; }) => ({
                                    ...prevState,
                                    car: {...prevState.car, otherData: e.target.value}
                                }))
                            }
                            value={car.otherData}
                            placeholder="Марка и модель авто"
                        />
                    )
                }
            </div>
        </div>
    )
}

export default CarSelector;