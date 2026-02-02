/**
 * RURAL EXPLORER - PRODUCTION ENGINE
 * Corrected Path: data/list/Feb012026.xlsx
 */

let currentData = [];
let chartInstance = null;
let map = null;
let markers = null;

function initMap() {
    if (map) return;
    map = L.map('map', { zoomControl: false }).setView([39.2, -78.2], 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19
    }).addTo(map);

    markers = L.featureGroup().addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    
    setTimeout(() => map.invalidateSize(), 500);
}

// Fixed column matching for Feb012026 schema
const findCol = (row, aliases) => {
    const keys = Object.keys(row);
    for (let alias of aliases) {
        const found = keys.find(k => k.trim().toLowerCase() === alias.toLowerCase());
        if (found) return row[found];
    }
    return null;
};

async function loadExcelData(fileName) {
    const status = document.getElementById('statusUpdate');
    const led = document.getElementById('statusLed');
    
    // UPDATED PATH TO MATCH SUBFOLDER
    const fileUrl = `data/list/${fileName}`;

    try {
        status.innerText = "ACCESSING SUBFOLDER DATA...";
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`File not found at ${fileUrl}`);

        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellLinks: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Custom parse to catch URLs if they are hyperlinks in the cells
        const rawJson = XLSX.utils.sheet_to_json(sheet);

        currentData = rawJson.map((row, index) => {
            const price = parseFloat(String(findCol(row, ['Price']) || 0).replace(/[$,]/g, ''));
            const acres = parseFloat(findCol(row, ['Acres']) || 1);
            
            // Handle specific URL column "Property URL Link"
            let url = findCol(row, ['Property URL Link', 'URL', 'Link']);
            // If the cell had a hyperlink, try to extract the underlying address
            if (url === "View Listing" || !url.startsWith('http')) {
               // Fallback: This is where we'd look for cell.l.Target if we did a manual cell loop
               // For now, ensure it's a valid link or a searchable address
               if (url === "View Listing") url = "#"; 
            }

            return {
                id: index,
                address: findCol(row, ['Address']) || "Unknown",
                city: findCol(row, ['City']) || "",
                price: price,
                acres: acres,
                score: parseInt(findCol(row, ['LLM Score', 'Score'])) || 0,
                lat: parseFloat(findCol(row, ['Latitude'])),
                lng: parseFloat(findCol(row, ['Longitude'])),
                driveDist: findCol(row, ['Drive Dist (mi)']) || 0,
                url: url
            };
        }).filter(p => !isNaN(p.lat));

        status.innerText = "ACTIVE";
        led.className = "w-2.5 h-2.5 rounded-full bg-emerald-500";
        renderUI();

    } catch (err) {
        status.innerText = "LOAD ERROR";
        led.className = "w-2.5 h-2.5 rounded-full bg-red-500";
        console.error(err);
    }
}

function renderUI() {
    initMap();
    
    const grid = document.getElementById('listingGrid');
    grid.innerHTML = '';
    markers.clearLayers();

    currentData.forEach(p => {
        // Markers
        const m = L.circleMarker([p.lat, p.lng], {
            radius: 10,
            fillColor: p.score > 90 ? '#10b981' : '#64748b',
            color: '#fff',
            weight: 2,
            fillOpacity: 0.8
        }).addTo(markers);

        m.bindPopup(`<b>$${p.price.toLocaleString()}</b><br>${p.address}<br><a href="${p.url}" target="_blank">View Listing</a>`);

        // Cards
        const card = document.createElement('div');
        card.className = "property-card p-6 rounded-2xl flex flex-col justify-between cursor-pointer";
        card.innerHTML = `
            <div>
                <div class="flex justify-between mb-2">
                    <span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">SCORE: ${p.score}</span>
                    <span class="text-xs text-gray-400 font-bold">${p.driveDist} mi</span>
                </div>
                <h3 class="text-2xl font-black text-slate-800">$${p.price.toLocaleString()}</h3>
                <p class="text-gray-500 text-xs mb-4">${p.address}, ${p.city}</p>
                <p class="text-slate-700 font-bold text-sm">🌲 ${p.acres} Acres</p>
            </div>
            <a href="${p.url}" target="_blank" onclick="event.stopPropagation()" class="mt-6 block w-full py-3 bg-slate-900 text-white text-center text-[10px] font-bold rounded-xl hover:bg-emerald-600 transition-colors">
                OPEN LISTING
            </a>
        `;
        card.onclick = () => map.flyTo([p.lat, p.lng], 14);
        grid.appendChild(card);
    });

    if (markers.getLayers().length > 0) map.fitBounds(markers.getBounds().pad(0.1));
    renderStats();
    renderChart();
}

function renderStats() {
    const avgPrice = currentData.reduce((a, b) => a + b.price, 0) / currentData.length;
    const avgAc = currentData.reduce((a, b) => a + (b.price / b.acres), 0) / currentData.length;

    document.getElementById('avgPrice').innerText = `$${Math.round(avgPrice).toLocaleString()}`;
    document.getElementById('avgAcres').innerText = `$${Math.round(avgAc).toLocaleString()}/ac`;
    document.getElementById('listingCount').innerText = `${currentData.length} Properties Found`;
}

function renderChart() {
    const ctx = document.getElementById('marketChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Price vs Distance',
                data: currentData.map(p => ({ x: p.driveDist, y: p.price })),
                backgroundColor: '#10b981'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Distance (mi)' } },
                y: { title: { display: true, text: 'Price ($)' } }
            }
        }
    });
}

window.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadExcelData('data/list/Feb012026.xlsx');
});