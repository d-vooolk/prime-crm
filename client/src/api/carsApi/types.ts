export interface Brand {
    id: string;
    name: string;
    logo?: string | null;
}

export interface Model {
    id: string;
    name: string;
    brandId: string;
}

export interface Generation {
    id: string;
    name: string;
    modelId: string;
    year_from: number;
    year_to: number;
    photo?: string | null;
}