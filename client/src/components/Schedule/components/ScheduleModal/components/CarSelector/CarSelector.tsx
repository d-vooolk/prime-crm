import React, {useEffect, useState} from 'react'
import {Select} from "antd";
import {Brand, Generation, Model} from "../../../../../../api/carsApi/types";
import {carApi} from "../../../../../../api/carsApi/cars.api";

interface CarSelectorProps {
    setFormData: React.Dispatch<React.SetStateAction<any>>;
}

const CarSelector: React.FC<CarSelectorProps> = ({ setFormData }) => {
    const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [selectedGeneration, setSelectedGeneration] = useState<string | null>(null);

    const [brands, setBrands] = useState<Brand[]>([]);
    const [models, setModels] = useState<Model[]>([]);
    const [generations, setGenerations] = useState<Generation[]>([]);

    const [loading, setLoading] = useState({
        brands: true,
        models: false,
        generations: false,
        carInfo: false
    });

    useEffect(() => {
        fetchBrands()
            .then(() =>
                setLoading((prevState) => ({...prevState, brands: false}))
            );
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

    const handleApiError = (error: any, message: string) => {
        console.error(message, error);
    };

    const handleBrandChange = async (brandId: string) => {
        setSelectedBrand(brandId);
        setSelectedModel(null);
        setSelectedGeneration(null);
        setModels([]);
        setGenerations([]);

        try {
            setLoading(prev => ({...prev, models: true}));
            const modelsData = await carApi.fetchModels(brandId);
            setModels(modelsData);
        } catch (error) {
            handleApiError(error, 'Ошибка при загрузке моделей');
        } finally {
            setLoading(prev => ({...prev, models: false}));
        }
    };

    const handleModelChange = async (modelId: string) => {
        setSelectedModel(modelId);
        setSelectedGeneration(null);
        setGenerations([]);

        if (selectedBrand) {
            try {
                setLoading(prev => ({...prev, generations: true}));
                const generationsData = await carApi.fetchGenerations(selectedBrand, modelId);
                setGenerations(generationsData);
            } catch (error) {
                handleApiError(error, 'Ошибка при загрузке поколений');
            } finally {
                setLoading(prev => ({...prev, generations: false}));
            }
        }
    };

    const handleGenerationChange = async (generationId: string) => {
        setSelectedGeneration(generationId);
        // Update form data with selected car info
        setFormData((prev: any) => ({
            ...prev,
            car: {
                ...prev.car,
                generation: generationId
            }
        }));
    };

    return (
        <div>
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

            <Select
                onChange={handleGenerationChange}
                value={selectedGeneration || undefined}
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
        </div>
    )
}

export default CarSelector;