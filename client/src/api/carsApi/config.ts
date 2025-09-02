export const API_CONFIG = {
    BASE_URL: 'https://auto-data.api-home.ru/api/public/v1',
    TOKEN: 'j8zmlGcAdsNnRn5pzDY3ZMfzDQGqSsE8lUpmv9Tej1GKoVq0cFW2ctD82NA7bmuT',
    IMAGE_BASE_URL: 'https://'
} as const;

export const HEADERS = {
    'api-token': API_CONFIG.TOKEN
};