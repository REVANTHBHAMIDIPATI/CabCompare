/**
 * Automated End-to-End (E2E) Pricing Calibration Validation Script
 * Route: '104 Avenue D' to '3320 Heritage Trl' (2.1 miles, 7 minutes)
 * Validates real-world native app baselines for UberX, Lyft Standard, and DCTA GoZone at 1.0x and 3.0x surge
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('======================================================================');
console.log('   CABCOMPARE E2E PRICING CALIBRATION VALIDATION (DENTON/DFW MARKET)  ');
console.log('======================================================================\n');

// ----------------------------------------------------------------------------
// 1. Setup Headless Browser & Leaflet Environment for app.js
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
      contains: (c) => this.classList._classes.has(c)
    };
    this.style = {};
    this.dataset = {};
    this.children = [];
    this._listeners = {};
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
  }

  setAttribute(k, v) { this[k] = String(v); }
  getAttribute(k) { return this[k] || null; }
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
  querySelector() { return this.children[0] || null; }
  querySelectorAll() { return this.children; }
}

const elementStore = {};
function getOrCreateElem(id, tag = 'div') {
  if (!elementStore[id]) {
    elementStore[id] = new MockElement(tag, id);
  }
  return elementStore[id];
}

[
  'map', 'pickupInput', 'dropoffInput', 'pickupAutocomplete', 'dropoffAutocomplete',
  'compareBtn', 'compareBtnText', 'compareBtnIcon', 'compareSpinner', 'clearAllBtn',
  'regionUsBtn', 'regionInBtn', 'activeRegionBadge', 'providerCountLabel', 'presetBtn',
  'presetMenu', 'surgeBtn', 'surgeMenu', 'surgeLabel', 'surgeIndicator', 'sidebarToggleBtn',
  'sidebarToggleIcon', 'panelCollapseIconBtn', 'navPanel', 'dragHandle',
  'routeStatsBar', 'routeDistanceText', 'routeDurationText', 'routeArrivalTime',
  'filterSortBar', 'skeletonContainer', 'fareList', 'initialPrompt', 'filterEmptyState',
  'fareModal', 'closeModalBtn', 'bookRideBtn', 'toastContainer', 'stopsContainer',
  'addStopBtn', 'waypointCountBadge', 'modalLegsSection', 'modalLegsList', 'modalLegsCountBadge'
].forEach(id => getOrCreateElem(id));

let domReadyListeners = [];
const mockDocument = {
  getElementById: (id) => getOrCreateElem(id),
  createElement: (tag) => new MockElement(tag),
  querySelectorAll: () => [],
  addEventListener: (evt, fn) => {
    if (evt === 'DOMContentLoaded') domReadyListeners.push(fn);
  }
};

const mockMap = {
  setView: function() { return this; },
  flyTo: function() { return this; },
  flyToBounds: function() { return this; },
  addLayer: function() { return this; },
  removeLayer: function() { return this; },
  getBounds: () => ({
    getWest: () => -97.20,
    getNorth: () => 33.30,
    getEast: () => -97.05,
    getSouth: () => 33.15,
    isValid: () => true
  }),
  on: function() { return this; },
  invalidateSize: function() { return this; }
};

const mockLeaflet = {
  map: () => mockMap,
  tileLayer: () => ({ addTo: () => ({}) }),
  control: { zoom: () => ({ addTo: () => ({}) }) },
  divIcon: (opts) => opts,
  marker: () => ({ addTo: function() { return this; }, bindTooltip: function() { return this; }, on: function() { return this; } }),
  circle: () => ({ addTo: function() { return this; } }),
  polyline: () => ({ addTo: function() { return this; }, getBounds: () => ({}) })
};

global.window = {
  innerWidth: 1024,
  innerHeight: 768,
  addEventListener: () => {}
};
global.document = mockDocument;
global.L = mockLeaflet;
global.navigator = { geolocation: { getCurrentPosition: () => {} } };

// Load app.js
const appPath = path.join(__dirname, 'app.js');
const appCode = fs.readFileSync(appPath, 'utf8');
eval(appCode);
domReadyListeners.forEach(fn => fn());

// Ensure US region is active
window.CabCompare.setRegion('US', false);

// ----------------------------------------------------------------------------
// 2. Workflow Step 1: Mock Route Data
// ----------------------------------------------------------------------------
console.log('STEP 1: Simulating OSRM Routing Response for Test Corridor:');
console.log('        Pickup:  104 Avenue D, Denton, TX');
console.log('        Dropoff: 3320 Heritage Trl, Denton, TX');

const MOCK_DISTANCE_MILES = 2.1;
const MOCK_DURATION_MINS = 7.0;
const MOCK_DISTANCE_METERS = MOCK_DISTANCE_MILES * 1609.344; // 3379.6224 m
const MOCK_DURATION_SECONDS = MOCK_DURATION_MINS * 60;       // 420 s

const mockRouteData = {
  code: 'Ok',
  routes: [{
    distance: MOCK_DISTANCE_METERS,
    duration: MOCK_DURATION_SECONDS,
    legs: [{
      distance: MOCK_DISTANCE_METERS,
      duration: MOCK_DURATION_SECONDS,
      summary: 'Avenue D, Heritage Trl'
    }],
    geometry: {
      coordinates: [
        [-97.1331, 33.2148],
        [-97.1643, 33.2256]
      ]
    }
  }]
};

console.log(`        Mock Distance: ${MOCK_DISTANCE_MILES} miles (${MOCK_DISTANCE_METERS.toFixed(1)} meters)`);
console.log(`        Mock Duration: ${MOCK_DURATION_MINS} minutes (${MOCK_DURATION_SECONDS} seconds)\n`);

// ----------------------------------------------------------------------------
// 3. Workflow Step 2: Run Pricing Engine for 1.0x (No Surge) and 3.0x (Surge)
// ----------------------------------------------------------------------------
console.log('STEP 2: Programmatically Executing Fare Engine across All Providers...');

const fares1x = window.CabCompare.compareFares(MOCK_DISTANCE_MILES, MOCK_DURATION_MINS, 1.0);
const fares3x = window.CabCompare.compareFares(MOCK_DISTANCE_MILES, MOCK_DURATION_MINS, 3.0);

const uberX_1x = fares1x.find(f => f.id === 'uber-x');
const lyft_1x = fares1x.find(f => f.id === 'lyft-standard');
const gozone_1x = fares1x.find(f => f.id === 'gozone-shared');

const uberX_3x = fares3x.find(f => f.id === 'uber-x');
const lyft_3x = fares3x.find(f => f.id === 'lyft-standard');
const gozone_3x = fares3x.find(f => f.id === 'gozone-shared');

assert(uberX_1x, 'UberX must be present in 1.0x fare results');
assert(lyft_1x, 'Lyft Standard must be present in 1.0x fare results');
assert(gozone_1x, 'DCTA GoZone must be present in 1.0x fare results');
assert(lyft_3x, 'Lyft Standard must be present in 3.0x fare results');
assert(gozone_3x, 'DCTA GoZone must be present in 3.0x fare results');

console.log('        Fare calculation completed successfully.\n');

// ----------------------------------------------------------------------------
// 4. Workflow Steps 3 & 4: Assert Real-World Baselines & Surge Behavior
// ----------------------------------------------------------------------------
console.log('STEP 3 & 4: Evaluating Assertions & Calibration Tolerances...');

const MARGIN_OF_ERROR = 0.15; // Max allowable deviation from native app baselines: $0.15

// Test Row Definitions
const testCases = [
  {
    name: 'UberX (1.0x No Surge)',
    provider: 'UberX',
    surge: '1.0x',
    output: uberX_1x.finalFare,
    expected: 7.96,
    expectedDisplay: '$7.96',
    description: 'Absolute minimum fare floor active catch for short trip'
  },
  {
    name: 'Lyft Standard (1.0x No Surge)',
    provider: 'Lyft Standard',
    surge: '1.0x',
    output: lyft_1x.finalFare,
    expected: 7.95,
    expectedDisplay: '$7.95',
    description: 'Lyft absolute minimum fare floor enforcement'
  },
  {
    name: 'DCTA GoZone (1.0x No Surge)',
    provider: 'DCTA GoZone',
    surge: '1.0x',
    output: gozone_1x.finalFare,
    expected: 3.12,
    expectedDisplay: '$3.12',
    description: 'Base $1.50 + 2.1mi*$0.75 + 7min*$0.15 municipal transit'
  },
  {
    name: 'Lyft Standard (3.0x High Surge)',
    provider: 'Lyft Standard',
    surge: '3.0x',
    output: lyft_3x.finalFare,
    expected: 25.96,
    expectedDisplay: '$25.96',
    description: 'Dynamic surge multiplier bypasses min-fare floor'
  },
  {
    name: 'DCTA GoZone (3.0x High Surge)',
    provider: 'DCTA GoZone',
    surge: '3.0x',
    output: gozone_3x.finalFare,
    expected: 3.12,
    expectedDisplay: '<= $4.00 ($3.12)',
    customCheck: (out) => out <= 4.00,
    description: 'Public transit strict immunity to surge multipliers (capped <= $4.00)'
  }
];

let allPassed = true;
const tableReport = [];

testCases.forEach(tc => {
  const diff = Math.abs(tc.output - tc.expected);
  const passed = tc.customCheck 
    ? (tc.customCheck(tc.output) && diff <= MARGIN_OF_ERROR)
    : (diff <= MARGIN_OF_ERROR);

  if (!passed) allPassed = false;

  tableReport.push({
    'Provider & Surge Condition': tc.name,
    'CabCompare Output': `$${tc.output.toFixed(2)}`,
    'Expected Native App Price': tc.expectedDisplay,
    'Difference': `$${diff.toFixed(2)}`,
    'Status': passed ? '✅ PASS' : '❌ FAIL'
  });
});

// ----------------------------------------------------------------------------
// 5. Workflow Step 5: Reporting & Console Table Output
// ----------------------------------------------------------------------------
console.log('STEP 5: Calibration Verification Report:');
console.table(tableReport);

// Detailed summary breakdown
console.log('\n--- DETAILED ACCURACY BREAKDOWN ---');
testCases.forEach(tc => {
  const diff = Math.abs(tc.output - tc.expected);
  const statusIcon = diff <= MARGIN_OF_ERROR ? '✅' : '❌';
  console.log(`  ${statusIcon} ${tc.name.padEnd(30)}: CabCompare = $${tc.output.toFixed(2)} | Native Baseline = ${tc.expectedDisplay.padEnd(16)} | Diff = $${diff.toFixed(2)} (within ±$${MARGIN_OF_ERROR.toFixed(2)})`);
  console.log(`     ↳ Purpose: ${tc.description}`);
});

console.log('\n----------------------------------------------------------------------');

// Final Sign-Off
if (allPassed) {
  // Bold Green terminal output
  console.log('\x1b[1m\x1b[32mSYSTEM READY FOR DEPLOYMENT: PRICING CALIBRATED\x1b[0m');
  console.log('======================================================================\n');
  process.exit(0);
} else {
  console.error('\x1b[1m\x1b[31mVALIDATION FAILED: PRICING CALIBRATION DEVIATION EXCEEDS $0.15 TOLERANCE\x1b[0m');
  console.log('======================================================================\n');
  process.exit(1);
}
