/**
 * RURAL EXPLORER v2.5 - FINAL STABLE
 * Fixes: Path Slashes, Tile Rendering, Hyperlink Extraction
 */

let currentData = [];
let map = null;
let markers = null;
let chartInstance = null;

// Initialize Map with fallback tile provider
function initMap() {
    if (map) return;
    map = L.map('map', { 
        zoomControl: false, 
        scrollWheelZoom: false 
    }).setView([39.3, -78.3], 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OSM',
        maxZoom: 18
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    markers = L.featureGroup().addTo(map);
    
    // Fix gray screen by forcing recalculation
    setTimeout(() => map.invalidateSize(), 800);
}

// Fixed Header Matching for Feb012026.xlsx
const getColValue = (row, keyName) => {
    const keys = Object.keys(row);
    const target = keyName.toLowerCase().trim();
    const foundKey = keys.find(k => k.toLowerCase().trim() === target);
    return foundKey ? row[foundKey] : null;
};

async function loadExcelData(fileName) {
    const status = document.getElementById('statusUpdate');
    const led = document.getElementById('statusLed');
    const pathTrace = document.getElementById('pathTrace');
    
    // USE FORWARD SLASHES FOR WEB COMPATIBILITY
    const folderPath = 'data/list/';
    const fileUrl = `${folderPath}${fileName}`;

    try {
        status.innerText = "ATTEMPTING LOAD...";
        pathTrace.innerText = `Fetch: ${fileUrl}`;
        led.className = "w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse";

        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}: Path not found.`);

        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellLinks: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Convert to JSON
        const rawJson = XLSX.utils.sheet_to_json(sheet);

        currentData = rawJson.map((row, index) => {
            const price = parseFloat(String(getColValue(row, 'Price') || 0).replace(/[$,]/g, ''));
            const acres = parseFloat(getColValue(row, 'Acres') || 1);
            
            // Logic to handle Hyperlinks in the Excel File
            const urlCol = getColValue(row, 'Property URL Link');
            let finalUrl = "#";
            
            if (urlCol) {
                if (typeof urlCol === 'string' && urlCol.startsWith('http')) {
                    finalUrl = urlCol;
                } else {
                    // Search cell for embedded link (Common in Excel exports)
                    const cellAddress = XLSX.utils.encode_cell({c: 13, r: index + 1}); // Col 13 is 'Property URL Link'
                    const cell = sheet[cellAddress];
                    if (cell && cell.l && cell.l.Target) {
                        finalUrl = cell.l.Target;
                    }
                }
            }

            return {
                address: getColValue(row, 'Address') || "Unknown Property",
                city: getColValue(row, 'City') || "",
                price: price,
                acres: acres,
                score: parseInt(getColValue(row, 'LLM Score')) || 0,
                lat: parseFloat(getColValue(row, 'Latitude')),
                lng: parseFloat(getColValue(row, 'Longitude')),
                drive: getColValue(row, 'Drive Dist (mi)') || 0,
                url: finalUrl
            };
        }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));

        status.innerText = "SYSTEM CONNECTED";
        led.className = "w-2.5 h-2.5 rounded-full bg-emerald-500";
        renderUI();

    } catch (err) {
        status.innerText = "LOAD FAILED";
        pathTrace.innerText = `Error: Check folder/slashes (${err.message})`;
        led.className = "w-2.5 h-2.5 rounded-full bg-red-600";
        console.error("Critical:", err);
    }
}

function renderUI() {
    initMap();
    const grid = document.getElementById('listingGrid');
    grid.innerHTML = '';
    markers.clearLayers();

    currentData.forEach(p => {
        // Build Card
        const card = document.createElement('div');
        card.className = "property-card p-6 rounded-2xl cursor-pointer";
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">SCORE: ${p.score}</span>
                <span class="text-xs text-gray-400 font-bold">${p.drive} mi</span>
            </div>
            <h3 class="text-2xl font-black text-slate-800">$${p.price.toLocaleString()}</h3>
            <p class="text-gray-500 text-xs mb-4">${p.address}, ${p.city}</p>
            <p class="text-slate-700 font-bold text-sm">🌲 ${p.acres} Acres</p>
            <a href="${p.url}" target="_blank" onclick="event.stopPropagation();" class="mt-6 block w-full py-3 bg-slate-900 text-white text-center text-[10px] font-bold rounded-xl hover:bg-emerald-600 transition-colors uppercase">
                Open Full Listing
            </a>
        `;
        card.onclick = () => map.flyTo([p.lat, p.lng], 14);
        grid.appendChild(card);

        // Build Marker
        const m = L.circleMarker([p.lat, p.lng], {
            radius: 10,
            fillColor: p.score > 90 ? '#10b981' : '#64748b',
            color: '#fff',
            weight: 2,
            fillOpacity: 0.8
        }).addTo(markers);
        m.bindPopup(`<b>$${p.price.toLocaleString()}</b><br>${p.address}`);
    });

    if (markers.getLayers().length > 0) map.fitBounds(markers.getBounds().pad(0.2));
    
    // Stats and Chart
    const avgP = currentData.reduce((a, b) => a + b.price, 0) / currentData.length;
    const avgA = currentData.reduce((a, b) => a + (b.price / b.acres), 0) / currentData.length;
    document.getElementById('avgPrice').innerText = `$${Math.round(avgP).toLocaleString()}`;
    document.getElementById('avgAcres').innerText = `$${Math.round(avgA).toLocaleString()}/ac`;
    document.getElementById('listingCount').innerText = `${currentData.length} Validated Properties`;
    
    renderChart();
}

function renderChart() {
    const ctx = document.getElementById('marketChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                data: currentData.map(p => ({ x: p.drive, y: p.price / p.acres })),
                backgroundColor: '#10b981'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Distance (mi)' } },
                y: { title: { display: true, text: 'Price Per Acre ($)' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

window.onload = () => {
    initMap();
    loadExcelData('Feb012026.xlsx');
};