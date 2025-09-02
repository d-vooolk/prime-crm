export const API_CONFIG = {
    BASE_URL: 'https://auto-data.api-home.ru/api/public/v1',
    TOKEN: '0rOp2D0cVZXb4mbf1fPtsnefXIzlr9RclhOWTd2BufWGtLIERmakkK1ncLWJ11sp',
    IMAGE_BASE_URL: 'https://'
} as const;

export const headers = {
    'api-token': API_CONFIG.TOKEN
};