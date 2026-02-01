/**
 * RURAL EXPLORER - CORE ENGINE
 * Logic for Excel Parsing, Mapping, and Charting
 */

let currentData = [];
let map = L.map('map').setView([38.8, -77.5], 8);
let markers = L.layerGroup().addTo(map);
let chartInstance = null;

// Use a clean, modern map style
L.tileLayer('https://{s}.tile.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Helper to find data regardless of column name casing
const getVal = (row, possibleNames) => {
    const keys = Object.keys(row);
    for (let name of possibleNames) {
        const foundKey = keys.find(k => k.toLowerCase().trim() === name.toLowerCase());
        if (foundKey) return row[foundKey];
    }
    return null;
};

async function loadExcelData(fileName) {
    const status = document.getElementById('statusUpdate');
    // Important: Path relative to index.html
    const filePath = `data/list/${fileName}.xlsx`;
    
    try {
        status.innerText = `FETCHING ${fileName}...`;
        const response = await fetch(filePath);
        if (!response.ok) throw new Error("File not found on server");
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawJson = XLSX.utils.sheet_to_json(sheet);

        // Normalize data to ensure the UI can read it
        currentData = rawJson.map(row => ({
            address: getVal(row, ['address', 'location', 'addr']),
            price: parseFloat(getVal(row, ['price', 'cost', 'amount'])) || 0,
            acres: parseFloat(getVal(row, ['acres', 'acreage', 'size'])) || 0,
            score: parseInt(getVal(row, ['score', 'llm_score', 'rating'])) || 0,
            lat: parseFloat(getVal(row, ['lat', 'latitude'])),
            lng: parseFloat(getVal(row, ['lng', 'longitude', 'long'])),
            driveTime: parseInt(getVal(row, ['drivetime', 'distance', 'minutes'])) || 0,
            url: getVal(row, ['url', 'link', 'listing']) || '#'
        }));

        status.innerText = `SUCCESS: ${fileName} LOADED`;
        renderUI();
    } catch (err) {
        console.error(err);
        status.innerHTML = `<span class="text-red-400">ERROR: ${err.message}</span>`;
    }
}

function renderUI() {
    const grid = document.getElementById('listingGrid');
    const countLabel = document.getElementById('listingCount');
    grid.innerHTML = '';
    markers.clearLayers();

    currentData.forEach((p, idx) => {
        // Create List Card
        const card = document.createElement('div');
        card.className = 'property-card bg-white border border-gray-100 p-5 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all';
        card.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <span class="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Score: ${p.score}</span>
                <span class="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Property</span>
            </div>
            <h3 class="text-xl font-bold text-slate-800 mb-1">$${p.price.toLocaleString()}</h3>
            <p class="text-gray-500 text-sm mb-4 truncate">${p.address || 'Address Hidden'}</p>
            <div class="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600 mb-4">
                <div class="bg-slate-50 p-2 rounded">🌲 ${p.acres} Acres</div>
                <div class="bg-slate-50 p-2 rounded">🚗 ${p.driveTime} min</div>
            </div>
            <a href="${p.url}" target="_blank" class="block w-full text-center py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors">VIEW LISTING</a>
        `;
        card.onclick = () => { if(p.lat && p.lng) map.flyTo([p.lat, p.lng], 14); };
        grid.appendChild(card);

        // Add Map Pin
        if (p.lat && p.lng) {
            const marker = L.circleMarker([p.lat, p.lng], {
                radius: 10,
                fillColor: p.score > 80 ? '#10b981' : '#64748b',
                color: '#fff',
                weight: 2,
                fillOpacity: 0.9
            }).bindPopup(`<b>$${p.price.toLocaleString()}</b><br>${p.address}`);
            markers.addLayer(marker);
        }
    });

    countLabel.innerText = `${currentData.length} Properties Analyzed`;
    updateStats();
    updateChart();
    if (markers.getLayers().length > 0) map.fitBounds(markers.getBounds().pad(0.2));
}

function updateStats() {
    const validPrices = currentData.map(p => p.price).filter(p => p > 0);
    const avgP = validPrices.length ? validPrices.reduce((a,b) => a+b)/validPrices.length : 0;
    const avgA = currentData.reduce((a,b) => a + (b.acres || 0), 0) / currentData.length;
    
    document.getElementById('avgPrice').innerText = `$${Math.round(avgP).toLocaleString()}`;
    document.getElementById('avgAcres').innerText = `${avgA.toFixed(1)} ac`;
    document.getElementById('highScore').innerText = Math.max(...currentData.map(p => p.score || 0));
}

function updateChart() {
    const ctx = document.getElementById('marketChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    
    chartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Value Frontier',
                data: currentData.map(p => ({ x: p.driveTime, y: p.price / (p.acres || 1) })),
                backgroundColor: '#10b981',
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Mins from Fairfax', font: { size: 10 } } },
                y: { title: { display: true, text: '$/Acre', font: { size: 10 } } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// Event Listeners
document.getElementById('fileSelector').addEventListener('change', (e) => loadExcelData(e.target.value));

// Bootstrap
window.onload = () => loadExcelData('Feb012026');