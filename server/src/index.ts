import dotenv from 'dotenv';
import express from 'express';

dotenv.config({
    path: `.env.${process.env.NODE_ENV || 'development'}`,
});

const app = express();
const PORT = process.env.PORT || 3001;

app.get('/', (_, res) => res.send('PrimeCrm API working'));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
