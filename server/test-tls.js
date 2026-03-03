const https = require('https');

const options = {
    hostname: 'vsi-api.shouqianba.com',
    port: 443,
    path: '/upay/v2/precreate',
    method: 'GET',
    rejectUnauthorized: false
};

console.log('Testing connection to ' + options.hostname + '...');

const req = https.request(options, (res) => {
    console.log('Status Code:', res.statusCode);
    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (e) => {
    console.error('Connection Error:', e.message);
    console.error('Error Stack:', e.stack);
});

req.end();
