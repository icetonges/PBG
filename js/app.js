/**
 * RURAL EXPLORER - DATA ENGINE
 * Specifically optimized for Feb012026.xlsx column schema
 */

let currentData = [];
let chartInstance = null;
let map = null;
let markers = null;

function initMap() {
    if (map) return;
    map = L.map('map', { 
        zoomControl: false,
        scrollWheelZoom: false 
    }).setView([39.29, -78.6], 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    markers = L.featureGroup().addTo(map);
    
    setTimeout(() => { map.invalidateSize(); }, 400);
}

// Logic to find columns based on the specific Feb012026.xlsx headers
const findCol = (row, aliases) => {
    const keys = Object.keys(row);
    for (let alias of aliases) {
        const found = keys.find(k => 
            k.toLowerCase().trim() === alias.toLowerCase().trim() ||
            k.toLowerCase().replace(/[^a-z0-9]/g, '') === alias.toLowerCase().replace(/[^a-z0-9]/g, '')
        );
        if (found !== undefined) return row[found];
    }
    return null;
};

async function loadExcelData(fileName) {
    const status = document.getElementById('statusUpdate');
    const statusLed = document.getElementById('statusLed');
    const pathTrace = document.getElementById('pathTrace');
    
    // Attempting direct root access as most common for GitHub Pages uploads
    const fileUrl = `./${fileName}`;

    try {
        status.innerText = `LOADING ${fileName}...`;
        pathTrace.innerText = `Target: ${fileUrl}`;
        statusLed.className = "w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse";

        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`File ${fileName} not found in root.`);
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawJson = XLSX.utils.sheet_to_json(sheet);

        currentData = rawJson.map((row, index) => {
            // Precise Mapping for Feb012026.xlsx
            const price = parseFloat(String(findCol(row, ['Price']) || 0).replace(/[$,]/g, ''));
            const acres = parseFloat(findCol(row, ['Acres']) || 0);
            const lat = parseFloat(findCol(row, ['Latitude']));
            const lng = parseFloat(findCol(row, ['Longitude']));
            const url = findCol(row, ['Property URL Link']) || '#';
            const score = parseInt(findCol(row, ['LLM Score', 'Score'])) || 0;
            const driveDist = parseInt(findCol(row, ['Drive Dist (mi)'])) || 0;

            return {
                id: index,
                address: findCol(row, ['Address']) || 'Unknown Address',
                city: findCol(row, ['City']) || '',
                state: findCol(row, ['State']) || '',
                price,
                acres,
                score,
                lat,
                lng,
                driveDist,
                url,
                type: findCol(row, ['Type']) || 'Property'
            };
        }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));

        status.innerText = `ACTIVE: ${currentData.length} PROPERTIES`;
        statusLed.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white/20";
        
        renderUI();
    } catch (err) {
        console.error(err);
        status.innerText = "FAILED TO LOAD DATA";
        statusLed.className = "w-2.5 h-2.5 rounded-full bg-red-500";
    }
}

function renderUI() {
    initMap();
    renderListings();
    renderStats();
    renderChart();
    if (markers.getLayers().length > 0) {
        map.fitBounds(markers.getBounds().pad(0.1));
    }
}

function renderListings() {
    const grid = document.getElementById('listingGrid');
    grid.innerHTML = '';
    markers.clearLayers();

    currentData.forEach(p => {
        const priceFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(p.price);
        
        const card = document.createElement('div');
        card.className = 'property-card p-5 rounded-2xl shadow-sm cursor-pointer';
        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <span class="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded uppercase tracking-tighter">SCORE: ${p.score}</span>
                <span class="text-[10px] text-gray-400 font-bold uppercase">${p.type}</span>
            </div>
            <h3 class="text-2xl font-black text-slate-800">${priceFmt}</h3>
            <p class="text-gray-500 text-xs mb-4 font-medium">${p.address}, ${p.city}, ${p.state}</p>
            <div class="flex gap-4 mb-6">
                <div class="flex items-center gap-1 text-xs font-bold text-slate-600">🌲 ${p.acres} ac</div>
                <div class="flex items-center gap-1 text-xs font-bold text-slate-600">🚗 ${p.driveDist} mi</div>
            </div>
            <a href="${p.url}" target="_blank" class="mt-auto block w-full py-3 bg-slate-900 text-white text-center text-[10px] font-black rounded-xl hover:bg-emerald-600 transition-colors uppercase tracking-widest">
                View Listing
            </a>
        `;
        
        card.onclick = (e) => {
            if (e.target.tagName !== 'A') {
                map.flyTo([p.lat, p.lng], 14);
            }
        };
        
        grid.appendChild(card);

        const m = L.circleMarker([p.lat, p.lng], {
            radius: 10,
            fillColor: p.score > 90 ? "#10b981" : "#64748b",
            color: "#fff",
            weight: 2,
            fillOpacity: 0.9
        }).addTo(markers);
        
        m.bindPopup(`
            <div class="p-1">
                <b class="text-sm">${priceFmt}</b><br>
                <span class="text-xs text-gray-500">${p.address}</span><br>
                <a href="${p.url}" target="_blank" class="text-emerald-600 font-bold text-[10px] uppercase mt-1 block">Open Link</a>
            </div>
        `);
    });

    document.getElementById('listingCount').innerText = `${currentData.length} Strategic Picks`;
}

function renderStats() {
    if (!currentData.length) return;
    const avgPrice = currentData.reduce((a, b) => a + b.price, 0) / currentData.length;
    const avgAcreVal = currentData.reduce((a, b) => a + (b.price / (b.acres || 1)), 0) / currentData.length;
    
    document.getElementById('avgPrice').innerText = `$${Math.round(avgPrice).toLocaleString()}`;
    document.getElementById('avgAcres').innerText = `$${Math.round(avgAcreVal).toLocaleString()}/ac`;

    const best = [...currentData].sort((a, b) => b.score - a.score)[0];
    document.getElementById('marketNarrative').innerText = 
        `Top identified asset: ${best.address} (Score ${best.score}). Market average $/acre is holding at $${Math.round(avgAcreVal).toLocaleString()}.`;

    const picksContainer = document.getElementById('topPicks');
    picksContainer.innerHTML = '';
    [...currentData].sort((a,b) => b.score - a.score).slice(0, 3).forEach(pick => {
        picksContainer.innerHTML += `
            <div class="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm cursor-pointer hover:border-emerald-200" onclick="map.flyTo([${pick.lat}, ${pick.lng}], 14)">
                <div>
                    <p class="text-[9px] font-black text-slate-400 uppercase truncate w-32">${pick.address}</p>
                    <p class="text-xs font-black text-slate-800">$${pick.price.toLocaleString()}</p>
                </div>
                <span class="text-xs font-black text-emerald-500">${pick.score}</span>
            </div>
        `;
    });
}

function renderChart() {
    const ctx = document.getElementById('marketChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                data: currentData.map(p => ({
                    x: p.driveDist,
                    y: p.price / (p.acres || 1),
                    r: p.score / 5
                })),
                backgroundColor: 'rgba(16, 185, 129, 0.6)',
                hoverBackgroundColor: 'rgba(16, 185, 129, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { title: { display: true, text: 'Distance (mi)', font: { size: 10 } } },
                y: { title: { display: true, text: '$/Acre', font: { size: 10 } } }
            }
        }
    });
}

document.getElementById('fileSelector').addEventListener('change', e => loadExcelData(e.target.value));
window.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadExcelData('Feb012026.xlsx');
});