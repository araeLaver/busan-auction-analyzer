#!/usr/bin/env node

const { processManualData } = require('./manual-scraping');

processManualData()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('실패:', error);
        process.exit(1);
    });