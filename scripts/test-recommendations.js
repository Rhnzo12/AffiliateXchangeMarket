const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function run() {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: node scripts/test-recommendations.js <userId>');
    process.exit(1);
  }

  const url = `http://localhost:3000/api/debug/recommendations?userId=${encodeURIComponent(userId)}`;
  try {
    const res = await fetch(url, { method: 'GET' });
    const status = res.status;
    const body = await res.text();
    console.log('Status:', status);
    try {
      console.log('Response JSON:', JSON.parse(body));
    } catch (e) {
      console.log('Response:', body);
    }
  } catch (err) {
    console.error('Request failed:', err.message || err);
  }
}

run();
