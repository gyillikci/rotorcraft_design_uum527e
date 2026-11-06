// Run the sizing for both concepts and write JSON consumed by cad/build_cad.py
// Usage: node sizing/run_sizing.js [pax] [rangeKm] [cruiseKt]
const fs = require("fs");
const path = require("path");
const S = require("./sizing.js");

const [pax = 16, rangeKm = 800, cruiseKt = 145] = process.argv.slice(2).map(Number);
const outDir = path.join(__dirname, "..", "cad");
fs.mkdirSync(outDir, { recursive: true });

for (const concept of ["single", "coax"]) {
  const s = S.size({ pax, rangeKm, cruiseKt, concept });
  const { curve, ...rest } = s;
  const summary = {
    concept, label: s.label, req: s.req,
    MTOW_kg: +s.W.toFixed(0), empty_kg: +s.We.toFixed(0), fuel_kg: +s.fuel.toFixed(0),
    rotor_diameter_m: +s.D.toFixed(2), disk_loading_kg_m2: +s.DL.toFixed(1),
    solidity: +s.sigma.toFixed(3), blades_per_rotor: s.Nb, chord_m: +s.chord.toFixed(3),
    hover_power_kW: +(s.Phov / 1e3).toFixed(0), installed_power_kW: +(s.Pinst / 1e3).toFixed(0),
    Vmax_kt: +(s.Vmax / S.KT).toFixed(0), Vcruise_kt: +(s.Vcr / S.KT).toFixed(0),
    Dvalue_m: +s.geometry.dims.Dvalue.toFixed(2), overall_height_m: +s.geometry.dims.overallHeight.toFixed(2),
  };
  fs.writeFileSync(path.join(outDir, `sizing_${concept}.json`),
    JSON.stringify({ summary, geometry: rest.geometry }, null, 2));
  console.log(summary);
}
