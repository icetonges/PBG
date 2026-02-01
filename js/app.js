/** * RURAL EXPLORER - HOTFIX v1.1
 * Fixed: Endless chart loop & getBounds map error
 */

let currentData = [];
let map = L.map('map').setView([38.8, -77.5], 8);

// FIX 1: Use L.featureGroup instead of layerGroup so we can use .getBounds()
let markers = L.featureGroup().addTo(map); 
let chartInstance = null;

L.tileLayer('https://{s}.tile.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

// ... (keep your getVal and loadExcelData functions as they are) ...

function renderUI() {
    const grid = document.getElementById('listingGrid');
    const countLabel = document.getElementById('listingCount');
    
    // Clear previous state
    grid.innerHTML = '';
    markers.clearLayers();

    currentData.forEach((p, idx) => {
        // ... (keep your card creation logic) ...
        grid.appendChild(card);

        // Add Map Pin
        if (p.lat && p.lng && !isNaN(p.lat) && !isNaN(p.lng)) {
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
    
    // FIX 2: Check if markers exist before calling getBounds to prevent crashes
    if (markers.getLayers().length > 0) {
        map.fitBounds(markers.getBounds().pad(0.2));
    }

    updateStats();
    updateChart(); // This is called ONCE per data load
}

function updateChart() {
    const canvas = document.getElementById('marketChart');
    const ctx = canvas.getContext('2d');
    
    // FIX 3: Robust Chart Reset to prevent the "Endless Loop" / Overlapping
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    // Prepare data - filter out zeros to keep chart clean
    const chartData = currentData
        .filter(p => p.driveTime > 0 && p.acres > 0)
        .map(p => ({ x: p.driveTime, y: p.price / p.acres }));

    chartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: '$/Acre vs Distance',
                data: chartData,
                backgroundColor: '#10b981',
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            // Disable animations to stop any redraw-looping issues
            animation: false, 
            scales: {
                x: { title: { display: true, text: 'Mins to Fairfax' } },
                y: { title: { display: true, text: '$/Acre' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}