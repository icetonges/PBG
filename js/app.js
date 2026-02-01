/**
 * RURAL EXPLORER - COMPREHENSIVE ENGINE v2.1
 */

let currentData = [];
let chartInstance = null;
let map;
let markers;

// Initialize map immediately
function initMap() {
    map = L.map('map', { zoomControl: false }).setView([38.8, -77.5], 8);
    markers = L.featureGroup().addTo(map); // FIXED: Use featureGroup for getBounds()
    
    L.tileLayer('https://{s}.tile.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '©OpenStreetMap'
    }).addTo(map);
    
    L.control.zoom({ position: 'bottomright' }).addTo(map);
}

// FUZZY DATA MAPPER: Prevents "undefined" data
const findCol = (row, aliases) => {
    const keys = Object.keys(row);
    for (let alias of aliases) {
        const found = keys.find(k => k.toLowerCase().replace(/\s/g, '') === alias.toLowerCase());
        if (found) return row[found];
    }
    return null;
};

async function loadExcelData(fileName) {
    const status = document.getElementById('statusUpdate');
    const statusLed = document.getElementById('statusLed');
    const pathTrace = document.getElementById('pathTrace');
    const fileRelPath = `data/list/${fileName}.xlsx`;

    try {
        status.innerText = `ACCESSING ${fileName}...`;
        pathTrace.innerText = `Target: ${fileRelPath}`;
        statusLed.className = "w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse";

        const response = await fetch(fileRelPath);
        if (!response.ok) throw new Error(`HTTP ${response.status}: File Not Found`);
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawJson = XLSX.utils.sheet_to_json(sheet);

        currentData = rawJson.map((row, index) => ({
            id: index,
            address: findCol(row, ['address', 'location', 'addr', 'name']) || 'Unnamed Property',
            price: parseFloat(findCol(row, ['price', 'cost', 'amount'])) || 0,
            acres: parseFloat(findCol(row, ['acres', 'acreage', 'landsize'])) || 0,
            score: parseInt(findCol(row, ['score', 'rating', 'llm_score'])) || 0,
            lat: parseFloat(findCol(row, ['lat', 'latitude'])),
            lng: parseFloat(findCol(row, ['lng', 'longitude', 'long'])),
            driveTime: parseInt(findCol(row, ['drivetime', 'minutes', 'distance'])) || 0,
            url: findCol(row, ['url', 'link', 'listing']) || '#',
            type: findCol(row, ['type', 'category']) || 'Land'
        })).filter(p => p.price > 0 && !isNaN(p.lat));

        status.innerText = `${fileName} LOADED`;
        statusLed.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white/20";
        
        // CRITICAL FIX: Ensure map tiles render correctly
        setTimeout(() => {
            map.invalidateSize();
            renderUI();
        }, 100);

    } catch (err) {
        status.innerHTML = `<span class="text-red-400">LOAD FAILED</span>`;
        statusLed.className = "w-2.5 h-2.5 rounded-full bg-red-500";
    }
}

function renderUI() {
    const grid = document.getElementById('listingGrid');
    grid.innerHTML = '';
    markers.clearLayers();

    currentData.forEach(p => {
        const card = document.createElement('div');
        card.className = 'bg-white p-5 property-card rounded-2xl shadow-sm border border-gray-100 cursor-pointer';
        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <span class="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded uppercase">LLM SCORE: ${p.score}</span>
            </div>
            <h3 class="text-2xl font-black text-slate-800">$${p.price.toLocaleString()}</h3>
            <p class="text-gray-500 text-xs truncate">${p.address}</p>
        `;
        card.onclick = () => map.flyTo([p.lat, p.lng], 13);
        grid.appendChild(card);

        L.circleMarker([p.lat, p.lng], {
            radius: 10,
            fillColor: p.score > 85 ? "#10b981" : "#64748b",
            color: "#fff", weight: 2, fillOpacity: 0.9
        }).addTo(markers).bindPopup(`$${p.price.toLocaleString()}`);
    });

    if (markers.getLayers().length > 0) {
        map.fitBounds(markers.getBounds().pad(0.1));
    }
    renderAnalysis();
    renderChart();
}

// ... include renderAnalysis and renderChart from previous version ...

window.onload = () => {
    initMap();
    loadExcelData('Feb012026');
};