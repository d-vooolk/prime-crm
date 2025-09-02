import {API_CONFIG} from "./config";
import {Brand, Generation, Model} from "./types";

export const carApi = {
    async fetchBrands(): Promise<Brand[]> {
        const response = await fetch(`${API_CONFIG.BASE_URL}/marks`, { headers });
        if (!response.ok) {
            throw new Error('Failed to fetch brands');
        }
        const data = await response.json();
        const brandsData = Array.isArray(data) ? data : data.data || [];
        return brandsData.map((brand: Brand) => ({
            ...brand,
            logo: brand.logo ? `${API_CONFIG.IMAGE_BASE_URL}${brand.logo}` : null
        }));
    },

    async fetchModels(markId: string): Promise<Model[]> {
        const response = await fetch(`${API_CONFIG.BASE_URL}/marks/${markId}/models`, { headers });
        if (!response.ok) {
            throw new Error('Failed to fetch models');
        }
        const data = await response.json();
        return Array.isArray(data) ? data : data.data || [];
    },

    async fetchGenerations(markId: string, modelId: string): Promise<Generation[]> {
        const response = await fetch(
            `${API_CONFIG.BASE_URL}/marks/${markId}/models/${modelId}/generations`,
            { headers }
        );
        if (!response.ok) {
            throw new Error('Failed to fetch generations');
        }
        const data = await response.json();
        return Array.isArray(data) ? data : data.data || [];
    },
};