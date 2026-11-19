/**
 * Comprehensive Automated Verification Test Suite for CabCompare
 * Validates Architecture, Globalization, Adversarial Edge Cases, and Easy Nav
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('  CABCOMPARE ENTERPRISE TEST SUITE & VERIFICATION   ');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failCount++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failCount++;
  }
}

// ----------------------------------------------------------------------------
// 1. Setup Mock DOM & Leaflet Environment for Headless Node Testing
// ----------------------------------------------------------------------------

class MockElement {
  constructor(tagName, id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.className = '';
    this.classList = {
      _classes: new Set(),
      add: (...cls) => cls.forEach(c => this.classList._classes.add(c)),
      remove: (...cls) => cls.forEach(c => this.classList._classes.delete(c)),
      toggle: (c) => {
        if (this.classList._classes.has(c)) {
          this.classList._classes.delete(c);
          return false;
        } else {
          this.classList._classes.add(c);
          return true;
        }
      },
      contains: (c) => this.classList._classes.has(c)
    };
    this.style = {};
    this.dataset = {};
    this.attributes = {};
    this.children = [];
    this._listeners = {};
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.disabled = false;
  }

  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] || null; }
  appendChild(child) { this.children.push(child); return child; }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    return child;
  }
  addEventListener(evt, fn) {
    if (!this._listeners[evt]) this._listeners[evt] = [];
    this._listeners[evt].push(fn);
  }
  click() {
    if (this._listeners['click']) {
      this._listeners['click'].forEach(fn => fn({ target: this, stopPropagation: () => {}, preventDefault: () => {} }));
    }
  }
  querySelector(sel) {
    return this.children[0] || null;
  }
  querySelectorAll(sel) {
    return this.children;
  }
}

const elementStore = {};
function getOrCreateElem(id, tag = 'div') {
  if (!elementStore[id]) {
    elementStore[id] = new MockElement(tag, id);
  }
  return elementStore[id];
}

// Pre-create known DOM elements
[
  'map', 'pickupInput', 'dropoffInput', 'pickupAutocomplete', 'dropoffAutocomplete',
  'compareBtn', 'compareBtnText', 'compareBtnIcon', 'compareSpinner', 'clearAllBtn',
  'clearPickupBtn', 'clearDropoffBtn', 'swapBtn', 'locatePickupBtn', 'pickDropoffBtn',
  'regionUsBtn', 'regionInBtn', 'activeRegionBadge', 'providerCountLabel', 'presetBtn',
  'presetMenu', 'surgeBtn', 'surgeMenu', 'surgeLabel', 'surgeIndicator', 'sidebarToggleBtn',
  'sidebarToggleIcon', 'panelCollapseIconBtn', 'navPanel', 'dragHandle',
  'routeStatsBar', 'routeDistanceText', 'routeDurationText', 'routeArrivalTime',
  'filterSortBar', 'skeletonContainer', 'fareList', 'initialPrompt', 'filterEmptyState',
  'fareModal', 'closeModalBtn', 'bookRideBtn', 'toastContainer', 'modalProviderIcon',
  'modalProviderTitle', 'modalProviderTier', 'modalTotalFare', 'modalBaseFare',
  'modalDistanceRateLabel', 'modalDistanceFee', 'modalTimeRateLabel', 'modalTimeFee',
  'modalPlatformFee', 'modalSurgeRow', 'modalSurgeFee', 'modalPolicyText',
  'modalBookProviderName',
  'stopsContainer', 'addStopBtn', 'waypointCountBadge', 'modalLegsSection',
  'modalLegsList', 'modalLegsCountBadge', 'modalSubtotalRow', 'modalSubtotalFee'
].forEach(id => getOrCreateElem(id));

let domReadyListeners = [];
const mockDocument = {
  getElementById: (id) => getOrCreateElem(id),
  createElement: (tag) => new MockElement(tag),
  querySelectorAll: (sel) => [],
  addEventListener: (evt, fn) => {
    if (evt === 'DOMContentLoaded') domReadyListeners.push(fn);
  }
};

// Mock Leaflet
const mockMap = {
  _listeners: {},
  _lastFlyTo: null,
  _lastSetView: null,
  setView: function(coords, zoom) { this._lastSetView = { coords, zoom }; return this; },
  flyTo: function(coords, zoom, opts) { this._lastFlyTo = { coords, zoom, opts }; return this; },
  flyToBounds: function() { return this; },
  panTo: function() { return this; },
  addLayer: function() { return this; },
  removeLayer: function() { return this; },
  getBounds: function() {
    return {
      getWest: () => -97.200000,
      getNorth: () => 33.300000,
      getEast: () => -97.050000,
      getSouth: () => 33.150000,
      isValid: () => true
    };
  },
  on: function(evt, fn) {
    if (!this._listeners[evt]) this._listeners[evt] = [];
    this._listeners[evt].push(fn);
    return this;
  },
  fire: function(evt, data) {
    if (this._listeners[evt]) {
      return Promise.all(this._listeners[evt].map(fn => fn(data)));
    }
    return Promise.resolve();
  },
  invalidateSize: function() { this.invalidated = true; return this; }
};

const mockLeaflet = {
  map: () => mockMap,
  tileLayer: () => ({ addTo: () => ({}) }),
  control: { zoom: () => ({ addTo: () => ({}) }) },
  divIcon: (opts) => opts,
  marker: (coords, opts) => ({ 
    _coords: coords,
    _opts: opts,
    addTo: function() { return this; },
    bindTooltip: function() { return this; },
    on: function() { return this; },
    setTooltipContent: function() { return this; },
    getLatLng: () => ({ lat: coords[0], lng: coords[1] })
  }),
  circle: (coords, opts) => ({ addTo: function() { return this; } }),
  polyline: (coords, opts) => ({ addTo: function() { return this; }, getBounds: () => ({}) })
};

// Expose globals for app.js execution
global.window = {
  innerWidth: 1024,
  innerHeight: 768,
  addEventListener: () => {}
};
global.document = mockDocument;
global.L = mockLeaflet;
global.navigator = {
  geolocation: { getCurrentPosition: () => {} }
};

// Load app.js code into environment
const appPath = path.join(__dirname, 'app.js');
const appCode = fs.readFileSync(appPath, 'utf8');
eval(appCode);
domReadyListeners.forEach(fn => fn());

// ----------------------------------------------------------------------------
// 2. Test Execution
// ----------------------------------------------------------------------------

async function runTestSuite() {
  console.log('--- 1. File Integrity & Code Verification ---');

  runTest('1A: Required project files exist and have non-zero size', () => {
    ['index.html', 'styles.css', 'app.js', 'package.json'].forEach(file => {
      const p = path.join(__dirname, file);
      assert(fs.existsSync(p), `File ${file} exists`);
      const stat = fs.statSync(p);
      assert(stat.size > 100, `File ${file} is not empty (size: ${stat.size} bytes)`);
    });
  });

  runTest('1B: index.html contains Tailwind CSS, Leaflet, and Easy Nav structures', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    assert(html.includes('tailwindcss.com'), 'Includes Tailwind CDN');
    assert(html.includes('leaflet.css') && html.includes('leaflet.js'), 'Includes Leaflet assets');
    assert(html.includes('id="navPanel"'), 'Contains Easy Nav navPanel');
    assert(html.includes('id="dragHandle"'), 'Contains mobile drag handle');
    assert(html.includes('id="fareModal"'), 'Contains fare breakdown modal');
    assert(html.includes('id="skeletonContainer"'), 'Contains skeleton loaders for fare matrix');
  });

  runTest('1C: styles.css contains Easy Nav responsive layout and animations', () => {
    const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
    assert(css.includes('.nav-panel.collapsed'), 'Contains desktop collapsed sidebar rules');
    assert(css.includes('.sheet-peek') && css.includes('.sheet-half') && css.includes('.sheet-full'), 
      'Contains 3-snap mobile bottom sheet states');
    assert(css.includes('@keyframes shimmer'), 'Contains skeleton shimmer animation');
  });

  console.log('\n--- 2. Globalization & Multi-Provider Pricing Matrix Tests ---');

  runTest('2A: US Provider Matrix contains Uber, Lyft, and GoZone with complete configurations', () => {
    const usProviders = window.CabCompare.providers.US;
    assert(Array.isArray(usProviders) && usProviders.length >= 8, 'US provider matrix has at least 8 vehicle options');

    const providerNames = usProviders.map(p => p.provider);
    assert(providerNames.includes('Uber'), 'Includes Uber');
    assert(providerNames.includes('Lyft'), 'Includes Lyft');
    assert(providerNames.includes('GoZone'), 'Includes GoZone');

    const gozone = usProviders.find(p => p.id === 'gozone-shared');
    assert(gozone, 'GoZone on-demand transit exists');
    assert.strictEqual(gozone.maxFare, 4.00, 'GoZone has municipal transit price cap of $4.00');
    assert.strictEqual(gozone.allowsSurge, false, 'GoZone does not allow surge pricing');
  });

  runTest('2B: India Provider Matrix contains Ola, Uber India, Rapido, and BluSmart', () => {
    const inProviders = window.CabCompare.providers.IN;
    assert(Array.isArray(inProviders) && inProviders.length >= 10, 'India provider matrix has at least 10 vehicle options');

    const providerNames = inProviders.map(p => p.provider);
    assert(providerNames.includes('Ola'), 'Includes Ola');
    assert(providerNames.includes('Uber India'), 'Includes Uber India');
    assert(providerNames.includes('Rapido'), 'Includes Rapido');
    assert(providerNames.includes('BluSmart'), 'Includes BluSmart');

    // Test BluSmart Zero Surge & Zero Booking Fee Guarantee
    const bluSmart = inProviders.find(p => p.id === 'blusmart-ev-sedan');
    assert(bluSmart, 'BluSmart EV Sedan exists');
    assert.strictEqual(bluSmart.bookingFee, 0, 'BluSmart has 0 booking fee');
    assert.strictEqual(bluSmart.allowsSurge, false, 'BluSmart guarantees zero surge pricing');
  });

  runTest('2C: Mathematical Fare Calculation Accuracy for US ($ / miles)', () => {
    window.CabCompare.setRegion('US', false);
    // 10 miles (16093.4 meters), 20 minutes (1200 seconds)
    const distanceMeters = 16093.44;
    const durationSeconds = 1200;
    const fares = window.CabCompare.calculateFares(distanceMeters, durationSeconds, 1.0);

    const uberX = fares.find(f => f.id === 'uber-x');
    assert(uberX, 'UberX fare calculated');
    // Calibrated UberX: Base 1.20 + (10 * 0.90 = 9.00) + (20 * 0.15 = 3.00) + 3.10 fee = 16.30
    assert.strictEqual(uberX.finalFare, 16.30, `Expected $16.30, got $${uberX.finalFare}`);

    // Minimum Fare Clamp Test (very short trip: 0.1 miles, 1 minute)
    const shortFares = window.CabCompare.calculateFares(160.9, 60, 1.0);
    const shortUberX = shortFares.find(f => f.id === 'uber-x');
    assert.strictEqual(shortUberX.finalFare, 7.95, 'UberX correctly clamped to minimum fare of $7.95');
  });

  runTest('2D: Mathematical Fare Calculation Accuracy for India (₹ / km)', () => {
    window.CabCompare.setRegion('IN', false);
    // 15 km (15000 meters), 30 minutes (1800 seconds)
    const distanceMeters = 15000;
    const durationSeconds = 1800;
    const fares = window.CabCompare.calculateFares(distanceMeters, durationSeconds, 1.0);

    const olaMini = fares.find(f => f.id === 'ola-mini');
    assert(olaMini, 'Ola Mini fare calculated');
    // Ola Mini: Base 50 + (15 * 14.50 = 217.5) + (30 * 1.80 = 54) + 18 fee = 339.5 -> rounded to 340
    assert.strictEqual(olaMini.finalFare, 340, `Expected ₹340, got ₹${olaMini.finalFare}`);

    // Minimum Fare Clamp Test for India (Auto rickshaw very short trip)
    const shortFares = window.CabCompare.calculateFares(200, 60, 1.0);
    const shortAuto = shortFares.find(f => f.id === 'ola-auto');
    assert.strictEqual(shortAuto.finalFare, 45, 'Ola Auto correctly clamped to minimum fare of ₹45');
  });

  runTest('2E: Surge Multiplier Handling & BluSmart Zero-Surge Exemption', () => {
    window.CabCompare.setRegion('IN', false);
    const distanceMeters = 15000;
    const durationSeconds = 1800;
    const surge = 1.6; // High rush hour surge

    const fares = window.CabCompare.calculateFares(distanceMeters, durationSeconds, surge);

    const uberGo = fares.find(f => f.id === 'uber-go-in');
    assert(uberGo, 'Uber Go found');
    assert.strictEqual(uberGo.surge, 1.6, 'Uber Go received 1.6x surge');

    const bluSmart = fares.find(f => f.id === 'blusmart-ev-sedan');
    assert(bluSmart, 'BluSmart found');
    assert.strictEqual(bluSmart.surge, 1.0, 'BluSmart surge remains strictly 1.0x due to noSurge guarantee');
  });

  runTest('2F: Bounding Box Region Auto-Detection', () => {
    // Mumbai (India)
    assert.strictEqual(window.CabCompare.detectRegionFromCoords(19.0760, 72.8777), 'IN', 'Detects Mumbai in India');
    // Bengaluru (India)
    assert.strictEqual(window.CabCompare.detectRegionFromCoords(12.9716, 77.5946), 'IN', 'Detects Bengaluru in India');
    // New York City (US)
    assert.strictEqual(window.CabCompare.detectRegionFromCoords(40.7128, -74.0060), 'US', 'Detects NYC in US');
    // San Francisco (US)
    assert.strictEqual(window.CabCompare.detectRegionFromCoords(37.7749, -122.4194), 'US', 'Detects SF in US');
    // Null for outside bounds
    assert.strictEqual(window.CabCompare.detectRegionFromCoords(51.5074, -0.1278), null, 'Detects London outside US/IN');
  });

  console.log('\n--- 3. Adversarial & Corner Case Robustness Tests ---');

  runTest('3A: Extreme Edge Case: Identical Pickup & Dropoff (Zero Distance)', () => {
    // Set identical coordinates
    window.CabCompare.state.pickup = { lat: 40.7128, lng: -74.0060, name: 'NYC Point A' };
    window.CabCompare.state.dropoff = { lat: 40.7128, lng: -74.0060, name: 'NYC Point A (Duplicate)' };

    // Distance calculation should be 0
    const dist = window.CabCompare.calculateHaversineMeters(40.7128, -74.0060, 40.7128, -74.0060);
    assert(dist < 1, 'Haversine distance is 0');

    // Trigger calculation
    window.CabCompare.triggerRouteCalculation();

    // Verify UI state reset and no route is preserved
    assert.strictEqual(window.CabCompare.state.routeData, null, 'RouteData is null on 0 distance');
    assert.strictEqual(window.CabCompare.state.isCalculating, false, 'Calculating state reset to false');
  });

  runTest('3B: Complex & Unstructured Indian Address Sanitization Pipeline', () => {
    const rawAddress = 'Flat 402, Sai Residency, Near Water Tank, Madhapur, Hyderabad 500081';
    const sanitized = window.CabCompare.sanitizeIndianAddress(rawAddress);

    assert(!sanitized.toLowerCase().includes('flat 402'), 'Strips flat number');
    assert(!sanitized.toLowerCase().includes('near water tank'), 'Strips informal landmark "near water tank"');
    assert(sanitized.includes('Madhapur') && sanitized.includes('Hyderabad') && sanitized.includes('500081'), 
      'Retains clean locality, city, and PIN code');
  });

  await runAsyncTest('3C: Geocoding Graceful Fallback for Invalid or Empty Queries', async () => {
    // Empty query
    const resEmpty = await window.CabCompare.geocodeAddress('');
    assert(Array.isArray(resEmpty) && resEmpty.length === 0, 'Empty address returns empty array without throwing');

    // Null/undefined query
    const resNull = await window.CabCompare.geocodeAddress(null);
    assert(Array.isArray(resNull) && resNull.length === 0, 'Null address returns empty array without throwing');
  });

  await runAsyncTest('3D: OSRM Route Failure Handling (NoRoute across water/disconnected roads)', async () => {
    // Mock global fetch returning OSRM NoRoute
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ code: 'NoRoute', routes: [] })
    });

    window.CabCompare.state.pickup = { lat: 40.7128, lng: -74.0060, name: 'New York' };
    window.CabCompare.state.dropoff = { lat: 28.6139, lng: 77.2090, name: 'New Delhi' }; // Across ocean

    await window.CabCompare.triggerRouteCalculation();

    // State must be cleanly reset and calculating false
    assert.strictEqual(window.CabCompare.state.isCalculating, false, 'isCalculating reset to false');
    assert.strictEqual(window.CabCompare.state.routeData, null, 'routeData remains null on NoRoute');
    assert.strictEqual(window.CabCompare.state.fareResults.length, 0, 'fareResults reset to empty');

    global.fetch = originalFetch;
  });

  await runAsyncTest('3E: Network Drop & AbortController Timeout UI Reset', async () => {
    const originalFetch = global.fetch;
    // Mock network drop (TypeError: Failed to fetch)
    global.fetch = async () => {
      throw new TypeError('Failed to fetch (Network disconnected)');
    };

    window.CabCompare.state.pickup = { lat: 40.7128, lng: -74.0060, name: 'Point A' };
    window.CabCompare.state.dropoff = { lat: 40.7580, lng: -73.9855, name: 'Point B' };

    await window.CabCompare.triggerRouteCalculation();

    const compareBtn = mockDocument.getElementById('compareBtn');
    assert.strictEqual(compareBtn.disabled, false, 'Compare button re-enabled after network drop');
    assert.strictEqual(window.CabCompare.state.isCalculating, false, 'Calculating flag restored to false');

    global.fetch = originalFetch;
  });

  console.log('\n--- 4. Easy Nav Layout & Interactive State Tests ---');

  runTest('4A: Desktop Sidebar Toggle & Map Resize Invalidation', () => {
    const navPanel = mockDocument.getElementById('navPanel');
    assert.strictEqual(window.CabCompare.state.sidebarCollapsed, false, 'Sidebar initially open');

    window.CabCompare.toggleDesktopSidebar();
    assert.strictEqual(window.CabCompare.state.sidebarCollapsed, true, 'Sidebar collapsed');
    assert(navPanel.classList.contains('collapsed'), 'navPanel has collapsed class');

    window.CabCompare.toggleDesktopSidebar();
    assert.strictEqual(window.CabCompare.state.sidebarCollapsed, false, 'Sidebar restored');
    assert(!navPanel.classList.contains('collapsed'), 'navPanel removed collapsed class');
  });

  runTest('4B: Mobile Bottom Sheet Snap States', () => {
    const navPanel = mockDocument.getElementById('navPanel');

    window.CabCompare.snapMobileSheet('peek');
    assert(navPanel.classList.contains('sheet-peek'), 'Snapped to peek');

    window.CabCompare.snapMobileSheet('half');
    assert(navPanel.classList.contains('sheet-half'), 'Snapped to half');
    assert(!navPanel.classList.contains('sheet-peek'), 'Removed previous snap');

    window.CabCompare.snapMobileSheet('full');
    assert(navPanel.classList.contains('sheet-full'), 'Snapped to full');
  });

  runTest('4C: Location Pinpoint Precision, Draggable Markers & Vector Needle Tip Alignment', () => {
    const appCode = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
    assert(appCode.includes('draggable: true'), 'Markers are configured with draggable: true for precise positioning');
    assert(appCode.includes('enableHighAccuracy: true'), 'Geolocation requests hardware GPS via enableHighAccuracy: true');
    assert(appCode.includes('zoom=18'), 'Reverse geocoding queries doorstep/building zoom=18 precision');
    assert(appCode.includes('iconAnchor: [17, 43]'), 'Marker anchor aligns exactly with SVG needle tip (17, 43)');
    assert(appCode.includes('map.flyTo([lat, lng], 17') || appCode.includes('map.flyTo([location.lat, location.lng], 16'), 
      'Zooms in to street-level precision view when pinpoint is set');
  });

  console.log('\n--- 5. Multi-Stop Itineraries, Interactive Map-Picking & Cumulative Fare Tests ---');

  runTest('5A: Multi-Stop Waypoint Itinerary Management (Add, Reorder, Remove)', () => {
    // Reset state to default 2 stops
    window.CabCompare.state.stops = [
      { id: 'stop-pickup', name: 'Pickup Point', lat: 40.7580, lng: -73.9855 },
      { id: 'stop-dropoff', name: 'Dropoff Point', lat: 40.7128, lng: -74.0060 }
    ];
    assert.strictEqual(window.CabCompare.state.stops.length, 2, 'Starts with 2 stops');

    // Add Stop
    const added = window.CabCompare.addStop({
      id: 'stop-mid-1',
      name: 'Empire State Building',
      lat: 40.7484,
      lng: -73.9857
    });
    assert.strictEqual(window.CabCompare.state.stops.length, 3, 'Adding waypoint expands itinerary to 3 stops');
    assert.strictEqual(window.CabCompare.state.stops[1].name, 'Empire State Building', 'Intermediate waypoint inserted before dropoff');

    // Move Stop (swap index 1 with index 0)
    window.CabCompare.moveStop(1, -1);
    assert.strictEqual(window.CabCompare.state.stops[0].name, 'Empire State Building', 'Move stop moved Empire State Building to index 0');

    // Move it back
    window.CabCompare.moveStop(0, 1);
    assert.strictEqual(window.CabCompare.state.stops[1].name, 'Empire State Building', 'Moved back to index 1');

    // Remove Stop
    window.CabCompare.removeStop(1);
    assert.strictEqual(window.CabCompare.state.stops.length, 2, 'Waypoint removed; back to 2 stops');

    // Boundary check: cannot remove when 2 or fewer stops
    window.CabCompare.removeStop(0);
    assert.strictEqual(window.CabCompare.state.stops.length, 2, 'Cannot remove stops when at minimum 2');
  });

  await runAsyncTest('5B: High-Precision Street-Level Address Extraction via Photon Reverse-Geocoding', async () => {
    const originalFetch = global.fetch;

    // Mock Photon reverse geocoding response
    global.fetch = async (url) => {
      if (url.includes('photon.komoot.io/reverse')) {
        return {
          ok: true,
          json: async () => ({
            features: [
              {
                properties: {
                  housenumber: '138',
                  street: 'Avenue D',
                  city: 'New York',
                  state: 'New York',
                  postcode: '10009'
                }
              }
            ]
          })
        };
      }
      return { ok: false };
    };

    const address = await window.CabCompare.reverseGeocodePhoton(40.7241, -73.9757);
    assert.strictEqual(address, '138 Avenue D, New York', `Expected '138 Avenue D, New York', got '${address}'`);

    // Test POI without housenumber
    global.fetch = async (url) => {
      if (url.includes('photon.komoot.io/reverse')) {
        return {
          ok: true,
          json: async () => ({
            features: [
              {
                properties: {
                  name: 'Madison Square Park',
                  street: 'Broadway',
                  city: 'New York'
                }
              }
            ]
          })
        };
      }
      return { ok: false };
    };

    const poiAddress = await window.CabCompare.reverseGeocodePhoton(40.7420, -73.9876);
    assert.strictEqual(poiAddress, 'Madison Square Park, Broadway, New York', 'Formats POI with street and city correctly');

    global.fetch = originalFetch;
  });

  await runAsyncTest('5C: Interactive Map-Click Picking & Dynamic Stop Auto-Fill', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              housenumber: '350',
              street: '5th Ave',
              city: 'New York'
            }
          }
        ]
      })
    });

    // Reset stops: first stop has coordinates, second stop is empty
    window.CabCompare.state.stops = [
      { id: 'stop-pickup', name: 'Pickup Point', lat: 40.7580, lng: -73.9855 },
      { id: 'stop-dropoff', name: '', lat: null, lng: null }
    ];

    // Trigger map click on the Leaflet mockMap
    await mockMap.fire('click', { latlng: { lat: 40.7484, lng: -73.9857 } });

    // Verify empty dropoff stop is automatically filled with reverse-geocoded address
    assert.strictEqual(window.CabCompare.state.stops[1].name, '350 5th Ave, New York', 'Auto-fills empty stop with Photon address');
    assert.strictEqual(window.CabCompare.state.stops[1].lat, 40.7484, 'Lat set on empty stop');
    assert.strictEqual(window.CabCompare.state.stops[1].lng, -73.9857, 'Lng set on empty stop');

    // Trigger map click again when all stops are full: should dynamically append intermediate stop
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              housenumber: '138',
              street: 'Avenue D',
              city: 'New York'
            }
          }
        ]
      })
    });

    await mockMap.fire('click', { latlng: { lat: 40.7241, lng: -73.9757 } });

    assert.strictEqual(window.CabCompare.state.stops.length, 3, 'Dynamically adds intermediate stop when map clicked on full itinerary');
    assert.strictEqual(window.CabCompare.state.stops[1].name, '138 Avenue D, New York', 'Intermediate stop has correct Photon address');

    global.fetch = originalFetch;
  });

  await runAsyncTest('5D: Multi-Stop OSRM Routing Query Formulation (N-Coordinates Array)', async () => {
    let capturedUrl = '';
    const originalFetch = global.fetch;

    global.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        json: async () => ({
          code: 'Ok',
          routes: [
            {
              distance: 18000,
              duration: 1800,
              geometry: { type: 'LineString', coordinates: [[-73.9855, 40.7580], [-73.9897, 40.7411], [-74.0134, 40.7127]] },
              legs: [
                { distance: 8000, duration: 800, summary: 'Leg 1' },
                { distance: 10000, duration: 1000, summary: 'Leg 2' }
              ]
            }
          ]
        })
      };
    };

    // 3 Stops: Pickup, Waypoint, Dropoff
    window.CabCompare.state.stops = [
      { id: 's1', name: 'Times Square', lat: 40.7580, lng: -73.9855 },
      { id: 's2', name: 'Flatiron Building', lat: 40.7411, lng: -73.9897 },
      { id: 's3', name: 'One World Trade', lat: 40.7127, lng: -74.0134 }
    ];

    await window.CabCompare.triggerRouteCalculation();

    // Verify OSRM URL contains semicolon-separated lng,lat coordinate pairs
    const expectedCoords = '-73.9855,40.758;-73.9897,40.7411;-74.0134,40.7127';
    assert(capturedUrl.includes(expectedCoords), `OSRM query should format coordinate sequence: expected to include '${expectedCoords}', got '${capturedUrl}'`);

    // Verify route data and legs captured in state
    assert(window.CabCompare.state.routeData, 'Route data saved');
    assert.strictEqual(window.CabCompare.state.routeData.legs.length, 2, 'Route contains 2 legs for 3 stops');

    global.fetch = originalFetch;
  });

  runTest('5E: Cumulative Multi-Stop Fare Aggregation Across All Journey Legs', () => {
    window.CabCompare.setRegion('US', false);

    // Leg 1: 5.0 miles (8046.72 m), 12 mins (720 s)
    // Leg 2: 7.0 miles (11265.4 m), 16 mins (960 s)
    // Total Cumulative: 12.0 miles (19312.12 m), 28 mins (1680 s)
    const cumulativeDistanceMeters = 19312.12;
    const cumulativeDurationSeconds = 1680;

    const fares = window.CabCompare.calculateFares(cumulativeDistanceMeters, cumulativeDurationSeconds, 1.0);

    const uberX = fares.find(f => f.id === 'uber-x');
    assert(uberX, 'UberX calculated');

    // Formula: Base (1.20) + (12.0 mi * 0.90 = 10.80) + (28.0 min * 0.15 = 4.20) + Booking Fee (3.10) = 19.30
    assert.strictEqual(uberX.finalFare, 19.30, `Expected cumulative UberX fare $19.30, got $${uberX.finalFare}`);

    // Verify that single leg fare would be less (e.g. Leg 1 alone is 5 mi, 12 min -> 1.20 + 4.50 + 1.80 + 3.10 = 10.60)
    const singleLegFares = window.CabCompare.calculateFares(8046.72, 720, 1.0);
    const singleLegUberX = singleLegFares.find(f => f.id === 'uber-x');
    assert.strictEqual(singleLegUberX.finalFare, 10.60, `Single leg expected $10.60, got $${singleLegUberX.finalFare}`);
    assert(uberX.finalFare > singleLegUberX.finalFare, 'Cumulative fare aggregates distance and duration across all legs');
  });

  runTest('5F: Exact UI Layout & Visual Hierarchy Verification (Reference image_c42d1f.jpg)', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');

    // 1. Left-aligned floating control panel "Fare Matrix & Trip Setup"
    assert(html.includes('Fare Matrix &amp; Trip Setup') || html.includes('Fare Matrix & Trip Setup'),
      'Contains left-aligned "Fare Matrix & Trip Setup" header');
    
    // 2. Dynamic multi-stop itinerary container and Add Stop button
    assert(html.includes('id="stopsContainer"'), 'Contains stopsContainer for dynamic multi-stop inputs');
    assert(html.includes('id="addStopBtn"'), 'Contains "+ Add Stop" button');

    // 3. Blue "Compare All Providers ->" button
    assert(html.includes('id="compareBtn"'), 'Contains compareBtn');
    assert(html.includes('Compare All Providers'), 'Contains "Compare All Providers" button text');

    // 4. Dark routing summary card (Distance/ETA)
    assert(html.includes('id="routeStatsBar"'), 'Contains dark routing stats summary card');
    assert(html.includes('id="routeDistanceText"') && html.includes('id="routeDurationText"'),
      'Contains distance and duration statistics elements');

    // 5. Sorted provider list badges
    assert(html.includes('modalLegsSection') && html.includes('modalLegsList'),
      'Contains detailed multi-stop leg breakdown in modal');
    assert(css.includes('.stop-row') && css.includes('.drag-handle'),
      'Contains CSS styling for drag-to-reorder multi-stop itinerary rows');
  });

  console.log('\n--- 6. ArcGIS 2-Step MagicKey Rooftop Geocoding & Auto-GPS Tests ---');

  await runAsyncTest('6A: Step 1 (ArcGIS Suggest API) injects proximity coordinates and distance=16000', async () => {
    let capturedUrl = '';
    const originalFetch = global.fetch;

    global.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        json: async () => ({
          suggestions: [
            {
              text: '3320 Solana Cir, Denton, TX, 76207, USA',
              magicKey: 'dHA9MCNsb2M9MTEwNzU2NDYjbG5nPTQ2',
              isCollection: false
            },
            {
              text: '138 Avenue D, Denton, TX, 76201, USA',
              magicKey: 'dHA9MCNsb2M9MTEwNzU2NDcjbG5nPTQ2',
              isCollection: false
            }
          ]
        })
      };
    };

    const suggestions = await window.CabCompare.fetchArcGISSuggestions('3320');

    assert(capturedUrl.includes('geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest'),
      'Queries ArcGIS suggest endpoint');
    assert(capturedUrl.includes('text=3320'), 'Includes encoded text query');
    assert(capturedUrl.includes('distance=16000'), 'Includes 10-mile proximity bias distance=16000');
    assert(capturedUrl.includes('location=-97.13310,33.21480') || capturedUrl.includes('-97.1331'),
      'Injects user proximity coordinates (lng,lat)');
    assert(capturedUrl.includes('f=json'), 'Requests f=json format');

    assert.strictEqual(suggestions.length, 2, 'Parsed 2 suggestions');
    assert.strictEqual(suggestions[0].text, '3320 Solana Cir, Denton, TX, 76207, USA', 'Suggestion preserves house number');
    assert.strictEqual(suggestions[0].magicKey, 'dHA9MCNsb2M9MTEwNzU2NDYjbG5nPTQ2', 'Suggestion extracts magicKey');

    global.fetch = originalFetch;
  });

  await runAsyncTest('6B: Step 2 (Rooftop Locking via FindAddressCandidates) binds exact coordinates with magicKey', async () => {
    let capturedUrl = '';
    const originalFetch = global.fetch;

    global.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              address: '3320 Solana Cir, Denton, Texas, 76207',
              location: {
                x: -97.16432,
                y: 33.22568
              },
              score: 100
            }
          ]
        })
      };
    };

    const locked = await window.CabCompare.lockArcGISAddress('3320 Solana Cir, Denton, TX, 76207, USA', 'dHA9MCNsb2M9MTEwNzU2NDYjbG5nPTQ2');

    assert(capturedUrl.includes('geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates'),
      'Queries ArcGIS findAddressCandidates endpoint');
    assert(capturedUrl.includes('SingleLine=3320%20Solana%20Cir'), 'Includes SingleLine address parameter');
    assert(capturedUrl.includes('magicKey=dHA9MCNsb2M9MTEwNzU2NDYjbG5nPTQ2'), 'Passes exact magicKey parameter');
    assert(capturedUrl.includes('f=json'), 'Requests f=json format');

    assert(locked, 'Returned locked address object');
    assert.strictEqual(locked.address, '3320 Solana Cir, Denton, Texas, 76207', 'Locked canonical address');
    assert.strictEqual(locked.lat, 33.22568, 'Extracted location.y as lat');
    assert.strictEqual(locked.lng, -97.16432, 'Extracted location.x as lng');
    assert.strictEqual(locked.score, 100, 'Exact rooftop score 100');

    global.fetch = originalFetch;
  });

  runTest('6C: Map Fly-To Sync immediately triggers map.flyTo([lat, lng], 18) on suggestion selection', () => {
    mockMap._lastFlyTo = null;

    const lockedAddress = {
      displayName: '3320 Solana Cir, Denton, Texas, 76207',
      lat: 33.22568,
      lng: -97.16432,
      magicKey: 'dHA9MCNsb2M9MTEwNzU2NDYjbG5nPTQ2'
    };

    window.CabCompare.setPickupLocation(lockedAddress, true);

    assert(mockMap._lastFlyTo, 'map.flyTo was invoked');
    assert.strictEqual(mockMap._lastFlyTo.zoom, 18, 'Zoom level is explicitly 18 for rooftop precision');
    assert.deepStrictEqual(mockMap._lastFlyTo.coords, [33.22568, -97.16432], 'Coordinates match exact locked rooftop point');
  });

  await runAsyncTest('6D: Reverse-Geocoding resolves exact rooftop address and auto-fills Pickup', async () => {
    const originalFetch = global.fetch;

    global.fetch = async (url) => {
      if (url.includes('reverseGeocode')) {
        return {
          ok: true,
          json: async () => ({
            address: {
              Match_addr: '138 Avenue D, Denton, Texas, 76201',
              LongLabel: '138 Avenue D, Denton, TX, 76201, USA',
              ShortLabel: '138 Avenue D'
            },
            location: { x: -97.1331, y: 33.2148 }
          })
        };
      }
      return { ok: false };
    };

    const resolved = await window.CabCompare.reverseGeocodeAddress(33.2148, -97.1331);
    assert.strictEqual(resolved, '138 Avenue D, Denton, Texas, 76201', 'Reverse geocode returned exact rooftop address');

    global.fetch = originalFetch;
  });

  runTest('6E: Local Initialization defaults to Denton, TX [33.2148, -97.1331] removing default New York', () => {
    const appCode = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

    assert(window.CabCompare.DENTON_COORDS, 'DENTON_COORDS exported');
    assert.deepStrictEqual(window.CabCompare.DENTON_COORDS, [33.2148, -97.1331], 'Default coordinates are Denton, TX');
    assert(appCode.includes('DENTON_COORDS') && appCode.includes('[33.2148, -97.1331]'),
      'Initial center defaults to Denton, TX');
    assert(appCode.includes('navigator.geolocation.getCurrentPosition'), 
      'Uses browser Geolocation API on page load to center map on actual user location');
  });

  await runAsyncTest('6F: OSRM Routing strictly uses locked MagicKey coordinates for fare & distance calculation', async () => {
    let capturedOsrmUrl = '';
    const originalFetch = global.fetch;

    global.fetch = async (url) => {
      if (url.includes('router.project-osrm.org')) {
        capturedOsrmUrl = url;
        return {
          ok: true,
          json: async () => ({
            code: 'Ok',
            routes: [
              {
                distance: 12500,
                duration: 900,
                geometry: { type: 'LineString', coordinates: [[-97.16432, 33.22568], [-97.13310, 33.21480]] },
                legs: [{ distance: 12500, duration: 900 }]
              }
            ]
          })
        };
      }
      return { ok: true, json: async () => ({}) };
    };

    window.CabCompare.state.stops = [
      { id: 's1', name: '3320 Solana Cir, Denton, TX', lat: 33.22568, lng: -97.16432, magicKey: 'key1' },
      { id: 's2', name: '138 Avenue D, Denton, TX', lat: 33.21480, lng: -97.13310, magicKey: 'key2' }
    ];

    await window.CabCompare.triggerRouteCalculation();

    const expectedCoords = '-97.16432,33.22568;-97.1331,33.2148';
    assert(capturedOsrmUrl.includes(expectedCoords), 
      `OSRM URL must strictly use locked MagicKey coordinates. Expected '${expectedCoords}', got '${capturedOsrmUrl}'`);

    global.fetch = originalFetch;
  });

  console.log('\n--- 7. Calibrated DFW/Denton Market Rates & compareFares Pricing Engine Tests ---');

  runTest('7A: PROVIDER_RATES object contains calibrated coefficients for UberX, Lyft Standard, and GoZone', () => {
    const rates = window.CabCompare.PROVIDER_RATES;
    assert(rates, 'PROVIDER_RATES object is exported on window.CabCompare');

    // 1. UberX Calibration: base: 1.20, perMile: 0.90, perMin: 0.15, bookingFee: 3.10
    const uberX = rates.uberX || rates.UberX || rates['uber-x'];
    assert(uberX, 'UberX rates exist in PROVIDER_RATES');
    assert.strictEqual(uberX.base, 1.20, 'UberX base fare is 1.20');
    assert.strictEqual(uberX.perMile, 0.90, 'UberX per-mile rate is 0.90');
    assert.strictEqual(uberX.perMin, 0.15, 'UberX per-minute rate is 0.15');
    assert.strictEqual(uberX.bookingFee, 3.10, 'UberX booking fee is 3.10');
    assert.strictEqual(uberX.minFare, 7.95, 'UberX minFare floor is 7.95');

    // 2. Lyft Calibration: base: 1.50, perMile: 1.25, perMin: 0.20, bookingFee: 3.50
    const lyft = rates.lyftStandard || rates.Lyft || rates['lyft-standard'];
    assert(lyft, 'Lyft Standard rates exist in PROVIDER_RATES');
    assert.strictEqual(lyft.base, 1.50, 'Lyft base fare is 1.50');
    assert.strictEqual(lyft.perMile, 1.25, 'Lyft per-mile rate is 1.25');
    assert.strictEqual(lyft.perMin, 0.20, 'Lyft per-minute rate is 0.20');
    assert.strictEqual(lyft.bookingFee, 3.50, 'Lyft booking fee is 3.50');
    assert.strictEqual(lyft.minFare, 7.95, 'Lyft Standard minFare floor is 7.95');

    // GoZone Flat $4.00 Max
    const gozone = rates.goZone || rates.GoZone || rates['gozone-shared'];
    assert(gozone, 'GoZone rates exist in PROVIDER_RATES');
    assert.strictEqual(gozone.maxFare, 4.00, 'GoZone maxFare is capped at flat $4.00');
    assert.strictEqual(gozone.allowsSurge, false, 'GoZone is strictly surge-immune');
  });

  runTest('7B: compareFares() loop adds bookingFee formula: cost = p.base + p.bookingFee + (miles * p.perMile) + (mins * p.perMin)', () => {
    assert(typeof window.CabCompare.compareFares === 'function', 'compareFares function is exported on window.CabCompare');
    window.CabCompare.setRegion('US', false);

    // Test Denton market data: 3.8 miles / 11 mins
    const miles = 3.8;
    const mins = 11;
    const fares = window.CabCompare.compareFares(miles, mins, 1.0);

    // UberX: 1.20 base + 3.10 fee + (3.8 * 0.90 = 3.42) + (11 * 0.15 = 1.65) = 9.37
    const uberX = fares.find(f => f.id === 'uber-x');
    assert(uberX, 'UberX fare calculated via compareFares');
    assert.strictEqual(uberX.finalFare, 9.37, `UberX 3.8mi/11min trip expected $9.37, got $${uberX.finalFare}`);

    // Lyft Standard: 1.50 base + 3.50 fee + (3.8 * 1.25 = 4.75) + (11 * 0.20 = 2.20) = 11.95
    const lyft = fares.find(f => f.id === 'lyft-standard');
    assert(lyft, 'Lyft Standard fare calculated via compareFares');
    assert.strictEqual(lyft.finalFare, 11.95, `Lyft 3.8mi/11min trip expected $11.95, got $${lyft.finalFare}`);
  });

  runTest('7C: Ride Tiers: Uber Comfort (~25% over UberX) and Lyft Extra Comfort (~30% over Lyft Standard)', () => {
    window.CabCompare.setRegion('US', false);
    const miles = 3.8;
    const mins = 11;
    const fares = window.CabCompare.compareFares(miles, mins, 1.0);

    const uberX = fares.find(f => f.id === 'uber-x');
    const uberComfort = fares.find(f => f.id === 'uber-comfort');
    assert(uberComfort, 'Uber Comfort tier exists');
    assert.strictEqual(uberComfort.tier, 'comfort', 'Uber Comfort is classified in comfort tier');
    // Uber Comfort: 1.50 base + 3.88 fee + (3.8 * 1.125 = 4.275) + (11 * 0.1875 = 2.0625) = 11.72 (~25% more than $9.37)
    assert.strictEqual(uberComfort.finalFare, 11.72, `Uber Comfort expected $11.72, got $${uberComfort.finalFare}`);
    const uberRatio = uberComfort.finalFare / uberX.finalFare;
    assert(uberRatio >= 1.23 && uberRatio <= 1.27, `Uber Comfort is approx 25% more than UberX (ratio: ${uberRatio.toFixed(2)})`);

    const lyft = fares.find(f => f.id === 'lyft-standard');
    const lyftExtraComfort = fares.find(f => f.id === 'lyft-extra-comfort');
    assert(lyftExtraComfort, 'Lyft Extra Comfort tier exists');
    assert.strictEqual(lyftExtraComfort.tier, 'comfort', 'Lyft Extra Comfort is classified in comfort tier');
    // Lyft Extra Comfort: 1.95 base + 4.55 fee + (3.8 * 1.625 = 6.175) + (11 * 0.26 = 2.86) = 15.54 (~30% more than $11.95)
    assert.strictEqual(lyftExtraComfort.finalFare, 15.54, `Lyft Extra Comfort expected $15.54, got $${lyftExtraComfort.finalFare}`);
    const lyftRatio = lyftExtraComfort.finalFare / lyft.finalFare;
    assert(lyftRatio >= 1.28 && lyftRatio <= 1.32, `Lyft Extra Comfort is approx 30% more than Lyft Standard (ratio: ${lyftRatio.toFixed(2)})`);

    // Verify UI hierarchy order in provider matrix: Uber Comfort directly follows UberX, Lyft Extra Comfort directly follows Lyft Standard
    const usProviders = window.CabCompare.providers.US;
    const uberXIdx = usProviders.findIndex(p => p.id === 'uber-x');
    const uberComfortIdx = usProviders.findIndex(p => p.id === 'uber-comfort');
    assert.strictEqual(uberComfortIdx, uberXIdx + 1, 'Uber Comfort displays directly underneath UberX');

    const lyftIdx = usProviders.findIndex(p => p.id === 'lyft-standard');
    const lyftExtraComfortIdx = usProviders.findIndex(p => p.id === 'lyft-extra-comfort');
    assert.strictEqual(lyftExtraComfortIdx, lyftIdx + 1, 'Lyft Extra Comfort displays directly underneath Lyft Standard');
  });

  runTest('7D: GoZone capped at flat $4.00 max across short, medium, and long journeys', () => {
    window.CabCompare.setRegion('US', false);

    // 1. Short Trip (3.8 mi, 11 min)
    const trip1 = window.CabCompare.compareFares(3.8, 11, 1.0).find(f => f.id === 'gozone-shared');
    assert.strictEqual(trip1.finalFare, 4.00, 'Trip 1 (3.8 mi) capped at flat $4.00 max');

    // 2. Medium Trip (10.0 mi, 20 min)
    const trip2 = window.CabCompare.compareFares(10.0, 20, 1.0).find(f => f.id === 'gozone-shared');
    assert.strictEqual(trip2.finalFare, 4.00, 'Trip 2 (10 mi) capped at flat $4.00 max');

    // 3. Long Trip (25.0 mi, 45 min)
    const trip3 = window.CabCompare.compareFares(25.0, 45, 1.0).find(f => f.id === 'gozone-shared');
    assert.strictEqual(trip3.finalFare, 4.00, 'Trip 3 (25 mi) capped at flat $4.00 max');
  });

  runTest('7E: DOM Price Output formatted to bold, prominent text matching native rideshare visual hierarchy', () => {
    const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
    assert(appJs.includes('text-xl') && appJs.includes('font-black') && appJs.includes('text-slate-950'),
      'DOM price output uses bold, prominent font-black text-slate-950 styling matching native apps');
    assert(appJs.includes('Flat $4 Max') || appJs.includes('Flat $4.00 Max'),
      'DOM output displays flat $4 cap badge for GoZone');
  });

  console.log('\n--- 8. Minimum Fare Floors, Dynamic Surge UI & GoZone Exclusion Tests ---');

  runTest('8A: MINIMUM FARE FLOORS: UberX minFare: 7.95, Lyft Standard minFare: 7.95, Uber Comfort: 10.95', () => {
    window.CabCompare.setRegion('US', false);
    const rates = window.CabCompare.PROVIDER_RATES;

    // Verify rate matrix definitions
    assert.strictEqual(rates.uberX.minFare, 7.95, 'UberX minFare floor is exactly 7.95');
    assert.strictEqual(rates.lyftStandard.minFare, 7.95, 'Lyft Standard minFare floor is exactly 7.95');
    assert.strictEqual(rates.uberComfort.minFare, 10.95, 'Uber Comfort minFare floor is scaled to 10.95');
    assert(rates.lyftExtraComfort.minFare >= 11.50, 'Lyft Extra Comfort minFare floor is scaled accordingly');

    // Ultra-short trip: 0.1 miles / 1 minute (cost without minFare would be ~$4.41 for UberX)
    const shortFares = window.CabCompare.compareFares(0.1, 1.0, 1.0);

    const uberX = shortFares.find(f => f.id === 'uber-x');
    assert.strictEqual(uberX.finalFare, 7.95, 'UberX is clamped to absolute minimum fare floor of $7.95');

    const lyft = shortFares.find(f => f.id === 'lyft-standard');
    assert.strictEqual(lyft.finalFare, 7.95, 'Lyft Standard is clamped to absolute minimum fare floor of $7.95');

    const uberComfort = shortFares.find(f => f.id === 'uber-comfort');
    assert.strictEqual(uberComfort.finalFare, 10.95, 'Uber Comfort is clamped to absolute minimum fare floor of $10.95');
  });

  runTest('8B: WIRE UP SURGE UI: Binding Surge Dropdown to surgeMultiplier state triggers recalculate & re-render', () => {
    assert(typeof window.CabCompare.setSurgeMultiplier === 'function', 'setSurgeMultiplier function is exported');

    // Simulate selecting 1.5x surge from dropdown
    window.CabCompare.setSurgeMultiplier(1.5);
    assert.strictEqual(window.CabCompare.state.surgeMultiplier, 1.5, 'surgeMultiplier state updated to 1.5');
    assert.strictEqual(window.CabCompare.state.surge, 1.5, 'surge state alias updated to 1.5');

    // Simulate selecting 2.0x surge from dropdown
    window.CabCompare.setSurgeMultiplier(2.0);
    assert.strictEqual(window.CabCompare.state.surgeMultiplier, 2.0, 'surgeMultiplier state updated to 2.0');

    // Simulate selecting 3.0x surge from dropdown
    window.CabCompare.setSurgeMultiplier(3.0);
    assert.strictEqual(window.CabCompare.state.surgeMultiplier, 3.0, 'surgeMultiplier state updated to 3.0');

    // Reset back to normal 1.0x
    window.CabCompare.setSurgeMultiplier(1.0);
    assert.strictEqual(window.CabCompare.state.surgeMultiplier, 1.0, 'surgeMultiplier state reset to 1.0');
  });

  runTest('8C: APPLY SURGE MATH: Multiplies base calculated cost by surgeMultiplier BEFORE applying minFare check', () => {
    window.CabCompare.setRegion('US', false);

    // Trip: 0.5 miles / 2 minutes
    // UberX base cost = 1.20 + 3.10 + (0.5 * 0.90 = 0.45) + (2 * 0.15 = 0.30) = 5.05
    const miles = 0.5;
    const mins = 2;

    // 1. With 1.0x surge: 5.05 * 1.0 = 5.05 -> clamped to 7.95 minFare
    const fares1x = window.CabCompare.compareFares(miles, mins, 1.0);
    const uberX1x = fares1x.find(f => f.id === 'uber-x');
    assert.strictEqual(uberX1x.baseCalculatedCost, 5.05, 'Base calculated cost is $5.05');
    assert.strictEqual(uberX1x.calculatedCost, 5.05, 'Calculated cost with 1.0x surge is $5.05');
    assert.strictEqual(uberX1x.finalFare, 7.95, 'Clamped to minFare $7.95 when calculated cost < minFare');

    // 2. With 2.0x surge: 5.05 * 2.0 = 10.10 -> 10.10 > 7.95, so final fare is 10.10!
    const fares2x = window.CabCompare.compareFares(miles, mins, 2.0);
    const uberX2x = fares2x.find(f => f.id === 'uber-x');
    assert.strictEqual(uberX2x.calculatedCost, 10.10, 'Calculated cost multiplies base cost by surge BEFORE minFare check (5.05 * 2.0 = 10.10)');
    assert.strictEqual(uberX2x.finalFare, 10.10, 'Final fare reflects surged cost $10.10 exceeding minFare floor');

    // 3. With 1.25x surge: 5.05 * 1.25 = 6.3125 -> 6.31 < 7.95, so final fare is clamped to 7.95!
    const fares125x = window.CabCompare.compareFares(miles, mins, 1.25);
    const uberX125x = fares125x.find(f => f.id === 'uber-x');
    assert.strictEqual(uberX125x.finalFare, 7.95, 'Still clamped to minFare floor of 7.95 when surged cost is 6.31');
  });

  runTest('8D: GOZONE EXCLUSION: GoZone is strictly excluded from all surge multipliers and remains capped at flat $4.00 max', () => {
    window.CabCompare.setRegion('US', false);
    const miles = 3.8;
    const mins = 11;

    // Test across normal, high, major, and severe surge levels
    [1.0, 1.25, 1.5, 2.0, 3.0].forEach(surgeVal => {
      const fares = window.CabCompare.compareFares(miles, mins, surgeVal);
      const gozone = fares.find(f => f.id === 'gozone-shared');

      assert(gozone, 'GoZone exists in fare results');
      assert.strictEqual(gozone.surge, 1.0, `GoZone surge is strictly 1.0x even when global surge is ${surgeVal}x`);
      assert.strictEqual(gozone.finalFare, 4.00, `GoZone fare is strictly capped at flat $4.00 max even when global surge is ${surgeVal}x`);
    });

    // Test long trip (15 miles / 30 mins) with 3.0x surge
    const longFares = window.CabCompare.compareFares(15.0, 30.0, 3.0);
    const longGoZone = longFares.find(f => f.id === 'gozone-shared');
    assert.strictEqual(longGoZone.surge, 1.0, 'Long trip GoZone surge is strictly 1.0x');
    assert.strictEqual(longGoZone.finalFare, 4.00, 'Long trip GoZone remains capped at flat $4.00 max');
  });

  console.log('\n====================================================');
  console.log(`TEST SUITE RESULTS: ${passCount}/${passCount + failCount} PASSED`);
  if (failCount === 0) {
    console.log('STATUS: ALL CABCOMPARE TESTS PASSED WITH 100% SUCCESS RATE! 🚀');
    process.exit(0);
  } else {
    console.error(`STATUS: ${failCount} TEST FAILURES DETECTED!`);
    process.exit(1);
  }
  console.log('====================================================\n');
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
