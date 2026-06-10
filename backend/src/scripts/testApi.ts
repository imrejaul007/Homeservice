import http from 'http';

function makeRequest(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function test() {
  console.log('Testing API...\n');

  try {
    console.log('GET /api/packages');
    const result = await makeRequest('/api/packages');
    console.log('Response:', result.substring(0, 500));
  } catch (err) {
    console.error('Error:', err);
  }

  try {
    console.log('\nGET /api/health');
    const result = await makeRequest('/api/health');
    console.log('Response:', result.substring(0, 500));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
