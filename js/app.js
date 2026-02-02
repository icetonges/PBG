/**
 * RURAL EXPLORER - COMPREHENSIVE ENGINE v2.1
 * Architecture: Static Decision Support System (GitHub Pages Optimized)
 */

let currentData = [];
let chartInstance = null;
let map = null;
let markers = null;

// Initialize Map immediately to prevent gray-out, but wait for DOM
function initMap() {
    if (map) return;
    
    map = L.map('map', { 
        zoomControl: false,
        scrollWheelZoom: false 
    }).setView([38.8, -77.5], 9);

    // Standard OpenStreetMap Tiles - High Reliability
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    markers = L.featureGroup().addTo(map);
    
    // Fix for Leaflet tile clipping in hidden/flex containers
    setTimeout(() => {
        map.invalidateSize();
    }, 400);
}

// FUZZY DATA MAPPER: Handles variation in Excel column naming conventions
const findCol = (row, aliases) => {
    const keys = Object.keys(row);
    for (let alias of aliases) {
        const found = keys.find(k => 
            k.toLowerCase().replace(/[^a-z0-9]/g, '') === 
            alias.toLowerCase().replace(/[^a-z0-9]/g, '')
        );
        if (found) return row[found];
    }
    return null;
};

async function loadExcelData(fileName) {
    const status = document.getElementById('statusUpdate');
    const statusLed = document.getElementById('statusLed');
    const pathTrace = document.getElementById('pathTrace');
    
    // GitHub Pages standard relative path
    const fileRelPath = `data/list/${fileName}.xlsx`;

    try {
        status.innerText = `FETCHING ${fileName}...`;
        pathTrace.innerText = `URL: ${fileRelPath}`;
        statusLed.className = "w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse";

        const response = await fetch(fileRelPath);
        if (!response.ok) throw new Error(`HTTP ${response.status}: Excel file not found in /data/list/`);
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const rawJson = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);

        if (rawJson.length === 0) throw new Error("Excel file appears to be empty.");

        // Clean and Normalize Data
        currentData = rawJson.map((row, index) => {
            const rawPrice = findCol(row, ['price', 'cost', 'amount', 'listprice']);
            const rawAcres = findCol(row, ['acres', 'acreage', 'landsize', 'sqft']);
            const rawLat = findCol(row, ['lat', 'latitude', 'y']);
            const rawLng = findCol(row, ['lng', 'longitude', 'long', 'x']);
            
            return {
                id: index,
                address: findCol(row, ['address', 'location', 'addr', 'name', 'fulladdress']) || 'Unnamed Property',
                price: typeof rawPrice === 'string' ? parseFloat(rawPrice.replace(/[$,]/g, '')) : parseFloat(rawPrice) || 0,
                acres: parseFloat(rawAcres) || 0,
                score: parseInt(findCol(row, ['score', 'rating', 'llm_score', 'rank'])) || 0,
                lat: parseFloat(rawLat),
                lng: parseFloat(rawLng),
                driveTime: parseInt(findCol(row, ['drivetime', 'minutes', 'distance', 'travel'])) || 0,
                url: findCol(row, ['url', 'link', 'listing', 'zillow', 'redfin']) || '#',
                type: findCol(row, ['type', 'category', 'class']) || 'Land'
            };
        }).filter(p => p.price > 0 && !isNaN(p.lat) && !isNaN(p.lng));

        status.innerText = `SYSTEM ACTIVE: ${currentData.length} NODES`;
        statusLed.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white/20";
        
        renderUI();

    } catch (err) {
        console.error("Critical Failure:", err);
        status.innerHTML = `<span class="text-red-400">LOAD FAILED: ${err.message}</span>`;
        statusLed.className = "w-2.5 h-2.5 rounded-full bg-red-500 border border-white/20";
    }
}

function renderUI() {
    initMap();
    renderListings();
    renderChart();
    renderAnalysis();
    
    // Adjust map to fit all markers
    if (markers.getLayers().length > 0) {
        map.fitBounds(markers.getBounds().pad(0.2));
    }
}

function renderListings() {
    const grid = document.getElementById('listingGrid');
    grid.innerHTML = '';
    markers.clearLayers();

    currentData.forEach(p => {
        // Build Card
        const card = document.createElement('div');
        card.className = 'property-card p-5 rounded-2xl shadow-sm cursor-pointer group flex flex-col justify-between';
        
        const priceFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(p.price);
        
        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start mb-4">
                    <span class="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded uppercase tracking-tighter">LLM SCORE: ${p.score}</span>
                    <span class="text-[10px] text-gray-400 font-bold uppercase">${p.type}</span>
                </div>
                <h3 class="text-2xl font-black text-slate-800">${priceFmt}</h3>
                <p class="text-gray-500 text-xs mb-4 font-medium truncate">${p.address}</p>
                <div class="flex gap-4 mb-6">
                    <div class="flex items-center gap-1 text-xs font-bold text-slate-600">🌲 ${p.acres} ac</div>
                    <div class="flex items-center gap-1 text-xs font-bold text-slate-600">🚗 ${p.driveTime}m</div>
                </div>
            </div>
            <a href="${p.url}" target="_blank" onclick="event.stopPropagation();" class="block w-full py-3 bg-slate-900 text-white text-center text-[10px] font-black rounded-xl group-hover:bg-emerald-600 transition-colors uppercase tracking-widest">
                Explore Original Listing
            </a>
        `;
        
        // Interactive behaviors
        card.onclick = () => {
            map.flyTo([p.lat, p.lng], 14);
            const marker = markers.getLayers().find(l => l.getLatLng().lat === p.lat);
            if(marker) marker.openPopup();
        };
        
        grid.appendChild(card);

        // Add Marker to Map
        const m = L.circleMarker([p.lat, p.lng], {
            radius: 12,
            fillColor: p.score > 80 ? "#10b981" : "#64748b",
            color: "#fff",
            weight: 3,
            fillOpacity: 0.9
        }).addTo(markers);
        
        m.bindPopup(`
            <div class="p-2">
                <b class="text-lg">${priceFmt}</b><br>
                <span class="text-gray-500 text-xs">${p.address}</span><br>
                <a href="${p.url}" target="_blank" class="text-emerald-600 font-bold text-[10px] uppercase mt-2 block">View Details →</a>
            </div>
        `);
    });

    document.getElementById('listingCount').innerText = `${currentData.length} Strategic Assets`;
}

function renderAnalysis() {
    if (!currentData.length) return;

    const totalVal = currentData.reduce((a, b) => a + b.price, 0);
    const avgPrice = totalVal / currentData.length;
    
    const validAcres = currentData.filter(p => p.acres > 0);
    const avgAcreVal = validAcres.reduce((a, b) => a + (b.price / b.acres), 0) / validAcres.length;
    
    document.getElementById('avgPrice').innerText = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(avgPrice);
    document.getElementById('avgAcres').innerText = `$${Math.round(avgAcreVal).toLocaleString()}/ac`;

    // Narrative logic
    const sorted = [...currentData].sort((a, b) => b.score - a.score);
    const topPick = sorted[0];
    
    document.getElementById('marketNarrative').innerText = 
        `Analysis identifies ${topPick.address} as the highest utility asset (Score: ${topPick.score}). The local frontier suggests a baseline cost of ${Math.round(avgAcreVal).toLocaleString()} per acre.`;

    // Top Picks Sidebar
    const picksContainer = document.getElementById('topPicks');
    picksContainer.innerHTML = '';
    sorted.slice(0, 3).forEach(pick => {
        picksContainer.innerHTML += `
            <div class="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm hover:border-emerald-200 transition-colors cursor-pointer" onclick="map.flyTo([${pick.lat}, ${pick.lng}], 14)">
                <div class="overflow-hidden">
                    <p class="text-[9px] font-black text-slate-400 uppercase truncate">${pick.address}</p>
                    <p class="text-xs font-black text-slate-800">$${pick.price.toLocaleString()}</p>
                </div>
                <span class="ml-2 text-xs font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded">${pick.score}</span>
            </div>
        `;
    });
}

function renderChart() {
    const ctx = document.getElementById('marketChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const chartData = currentData.map(p => ({
        x: p.driveTime,
        y: p.price / (p.acres || 1),
        r: Math.max(p.score / 4, 4) // Bubble radius
    }));

    chartInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Market Positioning',
                data: chartData,
                backgroundColor: 'rgba(16, 185, 129, 0.6)',
                hoverBackgroundColor: 'rgba(16, 185, 129, 1)',
                borderColor: '#059669',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `Valuation: $${Math.round(context.raw.y)}/ac @ ${context.raw.x}m`
                    }
                }
            },
            scales: {
                x: { 
                    title: { display: true, text: 'DRIVE TIME (MINS)', font: { size: 10, weight: 'bold' } },
                    grid: { color: '#f1f5f9' }
                },
                y: { 
                    title: { display: true, text: 'PRICE PER ACRE ($)', font: { size: 10, weight: 'bold' } },
                    grid: { color: '#f1f5f9' }
                }
            }
        }
    });
}

// Event Listeners
document.getElementById('fileSelector').addEventListener('change', e => loadExcelData(e.target.value));

// App Launch
window.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadExcelData('Feb012026');
});