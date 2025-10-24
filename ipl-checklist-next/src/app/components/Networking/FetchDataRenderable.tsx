import React, { useState } from 'react';

interface Data {
    message: string;
    timestamp: string;
}
export default function FetchData() {
    const [data, setData] = useState<Data | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fetchData = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/data');
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const fetchedData: Data = await response.json();
            setData(fetchedData);
            setError(null);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Error fetching data');
            setData(null);
        }
    };
  return (
    <div>
      <h1>Fetch Data from Node.js Server</h1>
      <button onClick={fetchData} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Fetch Data</button>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {data && (
        <div>
          <p>Message: {data.message}</p>
          <p>Timestamp: {data.timestamp}</p>
        </div>
      )}
    </div>
  );
}
