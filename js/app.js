// ===================== FOOD DATABASE =====================
// Load custom DB from localStorage or use default
let FOODS_DB = loadFoodsDB();

function loadFoodsDB() {
  try {
    const saved = localStorage.getItem('newProjectDiet_foodsDB');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return JSON.parse(JSON.stringify(DEFAULT_FOODS_DB));
}

function saveFoodsDB() {
  localStorage.setItem('newProjectDiet_foodsDB', JSON.stringify(FOODS_DB));
}

let PREF_FOODS = FOODS_DB.filter(f => f.pref);

let CAT = {};
function rebuildCategories() {
  PREF_FOODS = FOODS_DB.filter(f => f.pref);
  const ALL = FOODS_DB;
  CAT = {
    // Legacy categories (kept for tracker)
    proteine: ALL.filter(f => f.prot > 15 && f.carbo < 10),
    carbo: ALL.filter(f => f.carbo > 20 && f.prot < 15),
    verdure: ALL.filter(f => f.kcal < 30 && f.carbo < 10),
    grassi: ALL.filter(f => f.grassi > 30),
    latticini: ALL.filter(f => f.name.match(/Yogurt|Latte|Mozzarella|feta/i)),
    frutta: ALL.filter(f => f.name.match(/Mela|Banana|Mirtilli|Mango/i)),
    snack: ALL.filter(f => f.name.match(/Gallette|Crackers|Fette biscottate/i)),

    // DL-style pools (v2)
    cerealiColazione: ALL.filter(f => f.name.match(/Avena|Cornflakes|Muesli|Fette biscottate|Riso soffiato/i) || (f.name.match(/Cereali/i))),
    protColazione: ALL.filter(f => f.name.match(/Yogurt|Proteine|Latte|Albume/i)),
    grassiColazione: ALL.filter(f => f.name.match(/Cioccolato fondente|mandorle|Noci|Burro arachidi/i)),
    affettatiColazione: ALL.filter(f => f.name.match(/fesa di tacchino|Lonza|Bresaola/i)),
    fruttaSecca: ALL.filter(f => f.name.match(/mandorle|Noci|Burro arachidi/i)),
    cerealiFull: ALL.filter(f => f.name.match(/Riso|Pasta|Couscous|Farro|Polenta|Quinoa|Orzo/i) && !f.name.match(/Gallette|Riso soffiato|Farina/i)),
    protPranzo: ALL.filter(f => f.name.match(/Uov|Albume|Fiocchi di latte|feta|Mozzarella|Ricotta|Parmigiano|Ceci|Fagioli\b|Lenticchie|Pollo|Lonza|Macinato Tacchino|fesa di tacchino|Carne Bovino|Carne Agnello|Carne Suino|Merluzzo|Tonno|Sardine|Salmone|Sgombro/i) && !f.name.match(/Fagiolini/i)),
    protCena: ALL.filter(f => f.name.match(/Pollo|Lonza|Macinato Tacchino|fesa di tacchino|Carne Bovino|Carne Agnello|Carne Suino|Merluzzo|Tonno|Sardine|Salmone|Sgombro/i)),
    verdurePiene: ALL.filter(f => f.name.match(/Fagiolini|Zucchine|Broccoli|Carote|Spinaci|Peperoni|Melanzane|Pomodor/i)),
    insalata: ALL.filter(f => f.name.match(/Insalata/i)),
    condimento: ALL.filter(f => f.name.match(/Olio|Avocado/i)),
    pane: ALL.filter(f => f.name.match(/Pane/i)),
    patate: ALL.filter(f => f.name.match(/Patate/i) && !f.name.match(/Gnocchi/i)),
    gnocchi: ALL.filter(f => f.name.match(/Gnocchi/i)),
    yogurtSpuntino: ALL.filter(f => f.name.match(/Yogurt|Ricotta|Fiocchi di latte/i)),
  };
  // Ensure non-empty fallbacks
  if (CAT.cerealiColazione.length === 0) CAT.cerealiColazione = [{name:'Avena carrefour', kcal:367, carbo:56, prot:14, grassi:7}];
  if (CAT.cerealiFull.length === 0) CAT.cerealiFull = ALL.filter(f => f.carbo > 20 && f.prot < 15);
  if (CAT.protPranzo.length === 0) CAT.protPranzo = CAT.proteine;
  if (CAT.protCena.length === 0) CAT.protCena = CAT.proteine;
  if (CAT.verdurePiene.length === 0) CAT.verdurePiene = CAT.verdure;
  if (CAT.frutta.length === 0) CAT.frutta = [{name:'Mela', kcal:52, carbo:14, prot:0.3, grassi:0.2}];
}
rebuildCategories();

// ===================== DL SUBSTITUTION RULES =====================
const CARB_CONVERSIONS = {
  base: 1.0,     // pasta, riso, farro, cous cous, orzo, quinoa, polenta
  pane: 1.4,     // pane = base * 1.4
  gnocchi: 2.1,  // gnocchi = base * 2.1
  patate: 4.3,   // patate = base * 4.3
};

function getSubstitutions(foodName, grams) {
  const subs = [];
  const fd = FOODS_DB.find(x => x.name === foodName);
  if (!fd) return subs;
  const totalKcal = grams / 100 * fd.kcal;

  // Helper: add kcal-equivalent substitution from a list
  function addKcalEquiv(pool) {
    pool.filter(f => f.name !== foodName).forEach(f => {
      const g = f.kcal > 0 ? r10(totalKcal * 100 / f.kcal, 10, 999) : grams;
      subs.push({name: f.name, grams: g});
    });
  }

  // 1. Carbohydrate sources (pasta, riso, pane, patate, gnocchi) — use conversion factors
  const isBaseCarb = foodName.match(/Riso|Pasta|Couscous|Farro|Polenta|Quinoa|Orzo|Fileia/i) && !foodName.match(/Gallette|Farina/i);
  const isPane = foodName.match(/Pane/i);
  const isPatate = foodName.match(/Patate/i) && !foodName.match(/Gnocchi/i);
  const isGnocchi = foodName.match(/Gnocchi/i);

  if (isBaseCarb || isPane || isPatate || isGnocchi) {
    let baseGrams;
    if (isBaseCarb) baseGrams = grams;
    else if (isPane) baseGrams = grams / CARB_CONVERSIONS.pane;
    else if (isGnocchi) baseGrams = grams / CARB_CONVERSIONS.gnocchi;
    else if (isPatate) baseGrams = grams / CARB_CONVERSIONS.patate;
    [
      ...CAT.cerealiFull.map(f => ({name: f.name, grams: r10(baseGrams, 10, 999)})),
      ...CAT.pane.map(f => ({name: f.name, grams: r10(baseGrams * CARB_CONVERSIONS.pane, 10, 999)})),
      ...CAT.gnocchi.map(f => ({name: f.name, grams: r10(baseGrams * CARB_CONVERSIONS.gnocchi, 10, 999)})),
      ...CAT.patate.map(f => ({name: f.name, grams: r10(baseGrams * CARB_CONVERSIONS.patate, 10, 999)})),
    ].filter(s => s.name !== foodName).forEach(s => subs.push(s));
    return subs;
  }

  // 2. Proteins — all interchangeable (kcal-equiv)
  const isProtein = CAT.protPranzo.some(f => f.name === foodName) || CAT.protCena.some(f => f.name === foodName);
  if (isProtein) {
    const allProteins = [...new Set([...CAT.protPranzo, ...CAT.protCena].map(f => f.name))];
    allProteins.filter(n => n !== foodName).forEach(n => {
      const f = FOODS_DB.find(x => x.name === n);
      if (f && f.kcal > 0) subs.push({name: n, grams: r50(totalKcal * 100 / f.kcal, 50, 999)});
    });
    return subs;
  }

  // 3. Cereali colazione (avena, cornflakes, muesli)
  if (foodName.match(/Avena|Cornflakes|Muesli/i)) {
    addKcalEquiv(CAT.cerealiColazione);
    return subs;
  }

  // 4. Frutta
  if (CAT.frutta.some(f => f.name === foodName)) {
    addKcalEquiv(CAT.frutta);
    return subs;
  }

  // 5. Verdure
  if (CAT.verdurePiene.some(f => f.name === foodName) || CAT.insalata.some(f => f.name === foodName)) {
    addKcalEquiv([...CAT.verdurePiene, ...CAT.insalata]);
    return subs;
  }

  // 6. Frutta secca / grassi colazione (deduplicated)
  if (foodName.match(/mandorle|Noci|Burro arachidi|Cioccolato fondente/i)) {
    const seen = new Set();
    [...CAT.fruttaSecca, ...(CAT.grassiColazione || [])].filter(f => f.name !== foodName && !seen.has(f.name) && (seen.add(f.name), true)).forEach(f => {
      subs.push({name: f.name, grams: f.kcal > 0 ? r10(totalKcal * 100 / f.kcal, 10, 999) : grams});
    });
    return subs;
  }

  // 7. Snack (gallette, crackers, fette biscottate)
  if (foodName.match(/Gallette|Crackers|Fette biscottate/i)) {
    addKcalEquiv(CAT.snack);
    return subs;
  }

  // 8. Yogurt / spuntino
  if (foodName.match(/Yogurt/i)) {
    addKcalEquiv(CAT.yogurtSpuntino);
    return subs;
  }

  // 9. Fat (olio ↔ avocado)
  if (foodName.match(/Olio/i)) {
    subs.push({name: 'Avocado', grams: r10(grams * 4, 10, 999)});
    return subs;
  }
  if (foodName.match(/Avocado/i)) {
    subs.push({name: 'Olio', grams: r10(grams / 4, 5, 30)});
    return subs;
  }

  // 10. Latte
  if (foodName.match(/Latte/i)) {
    const soy = FOODS_DB.find(f => f.name.match(/Latte di soia|Latte soia/i));
    if (soy) subs.push({name: soy.name, grams: grams});
    return subs;
  }

  // 11. Fallback: offer kcal-equivalent from all foods in same macro category
  const mainMacro = fd.prot > fd.carbo && fd.prot > fd.grassi ? 'prot' : fd.carbo > fd.grassi ? 'carbo' : 'grassi';
  FOODS_DB.filter(f => f.name !== foodName).forEach(f => {
    const fm = f.prot > f.carbo && f.prot > f.grassi ? 'prot' : f.carbo > f.grassi ? 'carbo' : 'grassi';
    if (fm === mainMacro) {
      subs.push({name: f.name, grams: f.kcal > 0 ? r10(totalKcal * 100 / f.kcal, 10, 999) : grams});
    }
  });
  return subs;
}

// ===================== WEEKLY FREQUENCY LIMITS (DL rules) =====================
const FREQ_RULES = [
  { id:'carne', label:'Carne', min:0, max:4, match: /Pollo|Lonza|Macinato Tacchino|fesa di tacchino|Carne Bovino|Carne Agnello|Carne Suino/i },
  { id:'carneRossa', label:'Carne Rossa', min:0, max:2, match: /Carne Bovino|Carne Agnello|Carne Suino/i },
  { id:'pesce', label:'Pesce', min:3, max:99, match: /Merluzzo|Tonno|Sardine|Salmone|Sgombro/i },
  { id:'tonno', label:'Tonno scatola', min:0, max:1, match: /Tonno/i },
  { id:'uova', label:'Uova', min:2, max:99, match: /Uov|Albume/i },
  { id:'latticini', label:'Latticini/Formaggi', min:2, max:99, match: /Fiocchi di latte|feta|Mozzarella|Ricotta|Parmigiano|Yogurt|Latte/i },
  { id:'legumi', label:'Legumi', min:2, max:99, match: /Ceci|Fagioli|Lenticchie/i },
  { id:'patate', label:'Patate/Gnocchi', min:0, max:2, match: /Patate|Gnocchi/i },
];

function countWeeklyFrequencies(plans) {
  const counts = {};
  FREQ_RULES.forEach(r => { counts[r.id] = 0; });
  if (!plans) return counts;
  plans.forEach(plan => {
    if (!plan) return;
    const dayUsed = {};
    FREQ_RULES.forEach(r => { dayUsed[r.id] = false; });
    plan.forEach(meal => {
      meal.items.forEach(it => {
        FREQ_RULES.forEach(r => {
          if (r.match.test(it.food) && !dayUsed[r.id]) {
            // Count unique days, not individual items
          }
          if (r.match.test(it.food)) {
            dayUsed[r.id] = true;
          }
        });
      });
    });
    FREQ_RULES.forEach(r => {
      if (dayUsed[r.id]) counts[r.id]++;
    });
  });
  return counts;
}

// ===================== INFO DEFINITIONS =====================
const INFO_DATA = {
  bmr: {
    title: 'BMR - Metabolismo Basale',
    body: 'Il BMR (Basal Metabolic Rate) rappresenta le calorie che il tuo corpo brucia a riposo per mantenere le funzioni vitali: respirazione, circolazione, temperatura corporea, funzioni cerebrali. Viene calcolato con la formula di Mifflin-St Jeor in base a sesso, eta, altezza e peso.'
  },
  tdee: {
    title: 'TDEE - Dispendio Energetico Totale',
    body: 'Il TDEE (Total Daily Energy Expenditure) e il totale delle calorie che bruci in un giorno, includendo il metabolismo basale (BMR) piu le calorie bruciate con l\'attivita fisica. Si calcola moltiplicando il BMR per il fattore di attivita. Rappresenta le calorie necessarie per mantenere il peso attuale.'
  },
  surplus: {
    title: 'Surplus Calorico',
    body: 'Il surplus calorico significa mangiare PIU calorie di quelle che bruci (sopra il TDEE). L\'eccesso viene usato dal corpo per costruire nuova massa muscolare (se ti alleni) o accumulare grasso. Un surplus moderato di +200/+400 kcal e ideale per la fase di massa (bulk) minimizzando l\'accumulo di grasso.'
  },
  mantenimento: {
    title: 'Mantenimento (TDEE)',
    body: 'Il mantenimento calorico significa mangiare esattamente le calorie che bruci (pari al TDEE). Il peso rimane stabile. E utile per fasi di ricomposizione corporea (recomp) dove si cerca di perdere grasso e guadagnare muscolo contemporaneamente, un processo piu lento ma sostenibile.'
  },
  deficit: {
    title: 'Deficit Calorico',
    body: 'Il deficit calorico significa mangiare MENO calorie di quelle che bruci (sotto il TDEE). Il corpo compensa la differenza usando le riserve di grasso come energia. Un deficit moderato di -300/-500 kcal e ideale per perdere grasso (cut) preservando la massa muscolare, soprattutto se le proteine sono mantenute alte.'
  }
};

// ===================== PROFILE STATE =====================
const MEALS = ['Colazione', 'Merenda 1', 'Pranzo', 'Merenda 2', 'Cena'];
const DAY_TYPES = ['work', 'rest', 'test'];

let profile = loadProfile();
let trackerState = loadTrackerState();
let refreshCount = 0;

function loadProfile() {
  try {
    const s = localStorage.getItem('newProjectDiet_profile');
    if (s) {
      const p = JSON.parse(s);
      if (!p.goals) {
        p.goals = buildDefaultGoals(p);
        delete p.customTargetKcal; delete p.customProtGkg; delete p.customGrassiGkg; delete p.customCarboGkg;
      }
      if (p.offDayKcalDelta == null) p.offDayKcalDelta = 300;
      return p;
    }
  } catch(e) {}
  const p = { sesso:'M', eta:30, altezza:175, peso:86.5, attivita:1.55, goal:'deficit', autoAdjustDelta:0, offDayKcalDelta:300 };
  p.goals = buildDefaultGoals(p);
  return p;
}

function buildDefaultGoals(p) {
  const peso = p.peso || 86.5;
  const att = p.attivita || 1.55;
  const eta = p.eta || 30;
  const alt = p.altezza || 175;
  const bmr = p.sesso === 'F' ? 10*peso + 6.25*alt - 5*eta - 161 : 10*peso + 6.25*alt - 5*eta + 5;
  const tdee = Math.round(bmr * att);

  function makeGoal(protGkg, grassiGkg, kcalOffset) {
    const targetKcal = tdee + kcalOffset;
    const prot = peso * protGkg;
    const grassi = peso * grassiGkg;
    const carbo = Math.max(peso * 1.0, (targetKcal - prot*4 - grassi*9) / 4);
    const carboGkg = parseFloat((carbo / peso).toFixed(1));
    return {
      targetKcal, protGkg, grassiGkg, carboGkg,
      on: { protGkg, grassiGkg, carboGkg: parseFloat((carboGkg + 0.5).toFixed(1)) },
      off: { protGkg, grassiGkg, carboGkg }
    };
  }

  return {
    surplus: makeGoal(1.8, 0.9, 300),
    maintenance: makeGoal(2.0, 0.9, 0),
    deficit: makeGoal(2.2, 0.8, -400)
  };
}

function saveProfile() {
  localStorage.setItem('newProjectDiet_profile', JSON.stringify(profile));
}

function loadTrackerState() {
  try {
    const s = localStorage.getItem('newProjectDiet_tracker');
    if (s) return JSON.parse(s);
  } catch(e) {}
  return getDefaultTrackerState();
}

function getDefaultTrackerState() {
  const DEFAULT_CONFIG = {
    work: { peso: 86.5, prot: 2.0, grassi: 0.8, carbo: 2.5, targetKcal: 2200 },
    rest: { peso: 86.5, prot: 2.0, grassi: 1.0, carbo: 1.8, targetKcal: 2050 },
    test: { peso: 86.5, prot: 2.0, grassi: 0.8, carbo: 2.5, targetKcal: 2000 }
  };
  const s = {};
  DAY_TYPES.forEach(day => {
    s[day] = { config: {...DEFAULT_CONFIG[day]}, meals: {} };
    MEALS.forEach(meal => { s[day].meals[meal] = [{ food:'', grams:'' }]; });
  });
  return s;
}

function saveTrackerState() {
  localStorage.setItem('newProjectDiet_tracker', JSON.stringify(trackerState));
}

// ===================== TDEE CALCULATION =====================
function calcTDEE() {
  const { sesso, eta, altezza, peso, attivita } = profile;
  let bmr;
  if (sesso === 'M') {
    bmr = 10 * peso + 6.25 * altezza - 5 * eta + 5;
  } else {
    bmr = 10 * peso + 6.25 * altezza - 5 * eta - 161;
  }
  return Math.round(bmr * attivita);
}

function getGoalSettings() {
  const gs = profile.goals[profile.goal];
  if (!gs.on) gs.on = { protGkg: gs.protGkg, grassiGkg: gs.grassiGkg, carboGkg: parseFloat((gs.carboGkg + 0.5).toFixed(1)) };
  if (!gs.off) gs.off = { protGkg: gs.protGkg, grassiGkg: gs.grassiGkg, carboGkg: gs.carboGkg };
  return gs;
}

function calcTargetKcal() {
  return getGoalSettings().targetKcal + (parseInt(profile.autoAdjustDelta) || 0);
}

function getDefaultMacroGkg() {
  switch(profile.goal) {
    case 'surplus': return { prot:1.8, grassi:0.9, carbo:null };
    case 'maintenance': return { prot:2.0, grassi:0.9, carbo:null };
    case 'deficit': return { prot:2.2, grassi:0.8, carbo:null };
    default: return { prot:2.0, grassi:0.8, carbo:null };
  }
}

function calcMacros(dayTypeOverride) {
  const peso = profile.peso;
  const gs = getGoalSettings();
  const dayType = dayTypeOverride || getDayType();
  const dt = (dayType === 'ON' && gs.on) ? gs.on : (dayType === 'OFF' && gs.off) ? gs.off : gs;
  const prot = peso * (dt.protGkg || gs.protGkg);
  const grassi = peso * (dt.grassiGkg || gs.grassiGkg);
  const carbo = peso * (dt.carboGkg || gs.carboGkg);

  return {
    prot: Math.round(prot),
    grassi: Math.round(grassi),
    carbo: Math.round(carbo),
    kcal: Math.round(prot*4 + grassi*9 + carbo*4)
  };
}

// ===================== PROFILE UI =====================
function updateProfile() {
  profile.sesso = document.getElementById('prof-sesso').value;
  profile.eta = parseInt(document.getElementById('prof-eta').value) || 30;
  profile.altezza = parseInt(document.getElementById('prof-altezza').value) || 175;
  profile.peso = parseFloat(document.getElementById('prof-peso').value) || 80;
  profile.attivita = parseFloat(document.getElementById('prof-attivita').value) || 1.55;
  profile.offDayKcalDelta = (profile.offDayKcalDelta == null ? 300 : parseInt(profile.offDayKcalDelta));
  profile.goals = buildDefaultGoals(profile);
  saveProfile();
  renderResults();
  syncTrackerProfileUI();
  renderTrackerResults();
}

function setGoal(goal) {
  profile.goal = goal;
  document.querySelectorAll('.goal-card').forEach(c => c.classList.remove('active'));
  const card = document.querySelector(`.goal-card.${goal}`);
  if (card) card.classList.add('active');
  saveProfile();
  renderResults();
  renderHomeDashboard();
}

function renderResults() {
  const tdee = calcTDEE();
  const macros = calcMacros();

  const goalLabel = { surplus:'Surplus (+300)', maintenance:'Mantenimento', deficit:'Deficit (-400)' };
  const goalColor = { surplus:'var(--surplus)', maintenance:'var(--maintenance)', deficit:'var(--deficit)' };
  const targetBorder = getDayType() === 'ON' ? '#4fc3f7' : '#ffb74d';

  const gs = getGoalSettings();
  const curProtGkg = gs.protGkg;
  const curGrassiGkg = gs.grassiGkg;
  const curCarboGkg = gs.carboGkg;

  document.getElementById('results-panel').innerHTML = `
    <h2>I Tuoi Numeri</h2>
    <div class="results-grid">
      <div class="result-item">
        <div class="r-label">BMR <span class="info-icon" onclick="showInfo('bmr')">i</span></div>
        <div class="r-value">${Math.round(tdee / profile.attivita)}</div>
        <div class="r-sub">kcal base</div>
      </div>
      <div class="result-item">
        <div class="r-label">TDEE <span class="info-icon" onclick="showInfo('tdee')">i</span></div>
        <div class="r-value">${tdee}</div>
        <div class="r-sub">kcal/giorno</div>
      </div>
      <div class="result-item" style="border:1px solid ${targetBorder}">
        <div class="r-label">Target Kcal</div>
        <div class="r-value" style="color:${targetBorder}">${macros.kcal}</div>
        <div class="r-sub">${getDayType()}</div>
      </div>
      <div class="result-item">
        <div class="r-label">Proteine</div>
        <div class="r-value">${macros.prot}g</div>
        <div class="r-sub">${(macros.prot/profile.peso).toFixed(1)} g/kg</div>
      </div>
      <div class="result-item">
        <div class="r-label">Grassi</div>
        <div class="r-value">${macros.grassi}g</div>
        <div class="r-sub">${(macros.grassi/profile.peso).toFixed(1)} g/kg</div>
      </div>
      <div class="result-item">
        <div class="r-label">Carboidrati</div>
        <div class="r-value">${macros.carbo}g</div>
        <div class="r-sub">${curCarboGkg.toFixed(1)} g/kg</div>
      </div>
    </div>
    <div style="margin-top:16px;padding:14px;background:var(--card2);border-radius:10px;border:1px solid var(--border)">
      <div style="font-size:0.8em;color:var(--text-dim);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px">Personalizza Target per Tipo Giornata</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:280px;padding:10px;border-radius:8px;border:1px solid #4fc3f7;background:rgba(79,195,247,0.05)">
          <div style="font-size:0.75em;font-weight:bold;color:#4fc3f7;margin-bottom:8px;text-transform:uppercase">ON - Allenamento</div>
          <div class="target-grid-onoff">
            <div class="field-group"><label>Prot (g/kg)</label>
              <input type="number" step="0.1" value="${gs.on.protGkg.toFixed(1)}" onchange="updateDayTarget('on','protGkg',this.value)"></div>
            <div class="field-group"><label>Grassi (g/kg)</label>
              <input type="number" step="0.1" value="${gs.on.grassiGkg.toFixed(1)}" onchange="updateDayTarget('on','grassiGkg',this.value)"></div>
            <div class="field-group"><label>Carbo (g/kg)</label>
              <input type="number" step="0.1" value="${gs.on.carboGkg.toFixed(1)}" onchange="updateDayTarget('on','carboGkg',this.value)"></div>
          </div>
          <div style="font-size:0.65em;color:var(--text-dim);margin-top:4px">Kcal ON: <b style="color:#4fc3f7">${Math.round(profile.peso*gs.on.protGkg*4 + profile.peso*gs.on.grassiGkg*9 + profile.peso*gs.on.carboGkg*4)}</b></div>
        </div>
        <div style="flex:1;min-width:280px;padding:10px;border-radius:8px;border:1px solid #ffb74d;background:rgba(255,183,77,0.05)">
          <div style="font-size:0.75em;font-weight:bold;color:#ffb74d;margin-bottom:8px;text-transform:uppercase">OFF - Riposo</div>
          <div class="target-grid-onoff">
            <div class="field-group"><label>Prot (g/kg)</label>
              <input type="number" step="0.1" value="${gs.off.protGkg.toFixed(1)}" onchange="updateDayTarget('off','protGkg',this.value)"></div>
            <div class="field-group"><label>Grassi (g/kg)</label>
              <input type="number" step="0.1" value="${gs.off.grassiGkg.toFixed(1)}" onchange="updateDayTarget('off','grassiGkg',this.value)"></div>
            <div class="field-group"><label>Carbo (g/kg)</label>
              <input type="number" step="0.1" value="${gs.off.carboGkg.toFixed(1)}" onchange="updateDayTarget('off','carboGkg',this.value)"></div>
          </div>
          <div style="font-size:0.65em;color:var(--text-dim);margin-top:4px">Kcal OFF: <b style="color:#ffb74d">${Math.round(profile.peso*gs.off.protGkg*4 + profile.peso*gs.off.grassiGkg*9 + profile.peso*gs.off.carboGkg*4)}</b></div>
        </div>
      </div>
      <div style="font-size:0.65em;color:var(--text-dim);margin-top:8px">Imposta i target separati per giorni di allenamento (ON) e riposo (OFF). Le Kcal si calcolano automaticamente dai macro.</div>
    </div>
  `;

  // Update weekly profile summary
  const wps = document.getElementById('weekly-profile-summary');
  if (wps) {
    wps.innerHTML = `<b>${profile.peso}kg</b> | ${profile.sesso === 'M' ? 'Maschio' : 'Femmina'} | ${profile.eta} anni | TDEE: <b>${tdee}</b> kcal | Obiettivo: <b style="color:${goalColor[profile.goal]}">${goalLabel[profile.goal]}</b> | Target: <b>${macros.kcal}</b> kcal (P:${macros.prot}g G:${macros.grassi}g C:${macros.carbo}g)`;
  }
}

function updateCustomTarget(type, value) {
  const v = parseFloat(value);
  const peso = profile.peso;
  const gs = getGoalSettings();

  switch(type) {
    case 'kcal':
      gs.targetKcal = v > 0 ? Math.round(v) : gs.targetKcal;
      const pKcal = peso * gs.protGkg * 4;
      const gKcal = peso * gs.grassiGkg * 9;
      const remainingC = (gs.targetKcal - pKcal - gKcal) / 4;
      gs.carboGkg = parseFloat((Math.max(0, remainingC) / peso).toFixed(1));
      break;
    case 'prot':
      gs.protGkg = v > 0 ? v : gs.protGkg;
      recalcKcalFromMacros();
      break;
    case 'grassi':
      gs.grassiGkg = v > 0 ? v : gs.grassiGkg;
      recalcKcalFromMacros();
      break;
    case 'carbo':
      gs.carboGkg = v > 0 ? v : gs.carboGkg;
      recalcKcalFromMacros();
      break;
  }
  saveProfile();
  renderResults();
  renderHomeDashboard();
}


function recalcKcalFromMacros() {
  const peso = profile.peso;
  const gs = getGoalSettings();
  gs.targetKcal = Math.round(peso * gs.protGkg * 4 + peso * gs.grassiGkg * 9 + peso * gs.carboGkg * 4);
}

function updateDayTarget(dayKey, field, value) {
  const v = parseFloat(value);
  if (isNaN(v) || v <= 0) return;
  const gs = getGoalSettings();
  gs[dayKey][field] = v;
  saveProfile();
  renderResults();
  if (currentPlan) updateStickyTotals();
  renderHomeDashboard();
  renderTrackerResults();
  renderAllTracker();
  updateTrackerStickyTotals();
}


// ===================== TRACKER PROFILE & RESULTS =====================
function syncTrackerProfileUI() {
  const s = document.getElementById('trk-prof-sesso');
  const e = document.getElementById('trk-prof-eta');
  const a = document.getElementById('trk-prof-altezza');
  const p = document.getElementById('trk-prof-peso');
  const at = document.getElementById('trk-prof-attivita');
  if (!s) return;
  s.value = profile.sesso;
  e.value = profile.eta;
  a.value = profile.altezza;
  p.value = profile.peso;
  at.value = profile.attivita;
}

function updateTrackerProfile() {
  profile.sesso = document.getElementById('trk-prof-sesso').value;
  profile.eta = parseInt(document.getElementById('trk-prof-eta').value) || 30;
  profile.altezza = parseInt(document.getElementById('trk-prof-altezza').value) || 175;
  profile.peso = parseFloat(document.getElementById('trk-prof-peso').value) || 80;
  profile.attivita = parseFloat(document.getElementById('trk-prof-attivita').value) || 1.55;
  profile.goals = buildDefaultGoals(profile);
  saveProfile();
  renderTrackerResults();
  renderAllTracker();
  // Sync Piano Giornaliero profile fields
  const ps = document.getElementById('prof-sesso');
  if (ps) {
    ps.value = profile.sesso;
    document.getElementById('prof-eta').value = profile.eta;
    document.getElementById('prof-altezza').value = profile.altezza;
    document.getElementById('prof-peso').value = profile.peso;
    document.getElementById('prof-attivita').value = profile.attivita;
  }
  renderResults();
}

function renderTrackerResults() {
  const panel = document.getElementById('tracker-results-panel');
  if (!panel) return;

  const tdee = calcTDEE();
  const gs = getGoalSettings();
  const goalLabel = { surplus:'Surplus (+300)', maintenance:'Mantenimento', deficit:'Deficit (-400)' };
  const goalColor = { surplus:'var(--surplus)', maintenance:'var(--maintenance)', deficit:'var(--deficit)' };
  const targetBorder = getDayType() === 'ON' ? '#4fc3f7' : '#ffb74d';

  const onKcal = Math.round(profile.peso*gs.on.protGkg*4 + profile.peso*gs.on.grassiGkg*9 + profile.peso*gs.on.carboGkg*4);
  const offKcal = Math.round(profile.peso*gs.off.protGkg*4 + profile.peso*gs.off.grassiGkg*9 + profile.peso*gs.off.carboGkg*4);

  panel.innerHTML = `
    <h2>I Tuoi Numeri</h2>
    <div class="results-grid">
      <div class="result-item">
        <div class="r-label">BMR <span class="info-icon" onclick="showInfo('bmr')">i</span></div>
        <div class="r-value">${Math.round(tdee / profile.attivita)}</div>
        <div class="r-sub">kcal base</div>
      </div>
      <div class="result-item">
        <div class="r-label">TDEE <span class="info-icon" onclick="showInfo('tdee')">i</span></div>
        <div class="r-value">${tdee}</div>
        <div class="r-sub">kcal/giorno</div>
      </div>
      <div class="result-item" style="border:1px solid #4fc3f7">
        <div class="r-label">Kcal ON</div>
        <div class="r-value" style="color:#4fc3f7">${onKcal}</div>
        <div class="r-sub">Allenamento</div>
      </div>
      <div class="result-item" style="border:1px solid #ffb74d">
        <div class="r-label">Kcal OFF</div>
        <div class="r-value" style="color:#ffb74d">${offKcal}</div>
        <div class="r-sub">Riposo</div>
      </div>
      <div class="result-item">
        <div class="r-label">Proteine ON</div>
        <div class="r-value">${Math.round(profile.peso*gs.on.protGkg)}g</div>
        <div class="r-sub">${gs.on.protGkg.toFixed(1)} g/kg</div>
      </div>
      <div class="result-item">
        <div class="r-label">Proteine OFF</div>
        <div class="r-value">${Math.round(profile.peso*gs.off.protGkg)}g</div>
        <div class="r-sub">${gs.off.protGkg.toFixed(1)} g/kg</div>
      </div>
    </div>
    <div style="margin-top:16px;padding:14px;background:var(--card2);border-radius:10px;border:1px solid var(--border)">
      <div style="font-size:0.8em;color:var(--text-dim);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px">Personalizza Target per Tipo Giornata</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:280px;padding:10px;border-radius:8px;border:1px solid #4fc3f7;background:rgba(79,195,247,0.05)">
          <div style="font-size:0.75em;font-weight:bold;color:#4fc3f7;margin-bottom:8px;text-transform:uppercase">ON - Allenamento</div>
          <div class="target-grid-onoff">
            <div class="field-group"><label>Prot (g/kg)</label>
              <input type="number" step="0.1" value="${gs.on.protGkg.toFixed(1)}" onchange="updateTrackerDayTarget('on','protGkg',this.value)"></div>
            <div class="field-group"><label>Grassi (g/kg)</label>
              <input type="number" step="0.1" value="${gs.on.grassiGkg.toFixed(1)}" onchange="updateTrackerDayTarget('on','grassiGkg',this.value)"></div>
            <div class="field-group"><label>Carbo (g/kg)</label>
              <input type="number" step="0.1" value="${gs.on.carboGkg.toFixed(1)}" onchange="updateTrackerDayTarget('on','carboGkg',this.value)"></div>
          </div>
          <div style="font-size:0.65em;color:var(--text-dim);margin-top:4px">Kcal ON: <b style="color:#4fc3f7">${onKcal}</b></div>
        </div>
        <div style="flex:1;min-width:280px;padding:10px;border-radius:8px;border:1px solid #ffb74d;background:rgba(255,183,77,0.05)">
          <div style="font-size:0.75em;font-weight:bold;color:#ffb74d;margin-bottom:8px;text-transform:uppercase">OFF - Riposo</div>
          <div class="target-grid-onoff">
            <div class="field-group"><label>Prot (g/kg)</label>
              <input type="number" step="0.1" value="${gs.off.protGkg.toFixed(1)}" onchange="updateTrackerDayTarget('off','protGkg',this.value)"></div>
            <div class="field-group"><label>Grassi (g/kg)</label>
              <input type="number" step="0.1" value="${gs.off.grassiGkg.toFixed(1)}" onchange="updateTrackerDayTarget('off','grassiGkg',this.value)"></div>
            <div class="field-group"><label>Carbo (g/kg)</label>
              <input type="number" step="0.1" value="${gs.off.carboGkg.toFixed(1)}" onchange="updateTrackerDayTarget('off','carboGkg',this.value)"></div>
          </div>
          <div style="font-size:0.65em;color:var(--text-dim);margin-top:4px">Kcal OFF: <b style="color:#ffb74d">${offKcal}</b></div>
        </div>
      </div>
      <div style="font-size:0.65em;color:var(--text-dim);margin-top:8px">Imposta i target separati per giorni di allenamento (ON) e riposo (OFF). Le Kcal si calcolano automaticamente dai macro.</div>
    </div>
  `;
}

function updateTrackerDayTarget(dayKey, field, value) {
  const v = parseFloat(value);
  if (isNaN(v) || v <= 0) return;
  const gs = getGoalSettings();
  gs[dayKey][field] = v;
  saveProfile();
  renderTrackerResults();
  renderAllTracker();
  updateTrackerStickyTotals();
  renderResults();
}

function getActiveTrackerDay() {
  const activeBtn = document.querySelector('.tracker-tab-btn.active');
  if (!activeBtn) return 'work';
  if (activeBtn.classList.contains('rest')) return 'rest';
  if (activeBtn.classList.contains('test')) return 'test';
  return 'work';
}

function getTrackerDayTargets(day) {
  const gs = getGoalSettings();
  const peso = profile.peso;
  if (day === 'work') {
    return {
      kcal: Math.round(peso*gs.on.protGkg*4 + peso*gs.on.grassiGkg*9 + peso*gs.on.carboGkg*4),
      prot: Math.round(peso * gs.on.protGkg),
      grassi: Math.round(peso * gs.on.grassiGkg),
      carbo: Math.round(peso * gs.on.carboGkg)
    };
  } else {
    return {
      kcal: Math.round(peso*gs.off.protGkg*4 + peso*gs.off.grassiGkg*9 + peso*gs.off.carboGkg*4),
      prot: Math.round(peso * gs.off.protGkg),
      grassi: Math.round(peso * gs.off.grassiGkg),
      carbo: Math.round(peso * gs.off.carboGkg)
    };
  }
}

function updateTrackerStickyTotals() {
  const bar = document.getElementById('sticky-totals-tracker');
  const inner = document.getElementById('sticky-totals-tracker-inner');
  if (!bar || !inner) return;

  const activePage = document.querySelector('.page.active');
  if (!activePage || activePage.id !== 'page-tracker') { bar.classList.remove('show'); return; }

  const day = getActiveTrackerDay();
  const meals = trackerState[day].meals;
  let totKcal=0, totProt=0, totGrassi=0, totCarbo=0;
  MEALS.forEach(meal => {
    meals[meal].forEach(item => {
      if (item.food && item.grams) {
        const f = FOODS_DB.find(x => x.name === item.food);
        if (f) {
          const g = parseFloat(item.grams)||0;
          totKcal += g/100*f.kcal; totProt += g/100*f.prot;
          totGrassi += g/100*f.grassi; totCarbo += g/100*f.carbo;
        }
      }
    });
  });

  const targets = getTrackerDayTargets(day);
  bar.classList.add('show');

  function miniDonut(label, current, target, color, unit) {
    const pct = target > 0 ? Math.min(current / target, 1.5) : 0;
    const r = 30, cx = 36, cy = 36, stroke = 6;
    const circ = 2 * Math.PI * r;
    const dash = Math.min(pct, 1) * circ;
    const c = pct > 1.05 ? '#ff4444' : pct >= 0.95 ? '#44ff88' : color;
    return `<div class="sticky-donut">
      <svg viewBox="0 0 72 72" width="72" height="72">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="${stroke}"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="${stroke}"
          stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}" stroke-linecap="round"
          transform="rotate(-90 ${cx} ${cy})"/>
        <text x="${cx}" y="${cy - 2}" text-anchor="middle" fill="white" font-size="11" font-weight="bold">${Math.round(current)}${unit||''}</text>
        <text x="${cx}" y="${cy + 10}" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="7">/ ${target}${unit||''}</text>
      </svg>
      <div class="sticky-donut-label">${label}</div>
    </div>`;
  }

  const diff = Math.round(totKcal - targets.kcal);
  const diffStr = diff >= 0 ? '+' + diff : '' + diff;
  const kcColor = Math.abs(diff) <= 50 ? '#44ff88' : diff > 50 ? '#ff4444' : '#ffaa33';

  inner.innerHTML =
    miniDonut('Kcal (' + diffStr + ')', totKcal, targets.kcal, kcColor, '') +
    miniDonut('Proteine', totProt, targets.prot, '#4fc3f7', 'g') +
    miniDonut('Grassi', totGrassi, targets.grassi, '#ffb74d', 'g') +
    miniDonut('Carboidrati', totCarbo, targets.carbo, '#81c784', 'g');
}

function exportTrackerPDF() {
  const day = getActiveTrackerDay();
  const meals = trackerState[day].meals;
  const targets = getTrackerDayTargets(day);
  const dayLabels = { work: 'Work Day (ON)', rest: 'Rest Day (OFF)', test: 'Test Day' };

  let totalKcal=0, totalP=0, totalG=0, totalC=0;
  let tableRows = '';

  MEALS.forEach(meal => {
    let mK=0, mP=0, mG=0, mC=0;
    meals[meal].forEach(item => {
      if (item.food && item.grams) {
        const f = FOODS_DB.find(x => x.name === item.food);
        if (f) {
          const g = parseFloat(item.grams)||0;
          mK+=g/100*f.kcal; mP+=g/100*f.prot; mG+=g/100*f.grassi; mC+=g/100*f.carbo;
        }
      }
    });
    totalKcal+=mK; totalP+=mP; totalG+=mG; totalC+=mC;
    tableRows += `<tr class="meal-header"><td colspan="6">${meal} — ${Math.round(mK)} kcal</td></tr>`;
    meals[meal].forEach(item => {
      if (item.food && item.grams) {
        const f = FOODS_DB.find(x => x.name === item.food);
        tableRows += `<tr>
          <td>${item.food}</td><td class="num">${item.grams}g</td>
          <td class="num">${f ? Math.round(parseFloat(item.grams)/100*f.kcal) : '-'}</td>
          <td class="num">${f ? (parseFloat(item.grams)/100*f.carbo).toFixed(1) : '-'}</td>
          <td class="num">${f ? (parseFloat(item.grams)/100*f.prot).toFixed(1) : '-'}</td>
          <td class="num">${f ? (parseFloat(item.grams)/100*f.grassi).toFixed(1) : '-'}</td>
        </tr>`;
      }
    });
  });

  const diff = Math.round(totalKcal - targets.kcal);
  const diffStr = diff >= 0 ? '+' + diff : '' + diff;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Tracker - ${dayLabels[day]}</title>
<style>
  @page { margin: 15mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #222; max-width: 700px; margin: 0 auto; padding: 20px; }
  h1 { text-align: center; color: #1a237e; font-size: 1.6em; margin-bottom: 4px; }
  .subtitle { text-align: center; color: #666; font-size: 0.9em; margin-bottom: 16px; }
  .summary { display: flex; justify-content: space-around; padding: 12px; background: #f5f5f5; border-radius: 8px; margin-bottom: 16px; }
  .summary div { text-align: center; }
  .summary .val { font-size: 1.3em; font-weight: bold; color: #1a237e; }
  .summary .lbl { font-size: 0.7em; color: #888; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
  th { background: #1a237e; color: white; padding: 6px 8px; text-align: left; font-size: 0.75em; text-transform: uppercase; }
  th.num, td.num { text-align: right; }
  td { padding: 4px 8px; border-bottom: 1px solid #eee; }
  tr.meal-header td { background: #e8eaf6; font-weight: bold; color: #1a237e; padding: 8px; font-size: 0.95em; border-bottom: 2px solid #1a237e; }
  tr:nth-child(even):not(.meal-header) { background: #fafafa; }
  .totals { display: flex; justify-content: space-around; padding: 14px; background: #1a237e; color: white; border-radius: 8px; margin-top: 16px; }
  .totals div { text-align: center; }
  .totals .val { font-size: 1.2em; font-weight: bold; }
  .totals .lbl { font-size: 0.65em; opacity: 0.8; text-transform: uppercase; }
  .footer { text-align: center; margin-top: 20px; font-size: 0.7em; color: #aaa; }
</style></head><body>
<h1>Tracker Manuale - ${dayLabels[day]}</h1>
<div class="subtitle">Peso: ${profile.peso}kg | ${new Date().toLocaleDateString('it-IT')}</div>
<div class="summary">
  <div><div class="val">${targets.kcal}</div><div class="lbl">Target Kcal</div></div>
  <div><div class="val">${targets.prot}g</div><div class="lbl">Proteine</div></div>
  <div><div class="val">${targets.grassi}g</div><div class="lbl">Grassi</div></div>
  <div><div class="val">${targets.carbo}g</div><div class="lbl">Carboidrati</div></div>
</div>
<table>
  <thead><tr><th>Alimento</th><th class="num">Grammi</th><th class="num">Kcal</th><th class="num">Carbo</th><th class="num">Prot</th><th class="num">Grassi</th></tr></thead>
  <tbody>${tableRows}</tbody>
</table>
<div class="totals">
  <div><div class="val">${Math.round(totalKcal)} (${diffStr})</div><div class="lbl">Kcal Totali</div></div>
  <div><div class="val">${Math.round(totalP)}g</div><div class="lbl">Proteine</div></div>
  <div><div class="val">${Math.round(totalG)}g</div><div class="lbl">Grassi</div></div>
  <div><div class="val">${Math.round(totalC)}g</div><div class="lbl">Carboidrati</div></div>
</div>
<div class="footer">Generato da New Project Diet v2</div>
<scr` + `ipt>window.onload = function() { window.print(); }</scr` + `ipt>
</body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

// ===================== MEAL PLAN GENERATOR =====================
function pickRandom(arr, exclude) {
  const filtered = exclude ? arr.filter(f => !exclude.has(f.name)) : arr;
  if (filtered.length === 0) return arr[Math.floor(Math.random() * arr.length)];
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function r10(v, min, max) {
  let r = Math.round(v / 10) * 10;
  if (min != null) r = Math.max(min, r);
  if (max != null) r = Math.min(max, r);
  return r;
}

function calcPlanKcal(plan) {
  let total = 0;
  plan.forEach(meal => {
    meal.items.forEach(it => {
      const f = FOODS_DB.find(x => x.name === it.food);
      if (f) total += it.grams / 100 * f.kcal;
    });
  });
  return total;
}

function r50(v, min, max) {
  let r = Math.round(v / 50) * 50;
  if (min != null) r = Math.max(min, r);
  if (max != null) r = Math.min(max, r);
  return r;
}

// ===================== DL-STYLE PLAN GENERATOR (v2) =====================
// isON = true for workout day, false for rest day
function generateOnePlan(isON, weeklyUsedProteins) {
  if (isON === undefined) isON = getDayType() === 'ON';
  const macros = calcMacros(isON ? 'ON' : 'OFF');
  const target = { kcal: macros.kcal, p: macros.prot, g: macros.grassi, c: macros.carbo };

  // Scale base grams proportionally to target kcal (reference: ~2400 kcal ON, ~2000 kcal OFF)
  const refKcal = isON ? 2400 : 2000;
  const scale = target.kcal / refKcal;
  const protScale = Math.max(0.8, Math.min(1.5, target.p / 150));
  // Carb-specific scale: when protein/fat eat most of kcal budget, carb portions must shrink
  const refCarbs = isON ? 260 : 200;
  const carboScale = Math.max(0.4, Math.min(1.3, target.c / refCarbs));

  // DL reference grams (from scheda at ~2400 kcal)
  const GRAMS = {
    cerealiCol: r10((isON ? 60 : 40) * carboScale, 20, 100),  // avena/cornflakes
    latte: r10(200 * Math.min(scale, carboScale), 100, 300),   // latte a colazione
    whey: r10(25 * protScale, 20, 40),                          // proteine whey
    carboPranzo: r10(80 * carboScale, 50, 130),                 // pasta/riso a pranzo
    carboCena: r10(80 * carboScale, 50, 130),                   // pasta/riso a cena
    crackers: 30,                                                // fisso (1 pacchetto)
    fruttaSecca: r10(10 * scale, 10, 20),                       // mandorle/noci (small portion)
    fruttaCol: r10(150 * carboScale, 80, 150),                  // frutta a colazione
    fruttaMer: r10(100 * carboScale, 60, 100),                  // frutta a merende
    verdura: 200,
    insalata: 80,
    olio: 10,
  };

  const structure = [
    { name:'Colazione', cls:'col' },
    { name:'Merenda 1', cls:'mer1' },
    { name:'Pranzo', cls:'pranzo' },
    { name:'Merenda 2', cls:'mer2' },
    { name:'Cena', cls:'cena' },
  ];

  const used = new Set();
  const plan = [];

  structure.forEach(meal => {
    const items = [];

    if (meal.name === 'Colazione') {
      // Cereali (avena, cornflakes, etc.)
      const cereal = pickRandom(CAT.cerealiColazione, used);
      items.push({ food: cereal.name, grams: GRAMS.cerealiCol }); used.add(cereal.name);
      // Latte (DL scheda: always present at colazione)
      const latteItem = FOODS_DB.find(f => f.name === 'Latte');
      if (latteItem) { items.push({ food: 'Latte', grams: GRAMS.latte }); used.add('Latte'); }
      // Proteine whey
      const wheyItem = FOODS_DB.find(f => f.name.match(/Proteine/i));
      if (wheyItem) { items.push({ food: wheyItem.name, grams: GRAMS.whey }); used.add(wheyItem.name); }
      // Grassi a colazione SOLO in giorno OFF (regola DL: digestione rapida PW)
      if (!isON) {
        const grasso = pickRandom(CAT.grassiColazione, used);
        if (grasso) { items.push({ food: grasso.name, grams: 10 }); used.add(grasso.name); }
      }
      // Frutta
      const frutta = pickRandom(CAT.frutta, used);
      items.push({ food: frutta.name, grams: GRAMS.fruttaCol }); used.add(frutta.name);
    }

    else if (meal.name === 'Merenda 1') {
      // Crackers/gallette (skip when carbs are very tight to save ~22g carbs)
      if (carboScale >= 0.85) {
        const snack = pickRandom(CAT.snack, used);
        if (snack) { items.push({ food: snack.name, grams: GRAMS.crackers }); used.add(snack.name); }
      }
      // Frutta secca
      const fs = pickRandom(CAT.fruttaSecca, used);
      if (fs) { items.push({ food: fs.name, grams: GRAMS.fruttaSecca }); used.add(fs.name); }
      // Proteine in polvere (15-30g)
      const whey2 = FOODS_DB.find(f => f.name.match(/Proteine/i));
      if (whey2) { items.push({ food: whey2.name, grams: r10(20 * protScale, 15, 30) }); }
      // Frutta
      const frutta = pickRandom(CAT.frutta, used);
      items.push({ food: frutta.name, grams: GRAMS.fruttaMer }); used.add(frutta.name);
    }

    else if (meal.name === 'Pranzo') {
      // Proteina PRANZO: latticini, uova, legumi, carne, pesce — pick first to adjust carbs
      let protPool = CAT.protPranzo.filter(f => !used.has(f.name));
      if (weeklyUsedProteins) {
        const lessUsed = protPool.filter(f => !weeklyUsedProteins.has(f.name));
        if (lessUsed.length > 0) protPool = lessUsed;
      }
      const protSrc = pickRandom(protPool.length > 0 ? protPool : CAT.protPranzo, used);
      const isLegumi = /Ceci|Fagioli\b|Lenticchie/i.test(protSrc.name);
      // Carbo source — reduced when legumi (they already bring 20-27g carbo/100g)
      const carboSrc = pickRandom(CAT.cerealiFull, used);
      const pranzoCarbo = isLegumi ? r10(GRAMS.carboPranzo * 0.6, Math.max(30, GRAMS.carboPranzo * 0.5), 80) : GRAMS.carboPranzo;
      items.push({ food: carboSrc.name, grams: pranzoCarbo }); used.add(carboSrc.name);
      // Protein portion
      let protGrams;
      if (protSrc.name.match(/Uov/i)) protGrams = r50(120 * protScale, 100, 200);
      else if (protSrc.name.match(/Fiocchi di latte/i)) protGrams = r50(200 * protScale, 150, 300);
      else if (protSrc.name.match(/Mozzarella/i)) protGrams = r50(100 * protScale, 100, 150);
      else if (protSrc.name.match(/feta/i)) protGrams = r50(150 * protScale, 100, 200);
      else if (protSrc.name.match(/Ricotta/i)) protGrams = r50(150 * protScale, 100, 200);
      else if (protSrc.name.match(/Parmigiano/i)) protGrams = r50(40 * protScale, 30, 60);
      else if (isLegumi) protGrams = r50(180 * protScale, 150, 200);
      else if (protSrc.name.match(/Albume/i)) protGrams = r50(200 * protScale, 150, 300);
      else if (protSrc.name.match(/Sardine/i)) protGrams = 65;
      else if (protSrc.name.match(/Merluzzo/i)) protGrams = r50(250 * protScale, 200, 350);
      else if (protSrc.name.match(/Tonno/i)) protGrams = r50(150 * protScale, 100, 250);
      else if (protSrc.name.match(/Salmone|Sgombro/i)) protGrams = r50(150 * protScale, 100, 200);
      else if (protSrc.name.match(/Pollo|Lonza|fesa di tacchino|Macinato Tacchino|Carne Bovino/i)) protGrams = r50(250 * protScale, 200, 350);
      else if (protSrc.name.match(/Carne Agnello|Carne Suino/i)) protGrams = r50(150 * protScale, 100, 250);
      else protGrams = r50(150 * protScale, 50, 300);
      items.push({ food: protSrc.name, grams: protGrams }); used.add(protSrc.name);
      // If sardine (only 65g), add supplementary protein (Albume)
      if (protSrc.name.match(/Sardine/i)) {
        const alb = FOODS_DB.find(f => f.name.match(/Albume/i) && !used.has(f.name));
        if (alb) { items.push({ food: alb.name, grams: r50(150 * protScale, 100, 250) }); used.add(alb.name); }
      }
      // Verdura
      const useInsalata = Math.random() < 0.3 && CAT.insalata.length > 0;
      if (useInsalata) {
        const ins = pickRandom(CAT.insalata, used);
        items.push({ food: ins.name, grams: GRAMS.insalata }); used.add(ins.name);
      } else {
        const verd = pickRandom(CAT.verdurePiene, used);
        items.push({ food: verd.name, grams: GRAMS.verdura }); used.add(verd.name);
      }
      // Olio
      items.push({ food: 'Olio', grams: GRAMS.olio });
    }

    else if (meal.name === 'Merenda 2') {
      // Crackers/gallette (skip when carbs are tight)
      if (carboScale >= 0.85) {
        const cereal = pickRandom([...CAT.snack].filter(f => !used.has(f.name)));
        if (cereal) { items.push({ food: cereal.name, grams: GRAMS.crackers }); used.add(cereal.name); }
      }
      // Yogurt (DL scheda: yogurt greco a merenda 2) — porzione snack
      const yog = pickRandom(CAT.yogurtSpuntino, used);
      if (yog) {
        const yogGrams = r10(150 * Math.min(protScale, carboScale + 0.2), 100, 200);
        items.push({ food: yog.name, grams: yogGrams }); used.add(yog.name);
      }
      // Proteine in polvere (15-30g)
      const whey3 = FOODS_DB.find(f => f.name.match(/Proteine/i));
      if (whey3) { items.push({ food: whey3.name, grams: r10(20 * protScale, 15, 30) }); }
      // Frutta
      const frutta = pickRandom(CAT.frutta, used);
      items.push({ food: frutta.name, grams: GRAMS.fruttaMer }); used.add(frutta.name);
    }

    else if (meal.name === 'Cena') {
      // Carbo source (with DL conversions for patate/pane/gnocchi)
      const rand = Math.random();
      let carboItem, carboGrams;
      if (rand < 0.4) {
        carboItem = pickRandom(CAT.cerealiFull, used);
        carboGrams = GRAMS.carboCena;
      } else if (rand < 0.7 && CAT.patate.length > 0) {
        carboItem = pickRandom(CAT.patate, used);
        carboGrams = r10(GRAMS.carboCena * CARB_CONVERSIONS.patate, 200, 600);
      } else if (rand < 0.85 && CAT.pane.length > 0) {
        carboItem = pickRandom(CAT.pane, used);
        carboGrams = r10(GRAMS.carboCena * CARB_CONVERSIONS.pane, 50, 200);
      } else if (CAT.gnocchi.length > 0) {
        carboItem = pickRandom(CAT.gnocchi, used);
        carboGrams = r10(GRAMS.carboCena * CARB_CONVERSIONS.gnocchi, 100, 400);
      } else {
        carboItem = pickRandom(CAT.cerealiFull, used);
        carboGrams = GRAMS.carboCena;
      }
      items.push({ food: carboItem.name, grams: carboGrams }); used.add(carboItem.name);
      // Proteina CENA: carne/pesce (MAI latticini/legumi)
      let cenaPool = CAT.protCena.filter(f => !used.has(f.name));
      if (weeklyUsedProteins) {
        const lessUsed = cenaPool.filter(f => !weeklyUsedProteins.has(f.name));
        if (lessUsed.length > 0) cenaPool = lessUsed;
      }
      const protSrc = pickRandom(cenaPool.length > 0 ? cenaPool : CAT.protCena, used);
      let protGrams;
      if (protSrc.name.match(/Sardine/i)) protGrams = 65;
      else if (protSrc.name.match(/Merluzzo/i)) protGrams = r50(250 * protScale, 200, 350);
      else if (protSrc.name.match(/Tonno/i)) protGrams = r50(150 * protScale, 100, 250);
      else if (protSrc.name.match(/Salmone|Sgombro/i)) protGrams = r50(150 * protScale, 100, 200);
      else protGrams = r50(250 * protScale, 200, 350);
      items.push({ food: protSrc.name, grams: protGrams }); used.add(protSrc.name);
      // If sardine (only 65g), add supplementary protein (Albume)
      if (protSrc.name.match(/Sardine/i)) {
        const alb = FOODS_DB.find(f => f.name.match(/Albume/i) && !used.has(f.name));
        if (alb) { items.push({ food: alb.name, grams: r50(150 * protScale, 100, 250) }); used.add(alb.name); }
      }
      // Verdura
      const useInsalata = Math.random() < 0.3 && CAT.insalata.length > 0;
      if (useInsalata) {
        const ins = pickRandom(CAT.insalata, used);
        items.push({ food: ins.name, grams: GRAMS.insalata }); used.add(ins.name);
      } else {
        const verd = pickRandom(CAT.verdurePiene, used);
        items.push({ food: verd.name, grams: GRAMS.verdura }); used.add(verd.name);
      }
      // Olio
      items.push({ food: 'Olio', grams: GRAMS.olio });
    }

    plan.push({ ...meal, items });
  });

  // === Global adjustment passes ===
  function calcPlanMacro(p, macro) {
    let tot = 0;
    p.forEach(m => m.items.forEach(it => {
      const fd = FOODS_DB.find(x => x.name === it.food);
      if (fd) tot += it.grams / 100 * fd[macro];
    }));
    return tot;
  }

  // Realistic min/max grams per food type (mins scale down when carb budget is tight)
  const cMin = carboScale < 0.85 ? 0.7 : 1.0; // reduce mins for low-carb targets
  function getMinMax(foodName) {
    if (/Riso|Pasta|Couscous|Farro|Polenta|Quinoa|Orzo|Fileia/i.test(foodName)) return [Math.round(50 * cMin / 10) * 10, 150];
    if (/Pane/i.test(foodName)) return [Math.round(50 * cMin / 10) * 10, 150];
    if (/Patate/i.test(foodName)) return [Math.round(200 * cMin / 10) * 10, 500];
    if (/Gnocchi/i.test(foodName)) return [Math.round(150 * cMin / 10) * 10, 350];
    if (/Pollo|Lonza|fesa di tacchino|Macinato Tacchino|Carne Bovino/i.test(foodName)) return [150, 300];
    if (/Carne Agnello|Carne Suino/i.test(foodName)) return [100, 250];
    if (/Merluzzo/i.test(foodName)) return [150, 300];
    if (/Tonno/i.test(foodName)) return [100, 200];
    if (/Salmone|Sgombro/i.test(foodName)) return [100, 200];
    if (/Mozzarella/i.test(foodName)) return [100, 150];
    if (/feta/i.test(foodName)) return [100, 200];
    if (/Ricotta/i.test(foodName)) return [100, 200];
    if (/Fiocchi di latte/i.test(foodName)) return [Math.round(150 * cMin / 10) * 10, 300];
    if (/Albume/i.test(foodName)) return [100, 250];
    if (/Uov/i.test(foodName)) return [100, 200];
    if (/Ceci|Fagioli|Lenticchie/i.test(foodName)) return [Math.round(100 * cMin / 10) * 10, 200];
    if (/Yogurt/i.test(foodName)) return [Math.round(150 * cMin / 10) * 10, 300];
    if (/Avena|Cornflakes|Muesli|Riso soffiato/i.test(foodName)) return [20, 80];
    if (/Fette biscottate/i.test(foodName)) return [20, 60];
    return [10, 500];
  }

  // Items we never adjust (snack portions, fixed items, whey, frutta secca, grassi colazione)
  const FIXED = /Sardine|Gallette|Crackers|Mela|Banana|Mirtilli|Mango|Latte|Proteine|Insalata|mandorle|Noci|Burro arachidi|Cioccolato fondente|Fette biscottate|Avena|Cornflakes|Muesli|Parmigiano|Olio/i;

  // --- PASS 1: Fat adjustment --- reduce high-fat proteins first, then oil
  let curFat = calcPlanMacro(plan, 'grassi');
  if (curFat > target.g + 5) {
    // First reduce high-fat protein portions (Ricotta, Salmone, Agnello, etc.)
    const fattyItems = [];
    plan.forEach(m => m.items.forEach(it => {
      const fd = FOODS_DB.find(x => x.name === it.food);
      if (fd && fd.grassi > 5 && !FIXED.test(it.food) && it.food !== 'Olio') {
        fattyItems.push({ item: it, fd, fatPer100: fd.grassi });
      }
    }));
    fattyItems.sort((a, b) => b.fatPer100 - a.fatPer100); // reduce fattiest first
    for (const fi of fattyItems) {
      const [minG] = getMinMax(fi.item.food);
      while (fi.item.grams > minG && calcPlanMacro(plan, 'grassi') > target.g + 5) {
        fi.item.grams -= 50;
        if (fi.item.grams < minG) fi.item.grams = minG;
      }
      if (calcPlanMacro(plan, 'grassi') <= target.g + 5) break;
    }
    // Then reduce oil
    for (const m of plan) {
      for (const it of m.items) {
        if (it.food !== 'Olio') continue;
        while (it.grams > 5 && calcPlanMacro(plan, 'grassi') > target.g + 5) { it.grams -= 5; }
      }
    }
  } else if (curFat < target.g - 10) {
    // Increase oil
    for (const m of plan) {
      for (const it of m.items) {
        if (it.food !== 'Olio') continue;
        while (calcPlanMacro(plan, 'grassi') < target.g - 5 && it.grams < 25) { it.grams += 5; }
      }
    }
  }

  // --- PASS 2: Protein adjustment (±25g steps, realistic bounds) ---
  const protItems = [];
  plan.forEach(m => m.items.forEach(it => {
    const fd = FOODS_DB.find(x => x.name === it.food);
    if (fd && fd.prot > 5 && !FIXED.test(it.food) && it.food !== 'Olio') {
      protItems.push({ item: it, fd, efficiency: fd.prot / Math.max(fd.grassi + 0.1, 1) });
    }
  }));
  protItems.sort((a, b) => b.efficiency - a.efficiency); // lean first

  for (let iter = 0; iter < 60; iter++) {
    const pDiff = target.p - calcPlanMacro(plan, 'prot');
    if (Math.abs(pDiff) <= 10) break;
    const pi = protItems[iter % protItems.length];
    if (!pi) break;
    const [minG, maxG] = getMinMax(pi.item.food);
    const step = pDiff > 0 ? 25 : -25;
    const newG = pi.item.grams + step;
    if (newG >= minG && newG <= maxG) { pi.item.grams = newG; }
  }

  // --- PASS 3: CARB adjustment (target carbs directly, ±10g) ---
  const fixedItems = /Gallette|Crackers|Fette biscottate|mandorle|Noci|Burro arachidi|Cioccolato fondente|Mela|Banana|Mirtilli|Mango|Sardine|Proteine|Olio|Latte|Insalata|Avena|Cornflakes|Muesli|Parmigiano/i;
  const carbItems = [];
  plan.forEach(m => m.items.forEach(it => {
    const fd = FOODS_DB.find(x => x.name === it.food);
    if (fd && fd.carbo > 15 && !fixedItems.test(it.food)) carbItems.push(it);
  }));

  // First target carbs (critical for low-carb plans)
  for (let i = 0; i < 120; i++) {
    const cDiff = target.c - calcPlanMacro(plan, 'carbo');
    if (Math.abs(cDiff) <= 10) break;
    const item = carbItems[i % carbItems.length];
    if (!item) break;
    const [minG, maxG] = getMinMax(item.food);
    const step = cDiff > 0 ? 10 : -10;
    const newG = item.grams + step;
    if (newG >= minG && newG <= maxG) { item.grams = newG; }
  }

  // Then fine-tune kcal
  for (let i = 0; i < 60; i++) {
    const diff = target.kcal - calcPlanKcal(plan);
    if (Math.abs(diff) <= 30) break;
    const item = carbItems[i % carbItems.length];
    if (!item) break;
    const [minG, maxG] = getMinMax(item.food);
    const step = diff > 0 ? 10 : -10;
    const newG = item.grams + step;
    if (newG >= minG && newG <= maxG) { item.grams = newG; }
  }

  // --- PASS 4: Final fat re-check (oil only, gentle) ---
  for (const m of plan) {
    for (const it of m.items) {
      if (it.food !== 'Olio') continue;
      while (it.grams > 5 && calcPlanMacro(plan, 'grassi') > target.g + 5) { it.grams -= 5; }
    }
  }

  // --- PASS 5: Final kcal fine-tune (±10g on carbs if still off) ---
  for (let i = 0; i < 40; i++) {
    const diff = target.kcal - calcPlanKcal(plan);
    if (Math.abs(diff) <= 50) break;
    const item = carbItems[i % carbItems.length];
    if (!item) break;
    const [minG, maxG] = getMinMax(item.food);
    const step = diff > 0 ? 10 : -10;
    const newG = item.grams + step;
    if (newG >= minG && newG <= maxG) { item.grams = newG; }
  }

  // --- PASS 6: Final protein correction (lean sources only, ±25g) ---
  const leanItems = [];
  plan.forEach(m => m.items.forEach(it => {
    const fd = FOODS_DB.find(x => x.name === it.food);
    if (fd && fd.prot > 10 && fd.grassi < 5 && !FIXED.test(it.food)) {
      leanItems.push({ item: it, fd });
    }
  }));
  for (let i = 0; i < 30; i++) {
    const pDiff = target.p - calcPlanMacro(plan, 'prot');
    if (Math.abs(pDiff) <= 8) break;
    const li = leanItems[i % leanItems.length];
    if (!li) break;
    const [minG, maxG] = getMinMax(li.item.food);
    const step = pDiff > 0 ? 25 : -25;
    const newG = li.item.grams + step;
    if (newG >= minG && newG <= maxG) { li.item.grams = newG; }
  }

  // Final practical kcal correction: carbs first, oil as small fallback
  const kcalAdjustItems = [];
  plan.forEach(m => m.items.forEach(it => {
    const fd = FOODS_DB.find(x => x.name === it.food);
    if (fd && ((fd.carbo > 15 && !fixedItems.test(it.food)) || it.food === 'Olio')) kcalAdjustItems.push(it);
  }));
  for (let i = 0; i < 120; i++) {
    const diff = target.kcal - calcPlanKcal(plan);
    if (Math.abs(diff) <= 50) break;
    const carb = kcalAdjustItems.find(it => it.food !== 'Olio');
    const oil = kcalAdjustItems.find(it => it.food === 'Olio');
    const item = Math.abs(diff) < 90 && oil ? oil : carb;
    if (!item) break;
    const [minG, maxG] = item.food === 'Olio' ? [5, 25] : getMinMax(item.food);
    const step = item.food === 'Olio' ? (diff > 0 ? 5 : -5) : (diff > 0 ? 10 : -10);
    const newG = item.grams + step;
    if (newG >= minG && newG <= maxG) item.grams = newG; else break;
  }

  // Check if plan is within acceptable range; if not, signal for retry
  plan._kcalTotal = calcPlanKcal(plan);
  plan._carboTotal = calcPlanMacro(plan, 'carbo');
  return plan;
}

// Wrapper that retries generateOnePlan up to N times for accuracy
function generateOnePlanWithRetry(isON, weeklyUsedProteins, maxAttempts) {
  maxAttempts = maxAttempts || 40;
  const macros = calcMacros(isON ? 'ON' : 'OFF');
  const tgt = { kcal: macros.kcal, c: macros.carbo };
  let best = null, bestErr = Infinity;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const plan = generateOnePlan(isON, weeklyUsedProteins);
    const kErr = Math.abs(plan._kcalTotal - tgt.kcal);
    const cErr = Math.abs(plan._carboTotal - tgt.c);
    const totalErr = kErr + cErr * 2; // weight carb accuracy higher
    if (kErr <= 50) return plan; // kcal target reached within tolerance
    if (totalErr < bestErr) { best = plan; bestErr = totalErr; }
  }
  return best;
}


function getDayType() {
  const el = document.getElementById('daytype-on');
  return (el && el.checked) ? 'ON' : 'OFF';
}

function updateDayType() {
  const isON = getDayType() === 'ON';
  const info = document.getElementById('daytype-info');
  if (info) {
    info.textContent = isON
      ? `Target ON: ${calcMacros('ON').kcal} kcal`
      : `Target OFF: ${calcMacros('OFF').kcal} kcal`;
  }
  renderResults();
  // Auto-regenerate the plan when switching ON/OFF (clear stale plan)
  if (currentPlan) {
    generateMealPlan();
  }
}

// Weekly calendar state
let weeklyCalendar = [true, false, true, false, true, false, false]; // Default: Mon/Wed/Fri ON

function renderWeeklyCalendar() {
  const container = document.getElementById('weekly-calendar');
  if (!container) return;
  let html = '';
  DAY_NAMES.forEach((name, i) => {
    const isON = weeklyCalendar[i];
    html += `<div class="cal-day ${isON ? 'on' : 'off'}" onclick="toggleCalDay(${i})">
      <div class="cal-label">${name.substring(0,3)}</div>
      <div class="cal-status">${isON ? 'ON' : 'OFF'}</div>
    </div>`;
  });
  container.innerHTML = html;
}

function toggleCalDay(idx) {
  weeklyCalendar[idx] = !weeklyCalendar[idx];
  renderWeeklyCalendar();
}

function generateMealPlan() {
  const isON = getDayType() === 'ON';
  const plan = generateOnePlanWithRetry(isON);
  renderSuggestedPlan(plan);
  document.getElementById('btn-refresh-all').style.display = '';
  document.getElementById('btn-export-pdf').style.display = '';
  document.getElementById('btn-copy-to-tracker').style.display = '';
  document.getElementById('btn-save-day-template').style.display = '';
  document.getElementById('btn-clear-plan').style.display = '';
}

function clearMealPlan() {
  currentPlan = null;
  document.getElementById('suggested-meals').innerHTML = '';
  document.getElementById('btn-refresh-all').style.display = 'none';
  document.getElementById('btn-export-pdf').style.display = 'none';
  document.getElementById('btn-copy-to-tracker').style.display = 'none';
  document.getElementById('btn-save-day-template').style.display = 'none';
  document.getElementById('btn-clear-plan').style.display = 'none';
  const bar = document.getElementById('sticky-totals');
  if (bar) bar.classList.remove('show');
}

// ===================== REFRESH LOGIC =====================
function handleRefreshCount() {
  refreshCount++;
  if (refreshCount > 0 && refreshCount % 5 === 0) {
    document.getElementById('refresh-modal').classList.add('show');
  }
}

function closeRefreshModal() {
  document.getElementById('refresh-modal').classList.remove('show');
}

function refreshFullPlan() {
  handleRefreshCount();
  generateMealPlan();
}

function refreshSingleMeal(mealIdx) {
  if (!currentPlan) return;
  handleRefreshCount();
  // Generate a fresh full plan with same ON/OFF, then take only the refreshed meal
  const isON = getDayType() === 'ON';
  const freshPlan = generateOnePlanWithRetry(isON);
  currentPlan[mealIdx] = freshPlan[mealIdx];
  renderPlanFromData();
}

// ===================== PLAN RENDERING (editable + drag) =====================
let currentPlan = null;

function renderSuggestedPlan(plan) {
  currentPlan = plan;
  renderPlanFromData();
}

function renderPlanFromData() {
  const plan = currentPlan;
  if (!plan) return;
  let totalKcal=0, totalC=0, totalP=0, totalG=0;
  let html = '';

  plan.forEach((meal, mi) => {
    let mKcal=0, mC=0, mP=0, mG=0;
    meal.items.forEach(it => {
      const f = FOODS_DB.find(x => x.name === it.food);
      if (f) {
        mKcal += it.grams/100*f.kcal;
        mC += it.grams/100*f.carbo;
        mP += it.grams/100*f.prot;
        mG += it.grams/100*f.grassi;
      }
    });
    totalKcal += mKcal; totalC += mC; totalP += mP; totalG += mG;

    html += `<div class="suggested-meal" data-meal="${mi}">
      <div class="suggested-meal-header ${meal.cls}">
        <span>${meal.name}</span>
        <span style="display:flex;align-items:center">
          <span style="font-size:0.8em;color:var(--accent)">${Math.round(mKcal)} kcal | C:${Math.round(mC)} P:${Math.round(mP)} G:${Math.round(mG)}</span>
          <button class="meal-refresh-btn" onclick="saveCurrentMealAsTemplate(${mi})" title="Salva template">&#9733;</button>
          <button class="meal-refresh-btn" onclick="refreshSingleMeal(${mi})" title="Rigenera ${meal.name}">&#8635;</button>
        </span>
      </div>
      <div class="sg-food" style="border:none;font-size:0.65em;color:var(--text-dim);">
        <span>ALIMENTO</span><span class="sg-num">GRAMMI</span><span class="sg-num">KCAL</span><span class="sg-num">C</span><span class="sg-num">P</span><span class="sg-num">G</span>
      </div>`;

    meal.items.forEach((it, ii) => {
      const f = FOODS_DB.find(x => x.name === it.food);
      const kcal = f ? Math.round(it.grams/100*f.kcal) : 0;
      const c = f ? (it.grams/100*f.carbo).toFixed(1) : '0';
      const p = f ? (it.grams/100*f.prot).toFixed(1) : '0';
      const g = f ? (it.grams/100*f.grassi).toFixed(1) : '0';
      html += `<div class="sg-food sg-editable" data-meal="${mi}" data-item="${ii}" draggable="false">
        <select class="sg-select" onchange="planChangeFood(${mi},${ii},this.value)">${FOODS_DB.map(fd => `<option value="${fd.name}"${fd.name===it.food?' selected':''}>${fd.name}</option>`).join('')}</select>
        <input type="number" class="sg-input" value="${it.grams}" min="0" step="10" onchange="planChangeGrams(${mi},${ii},this.value)">
        <span class="sg-num">${kcal}</span>
        <span class="sg-num">${c}</span>
        <span class="sg-num">${p}</span>
        <span class="sg-num">${g}</span>
        <button class="sub-btn" onclick="showSubstitutions(${mi},${ii},event)" title="Sostituzioni equivalenti">&#8644;</button>
        <button class="sg-remove" onclick="planRemoveItem(${mi},${ii})">&times;</button>
      </div>`;
    });
    html += `<button class="sg-add-btn" onclick="planAddItem(${mi})">+ Aggiungi alimento</button></div>`;
  });

  document.getElementById('suggested-meals').innerHTML = html;
  initDragAndDrop();
  updateStickyTotals(totalKcal, totalP, totalG, totalC);
}

function updateStickyTotals(kcalArg, protArg, grassiArg, carboArg) {
  const macros = calcMacros();
  const bar = document.getElementById('sticky-totals');
  const inner = document.getElementById('sticky-totals-inner');
  if (!bar || !inner) return;
  const activePage = document.querySelector('.page.active');
  const isGiornaliero = activePage && activePage.id === 'page-giornaliero';
  if (!isGiornaliero || !currentPlan) { bar.classList.remove('show'); return; }

  // Recalculate from currentPlan if no args (called from updateDayTarget)
  let kcal = kcalArg, prot = protArg, grassi = grassiArg, carbo = carboArg;
  if (kcal == null && currentPlan) {
    kcal = 0; prot = 0; grassi = 0; carbo = 0;
    currentPlan.forEach(m => m.items.forEach(it => {
      const f = FOODS_DB.find(x => x.name === it.food);
      if (f) { kcal += it.grams/100*f.kcal; prot += it.grams/100*f.prot; grassi += it.grams/100*f.grassi; carbo += it.grams/100*f.carbo; }
    }));
  }

  bar.classList.add('show');

  function miniDonut(label, current, target, color, unit) {
    const pct = target > 0 ? Math.min(current / target, 1.5) : 0;
    const r = 30, cx = 36, cy = 36, stroke = 6;
    const circ = 2 * Math.PI * r;
    const dash = Math.min(pct, 1) * circ;
    const c = pct > 1.05 ? '#ff4444' : pct >= 0.95 ? '#44ff88' : color;
    return `<div class="sticky-donut">
      <svg viewBox="0 0 72 72" width="72" height="72">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="${stroke}"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="${stroke}"
          stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}" stroke-linecap="round"
          transform="rotate(-90 ${cx} ${cy})"/>
        <text x="${cx}" y="${cy - 2}" text-anchor="middle" fill="white" font-size="11" font-weight="bold">${Math.round(current)}${unit||''}</text>
        <text x="${cx}" y="${cy + 10}" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="7">/ ${target}${unit||''}</text>
      </svg>
      <div class="sticky-donut-label">${label}</div>
    </div>`;
  }

  const diff = Math.round(kcal - macros.kcal);
  const diffStr = diff >= 0 ? '+' + diff : '' + diff;
  const kcColor = Math.abs(diff) <= 50 ? '#44ff88' : diff > 50 ? '#ff4444' : '#ffaa33';

  inner.innerHTML =
    miniDonut('Kcal (' + diffStr + ')', kcal, macros.kcal, kcColor, '') +
    miniDonut('Proteine', prot, macros.prot, '#4fc3f7', 'g') +
    miniDonut('Grassi', grassi, macros.grassi, '#ffb74d', 'g') +
    miniDonut('Carboidrati', carbo, macros.carbo, '#81c784', 'g');
}

function planChangeFood(mi, ii, newFood) {
  currentPlan[mi].items[ii].food = newFood;
  renderPlanFromData();
}

function planChangeGrams(mi, ii, val) {
  currentPlan[mi].items[ii].grams = parseInt(val) || 0;
  renderPlanFromData();
}

function planRemoveItem(mi, ii) {
  currentPlan[mi].items.splice(ii, 1);
  renderPlanFromData();
}

function planAddItem(mi) {
  currentPlan[mi].items.push({ food: FOODS_DB[0].name, grams: 100 });
  renderPlanFromData();
}

// ===================== SUBSTITUTION POPUP (v2) =====================
let activeSubPopup = null;
function closeSubPopup() {
  if (activeSubPopup) { activeSubPopup.remove(); activeSubPopup = null; }
}
document.addEventListener('click', function(e) {
  if (activeSubPopup && !activeSubPopup.contains(e.target) && !e.target.classList.contains('sub-btn')) {
    closeSubPopup();
  }
});

function showSubstitutions(mi, ii, event) {
  event.stopPropagation();
  closeSubPopup();
  const item = currentPlan[mi].items[ii];
  const subs = getSubstitutions(item.food, item.grams);

  const popup = document.createElement('div');
  popup.className = 'sub-popup';
  if (subs.length === 0) {
    popup.innerHTML = `<div class="sub-popup-title">Nessuna sostituzione per ${item.food}</div>`;
  } else {
  popup.innerHTML = `<div class="sub-popup-title">Sostituzioni per ${item.food} (${item.grams}g)</div>` +
    subs.map((s, si) => {
      const fd = FOODS_DB.find(x => x.name === s.name);
      const kcal = fd ? Math.round(s.grams / 100 * fd.kcal) : '?';
      return `<div class="sub-item" onclick="applySubstitution(${mi},${ii},${si})">
        <span class="sub-name">${s.name}</span>
        <span class="sub-grams">${s.grams}g (${kcal} kcal)</span>
      </div>`;
    }).join('');
  }

  popup._subs = subs;

  const btn = event.target;
  const rect = btn.getBoundingClientRect();
  popup.style.position = 'fixed';
  popup.style.top = Math.min(rect.bottom + 4, window.innerHeight - 320) + 'px';
  popup.style.left = Math.max(8, Math.min(rect.left - 100, window.innerWidth - 350)) + 'px';

  document.body.appendChild(popup);
  activeSubPopup = popup;
}

function applySubstitution(mi, ii, subIdx) {
  if (!activeSubPopup || !activeSubPopup._subs) return;
  const sub = activeSubPopup._subs[subIdx];
  currentPlan[mi].items[ii].food = sub.name;
  currentPlan[mi].items[ii].grams = sub.grams;
  closeSubPopup();
  renderPlanFromData();
}

// ===================== INFO POPUPS =====================
function showInfo(key) {
  const data = INFO_DATA[key];
  if (!data) return;
  document.getElementById('info-title').textContent = data.title;
  document.getElementById('info-body').textContent = data.body;
  document.getElementById('info-overlay').classList.add('show');
  document.getElementById('info-popup').classList.add('show');
}

function closeInfo() {
  document.getElementById('info-overlay').classList.remove('show');
  document.getElementById('info-popup').classList.remove('show');
}

// ===================== PDF EXPORT =====================
function exportPlanPDF() {
  if (!currentPlan) return;
  const macros = calcMacros();
  const dayType = getDayType();
  let totalKcal=0, totalP=0, totalG=0, totalC=0;

  let tableRows = '';
  currentPlan.forEach(meal => {
    let mK=0, mP=0, mG=0, mC=0;
    meal.items.forEach(it => {
      const f = FOODS_DB.find(x => x.name === it.food);
      if(f) { mK+=it.grams/100*f.kcal; mP+=it.grams/100*f.prot; mG+=it.grams/100*f.grassi; mC+=it.grams/100*f.carbo; }
    });
    totalKcal+=mK; totalP+=mP; totalG+=mG; totalC+=mC;

    tableRows += `<tr class="meal-header"><td colspan="6">${meal.name} — ${Math.round(mK)} kcal</td></tr>`;
    meal.items.forEach(it => {
      const f = FOODS_DB.find(x => x.name === it.food);
      tableRows += `<tr>
        <td>${it.food}</td><td class="num">${it.grams}g</td>
        <td class="num">${f ? Math.round(it.grams/100*f.kcal) : '-'}</td>
        <td class="num">${f ? (it.grams/100*f.carbo).toFixed(1) : '-'}</td>
        <td class="num">${f ? (it.grams/100*f.prot).toFixed(1) : '-'}</td>
        <td class="num">${f ? (it.grams/100*f.grassi).toFixed(1) : '-'}</td>
      </tr>`;
    });
  });

  const diff = Math.round(totalKcal - macros.kcal);
  const diffStr = diff >= 0 ? '+' + diff : '' + diff;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Piano Pasti - ${dayType} Day</title>
<style>
  @page { margin: 15mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #222; max-width: 700px; margin: 0 auto; padding: 20px; }
  h1 { text-align: center; color: #1a237e; font-size: 1.6em; margin-bottom: 4px; }
  .subtitle { text-align: center; color: #666; font-size: 0.9em; margin-bottom: 16px; }
  .summary { display: flex; justify-content: space-around; padding: 12px; background: #f5f5f5; border-radius: 8px; margin-bottom: 16px; }
  .summary div { text-align: center; }
  .summary .val { font-size: 1.3em; font-weight: bold; color: #1a237e; }
  .summary .lbl { font-size: 0.7em; color: #888; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
  th { background: #1a237e; color: white; padding: 6px 8px; text-align: left; font-size: 0.75em; text-transform: uppercase; }
  th.num, td.num { text-align: right; }
  td { padding: 4px 8px; border-bottom: 1px solid #eee; }
  tr.meal-header td { background: #e8eaf6; font-weight: bold; color: #1a237e; padding: 8px; font-size: 0.95em; border-bottom: 2px solid #1a237e; }
  tr:nth-child(even):not(.meal-header) { background: #fafafa; }
  .totals { display: flex; justify-content: space-around; padding: 14px; background: #1a237e; color: white; border-radius: 8px; margin-top: 16px; }
  .totals div { text-align: center; }
  .totals .val { font-size: 1.2em; font-weight: bold; }
  .totals .lbl { font-size: 0.65em; opacity: 0.8; text-transform: uppercase; }
  .footer { text-align: center; margin-top: 20px; font-size: 0.7em; color: #aaa; }
</style></head><body>
<h1>Piano Pasti ${dayType === 'ON' ? 'Giorno Allenamento' : 'Giorno Riposo'}</h1>
<div class="subtitle">Peso: ${profile.peso}kg | Obiettivo: ${profile.goal} | ${new Date().toLocaleDateString('it-IT')}</div>
<div class="summary">
  <div><div class="val">${macros.kcal}</div><div class="lbl">Target Kcal</div></div>
  <div><div class="val">${macros.prot}g</div><div class="lbl">Proteine</div></div>
  <div><div class="val">${macros.grassi}g</div><div class="lbl">Grassi</div></div>
  <div><div class="val">${macros.carbo}g</div><div class="lbl">Carboidrati</div></div>
</div>
<table>
  <thead><tr><th>Alimento</th><th class="num">Grammi</th><th class="num">Kcal</th><th class="num">Carbo</th><th class="num">Prot</th><th class="num">Grassi</th></tr></thead>
  <tbody>${tableRows}</tbody>
</table>
<div class="totals">
  <div><div class="val">${Math.round(totalKcal)} (${diffStr})</div><div class="lbl">Kcal Totali</div></div>
  <div><div class="val">${Math.round(totalP)}g</div><div class="lbl">Proteine</div></div>
  <div><div class="val">${Math.round(totalG)}g</div><div class="lbl">Grassi</div></div>
  <div><div class="val">${Math.round(totalC)}g</div><div class="lbl">Carboidrati</div></div>
</div>
<div class="footer">Generato da New Project Diet v2</div>
<scr` + `ipt>window.onload = function() { window.print(); }</scr` + `ipt>
</body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

// ===================== DRAG & DROP =====================
let dragState = null;
let dragGhost = null;
let longPressTimer = null;

function initDragAndDrop() {
  const rows = document.querySelectorAll('#suggested-meals .sg-food.sg-editable');
  rows.forEach(row => {
    row.addEventListener('mousedown', onDragStart);
    row.addEventListener('touchstart', onDragStart, { passive: false });
  });
}

function onDragStart(e) {
  if (e.target.closest('select, input, button')) return;
  const row = e.target.closest('.sg-food.sg-editable');
  if (!row) return;

  const mi = parseInt(row.dataset.meal);
  const ii = parseInt(row.dataset.item);
  const startX = e.touches ? e.touches[0].clientX : e.clientX;
  const startY = e.touches ? e.touches[0].clientY : e.clientY;

  e.preventDefault();

  longPressTimer = setTimeout(() => {
    dragState = { mi, ii, startX, startY, active: true };

    const foodName = currentPlan[mi].items[ii].food;
    dragGhost = document.createElement('div');
    dragGhost.className = 'drag-ghost';
    dragGhost.textContent = foodName;
    dragGhost.style.left = startX + 'px';
    dragGhost.style.top = (startY - 20) + 'px';
    document.body.appendChild(dragGhost);

    document.body.classList.add('is-dragging');
    row.classList.add('dragging');

    if (e.touches) {
      document.addEventListener('touchmove', onDragMove, { passive: false });
      document.addEventListener('touchend', onDragEnd);
    } else {
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragEnd);
    }
  }, 400);

  const cancelLongPress = () => {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    document.removeEventListener('mousemove', cancelLongPress);
    document.removeEventListener('touchmove', cancelLongPress);
  };

  if (e.touches) {
    document.addEventListener('touchmove', cancelLongPress, { once: true, passive: true });
  } else {
    document.addEventListener('mousemove', cancelLongPress, { once: true });
  }
}

function onDragMove(e) {
  if (!dragState || !dragState.active) return;
  e.preventDefault();

  const x = e.touches ? e.touches[0].clientX : e.clientX;
  const y = e.touches ? e.touches[0].clientY : e.clientY;

  if (dragGhost) {
    dragGhost.style.left = x + 'px';
    dragGhost.style.top = (y - 20) + 'px';
  }

  document.querySelectorAll('.sg-food.drag-over-top, .sg-food.drag-over-bottom').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  const target = document.elementFromPoint(x, y);
  if (!target) return;
  const targetRow = target.closest('.sg-food.sg-editable');
  if (!targetRow || targetRow.classList.contains('dragging')) return;

  const rect = targetRow.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  if (y < midY) {
    targetRow.classList.add('drag-over-top');
  } else {
    targetRow.classList.add('drag-over-bottom');
  }
}

function onDragEnd(e) {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.removeEventListener('touchmove', onDragMove);
  document.removeEventListener('touchend', onDragEnd);
  clearTimeout(longPressTimer);

  if (dragGhost) {
    dragGhost.remove();
    dragGhost = null;
  }

  document.body.classList.remove('is-dragging');
  document.querySelectorAll('.sg-food.dragging').forEach(el => el.classList.remove('dragging'));

  if (!dragState || !dragState.active) { dragState = null; return; }

  const x = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
  const y = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

  const overTop = document.querySelector('.sg-food.drag-over-top');
  const overBottom = document.querySelector('.sg-food.drag-over-bottom');
  document.querySelectorAll('.sg-food.drag-over-top, .sg-food.drag-over-bottom').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  const dropRow = overTop || overBottom;
  if (dropRow) {
    const targetMi = parseInt(dropRow.dataset.meal);
    let targetIi = parseInt(dropRow.dataset.item);
    if (overBottom) targetIi += 1;

    const srcMi = dragState.mi;
    const srcIi = dragState.ii;

    const item = currentPlan[srcMi].items.splice(srcIi, 1)[0];

    if (srcMi === targetMi && targetIi > srcIi) targetIi -= 1;

    currentPlan[targetMi].items.splice(targetIi, 0, item);
    renderPlanFromData();
  }

  dragState = null;
}

// ===================== WEEKLY PLAN =====================
let weeklyPlans = null;
let weeklyOpenDayIdx = 0;
const DAY_NAMES = ['Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato', 'Domenica'];

function generateWeeklyPlan() {
  weeklyPlans = [];
  const usedProteins = new Set();
  for (let d = 0; d < 7; d++) {
    const isON = weeklyCalendar[d];
    weeklyPlans.push(generateOnePlanWithRetry(isON, usedProteins));
    // Track proteins used across the week for variety
    weeklyPlans[d].forEach(meal => {
      meal.items.forEach(it => {
        if (CAT.protPranzo.some(f => f.name === it.food) || CAT.protCena.some(f => f.name === it.food)) {
          usedProteins.add(it.food);
        }
      });
    });
  }
  renderWeeklyPlan();
  document.getElementById('btn-refresh-weekly').style.display = '';
  document.getElementById('btn-export-weekly-pdf').style.display = '';
}


function importWeeklyDayToDailyPlan(dayIdx) {
  if (!weeklyPlans || !weeklyPlans[dayIdx]) { alert('Genera prima il piano settimanale.'); return; }
  const dayType = weeklyCalendar[dayIdx] ? 'ON' : 'OFF';
  if (!confirm(`Importare ${DAY_NAMES[dayIdx]} (${dayType}) nel Piano Giornaliero? Il piano attuale verrà sostituito.`)) return;
  currentPlan = JSON.parse(JSON.stringify(weeklyPlans[dayIdx]));
  const on = document.getElementById('daytype-on');
  const off = document.getElementById('daytype-off');
  if (on && off) { on.checked = dayType === 'ON'; off.checked = dayType === 'OFF'; }
  navigateTo('giornaliero');
  renderPlanFromData();
  document.getElementById('btn-refresh-all').style.display = '';
  document.getElementById('btn-export-pdf').style.display = '';
  document.getElementById('btn-copy-to-tracker').style.display = '';
  document.getElementById('btn-save-day-template').style.display = '';
  document.getElementById('btn-clear-plan').style.display = '';
  renderResults();
  updateStickyTotals();
}


function exportWeeklyPDF() {
  if (!weeklyPlans || weeklyPlans.length === 0) { alert('Genera prima il piano settimanale.'); return; }
  let weekKcal = 0, weekP = 0, weekG = 0, weekC = 0;
  let htmlDays = '';
  weeklyPlans.forEach((plan, di) => {
    const isON = weeklyCalendar[di];
    const macros = calcMacros(isON ? 'ON' : 'OFF');
    let dayK=0, dayP=0, dayG=0, dayC=0;
    let mealsHtml = '';
    plan.forEach(meal => {
      let mK=0, mP=0, mG=0, mC=0;
      let rows = '';
      meal.items.forEach(it => {
        const f = FOODS_DB.find(x => x.name === it.food);
        if (!f) return;
        const g = parseFloat(it.grams) || 0;
        const k = g/100*f.kcal, c = g/100*f.carbo, p = g/100*f.prot, gr = g/100*f.grassi;
        mK += k; mC += c; mP += p; mG += gr;
        rows += `<tr><td>${it.food}</td><td class="num">${g}g</td><td class="num">${Math.round(k)}</td><td class="num">${c.toFixed(1)}</td><td class="num">${p.toFixed(1)}</td><td class="num">${gr.toFixed(1)}</td></tr>`;
      });
      dayK += mK; dayC += mC; dayP += mP; dayG += mG;
      mealsHtml += `<tr class="meal-header"><td colspan="6">${meal.name} — ${Math.round(mK)} kcal</td></tr>${rows}`;
    });
    weekKcal += dayK; weekP += dayP; weekG += dayG; weekC += dayC;
    const diff = Math.round(dayK - macros.kcal);
    const diffStr = diff >= 0 ? '+' + diff : '' + diff;
    htmlDays += `<section class="day"><h2>${DAY_NAMES[di]} - ${isON ? 'ON Allenamento' : 'OFF Riposo'}</h2><div class="summary"><div><b>${Math.round(dayK)}</b><span>Kcal (${diffStr})</span></div><div><b>${Math.round(dayP)}g</b><span>Proteine</span></div><div><b>${Math.round(dayG)}g</b><span>Grassi</span></div><div><b>${Math.round(dayC)}g</b><span>Carbo</span></div><div><b>${macros.kcal}</b><span>Target</span></div></div><table><thead><tr><th>Alimento</th><th class="num">Grammi</th><th class="num">Kcal</th><th class="num">Carbo</th><th class="num">Prot</th><th class="num">Grassi</th></tr></thead><tbody>${mealsHtml}</tbody></table></section>`;
  });
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Piano Settimanale</title><style>@page{margin:12mm}body{font-family:'Segoe UI',Arial,sans-serif;color:#222;padding:10px}h1{text-align:center;color:#1a237e;margin-bottom:4px}.subtitle{text-align:center;color:#666;margin-bottom:18px}.week-summary,.summary{display:flex;gap:10px;justify-content:space-around;background:#f5f5f5;border-radius:8px;padding:10px;margin:10px 0;flex-wrap:wrap}.week-summary div,.summary div{text-align:center}.week-summary b,.summary b{display:block;color:#1a237e;font-size:1.15em}.week-summary span,.summary span{display:block;color:#777;font-size:.72em;text-transform:uppercase}h2{color:#1a237e;font-size:1.1em;margin-top:20px;border-bottom:2px solid #1a237e;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:.78em;page-break-inside:auto}th{background:#1a237e;color:white;text-align:left;padding:5px}td{padding:4px 5px;border-bottom:1px solid #eee}.num{text-align:right}.meal-header td{background:#e8eaf6;color:#1a237e;font-weight:bold}.day{page-break-inside:avoid;margin-bottom:16px}.footer{text-align:center;margin-top:20px;color:#999;font-size:.75em}</style></head><body><h1>Piano Pasti Settimanale</h1><div class="subtitle">${new Date().toLocaleDateString('it-IT')} | Peso: ${profile.peso}kg</div><div class="week-summary"><div><b>${Math.round(weekKcal/7)}</b><span>Media kcal</span></div><div><b>${Math.round(weekP/7)}g</b><span>Media proteine</span></div><div><b>${Math.round(weekG/7)}g</b><span>Media grassi</span></div><div><b>${Math.round(weekC/7)}g</b><span>Media carbo</span></div></div>${htmlDays}<div class="footer">Generato da New Project Diet</div><scr` + `ipt>window.onload=function(){window.print();}</scr` + `ipt></body></html>`;
  const w = window.open('', '_blank');
  w.document.write(doc);
  w.document.close();
}

function refreshWeeklyPlan() {
  handleRefreshCount();
  generateWeeklyPlan();
}

function refreshWeeklyDay(dayIdx) {
  if (!weeklyPlans) return;
  handleRefreshCount();
  const isON = weeklyCalendar[dayIdx];
  weeklyPlans[dayIdx] = generateOnePlanWithRetry(isON);
  weeklyOpenDayIdx = dayIdx;
  renderWeeklyPlan();
}

function toggleWeeklyDay(dayIdx) {
  const header = document.getElementById(`weekly-header-${dayIdx}`);
  const body = document.getElementById(`weekly-body-${dayIdx}`);
  header.classList.toggle('collapsed');
  body.classList.toggle('collapsed');
  weeklyOpenDayIdx = body.classList.contains('collapsed') ? -1 : dayIdx;
}




function weeklyAddFood(dayIdx, mealIdx) {
  if (!weeklyPlans || !weeklyPlans[dayIdx] || !weeklyPlans[dayIdx][mealIdx]) return;
  weeklyOpenDayIdx = dayIdx;
  weeklyPlans[dayIdx][mealIdx].items.push({ food: FOODS_DB[0].name, grams: 100 });
  renderWeeklyPlan();
}

function weeklyMoveFood(dayIdx, sourceMealIdx, itemIdx, targetMealIdxValue) {
  const targetMealIdx = parseInt(targetMealIdxValue, 10);
  if (!Number.isFinite(targetMealIdx)) return;
  if (!weeklyPlans || !weeklyPlans[dayIdx] || !weeklyPlans[dayIdx][sourceMealIdx] || !weeklyPlans[dayIdx][targetMealIdx]) return;
  weeklyOpenDayIdx = dayIdx;
  const item = weeklyPlans[dayIdx][sourceMealIdx].items.splice(itemIdx, 1)[0];
  weeklyPlans[dayIdx][targetMealIdx].items.push(item);
  renderWeeklyPlan();
}

function copyWeeklyDayTo(sourceDayIdx, targetDayIdxValue) {
  const targetDayIdx = parseInt(targetDayIdxValue, 10);
  if (!Number.isFinite(targetDayIdx)) return;
  if (!weeklyPlans || !weeklyPlans[sourceDayIdx] || !weeklyPlans[targetDayIdx]) return;
  const sourceType = weeklyCalendar[sourceDayIdx] ? 'ON' : 'OFF';
  const targetType = weeklyCalendar[targetDayIdx] ? 'ON' : 'OFF';
  if (!confirm(`Copiare tutti i pasti di ${DAY_NAMES[sourceDayIdx]} (${sourceType}) in ${DAY_NAMES[targetDayIdx]} (${targetType})? Il giorno di destinazione verrà sostituito.`)) return;
  weeklyPlans[targetDayIdx] = JSON.parse(JSON.stringify(weeklyPlans[sourceDayIdx]));
  weeklyOpenDayIdx = targetDayIdx;
  renderWeeklyPlan();
}

function showWeeklySubstitutions(dayIdx, mealIdx, itemIdx, event) {
  event.stopPropagation();
  closeSubPopup();
  if (!weeklyPlans || !weeklyPlans[dayIdx] || !weeklyPlans[dayIdx][mealIdx]) return;
  const item = weeklyPlans[dayIdx][mealIdx].items[itemIdx];
  if (!item || !item.food || !item.grams) return;
  const subs = getSubstitutions(item.food, parseFloat(item.grams) || 0);
  const popup = document.createElement('div');
  popup.className = 'sub-popup';
  if (subs.length === 0) {
    popup.innerHTML = `<div class="sub-popup-title">Nessuna sostituzione per ${item.food}</div>`;
  } else {
    popup.innerHTML = `<div class="sub-popup-title">Sostituzioni per ${item.food} (${item.grams}g)</div>` +
      subs.map((sub, si) => {
        const fd = FOODS_DB.find(x => x.name === sub.name);
        const kcal = fd ? Math.round(sub.grams / 100 * fd.kcal) : '?';
        return `<div class="sub-item" onclick="applyWeeklySubstitution(${dayIdx},${mealIdx},${itemIdx},${si})"><span class="sub-name">${sub.name}</span><span class="sub-grams">${sub.grams}g (${kcal} kcal)</span></div>`;
      }).join('');
  }
  popup._subs = subs;
  const rect = event.target.getBoundingClientRect();
  popup.style.position = 'fixed';
  popup.style.top = Math.min(rect.bottom + 4, window.innerHeight - 320) + 'px';
  popup.style.left = Math.max(8, Math.min(rect.left - 100, window.innerWidth - 350)) + 'px';
  document.body.appendChild(popup);
  activeSubPopup = popup;
}

function applyWeeklySubstitution(dayIdx, mealIdx, itemIdx, subIdx) {
  if (!activeSubPopup || !activeSubPopup._subs) return;
  if (!weeklyPlans || !weeklyPlans[dayIdx] || !weeklyPlans[dayIdx][mealIdx]) return;
  const sub = activeSubPopup._subs[subIdx];
  weeklyOpenDayIdx = dayIdx;
  weeklyPlans[dayIdx][mealIdx].items[itemIdx].food = sub.name;
  weeklyPlans[dayIdx][mealIdx].items[itemIdx].grams = sub.grams;
  closeSubPopup();
  renderWeeklyPlan();
}

function weeklyRemoveFood(dayIdx, mealIdx, itemIdx) {
  if (!weeklyPlans || !weeklyPlans[dayIdx] || !weeklyPlans[dayIdx][mealIdx]) return;
  if (!confirm('Eliminare questo alimento dal piano settimanale?')) return;
  weeklyOpenDayIdx = dayIdx;
  weeklyPlans[dayIdx][mealIdx].items.splice(itemIdx, 1);
  renderWeeklyPlan();
}

function weeklyRemoveMeal(dayIdx, mealIdx) {
  if (!weeklyPlans || !weeklyPlans[dayIdx] || !weeklyPlans[dayIdx][mealIdx]) return;
  if (!confirm('Eliminare tutto questo pasto dal giorno selezionato?')) return;
  weeklyOpenDayIdx = dayIdx;
  weeklyPlans[dayIdx].splice(mealIdx, 1);
  renderWeeklyPlan();
}

function renderWeeklyDayMacroChart(dayIdx, kcal, prot, grassi, carbo) {
  const isON = weeklyCalendar[dayIdx];
  const macros = calcMacros(isON ? 'ON' : 'OFF');
  const diff = Math.round(kcal - macros.kcal);
  const diffStr = diff >= 0 ? '+' + diff : '' + diff;
  const kcColor = Math.abs(diff) <= 50 ? '#44ff88' : diff > 50 ? '#ff4444' : '#ffaa33';
  function donut(label, current, target, color, unit) {
    const pct = target > 0 ? Math.min(current / target, 1.5) : 0;
    const r = 34, cx = 40, cy = 40, stroke = 7;
    const circ = 2 * Math.PI * r;
    const dash = Math.min(pct, 1) * circ;
    return `<div class="weekly-donut"><svg viewBox="0 0 80 80" width="80" height="80"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="${stroke}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/><text x="${cx}" y="${cy - 2}" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${Math.round(current)}${unit||''}</text><text x="${cx}" y="${cy + 12}" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="8">/ ${target}${unit||''}</text></svg><div class="weekly-donut-label">${label}</div></div>`;
  }
  return `<div class="weekly-chart"><div class="weekly-chart-title">Chart giornata ${isON ? 'ON' : 'OFF'} aperta</div><div class="weekly-chart-grid">${donut('Kcal (' + diffStr + ')', kcal, macros.kcal, kcColor, '')}${donut('Proteine', prot, macros.prot, '#4fc3f7', 'g')}${donut('Grassi', grassi, macros.grassi, '#ffb74d', 'g')}${donut('Carbo', carbo, macros.carbo, '#81c784', 'g')}</div></div>`;
}

function weeklyChangeFood(dayIdx, mealIdx, itemIdx, value) {
  if (!weeklyPlans || !weeklyPlans[dayIdx] || !weeklyPlans[dayIdx][mealIdx]) return;
  weeklyOpenDayIdx = dayIdx;
  weeklyPlans[dayIdx][mealIdx].items[itemIdx].food = value;
  renderWeeklyPlan();
}

function weeklyChangeGrams(dayIdx, mealIdx, itemIdx, value) {
  if (!weeklyPlans || !weeklyPlans[dayIdx] || !weeklyPlans[dayIdx][mealIdx]) return;
  weeklyOpenDayIdx = dayIdx;
  weeklyPlans[dayIdx][mealIdx].items[itemIdx].grams = parseFloat(value) || 0;
  renderWeeklyPlan();
}

function renderWeeklyFreqDashboard() {
  if (!weeklyPlans || weeklyPlans.length === 0) {
    document.getElementById('weekly-freq-dashboard').style.display = 'none';
    return;
  }
  document.getElementById('weekly-freq-dashboard').style.display = '';
  const counts = countWeeklyFrequencies(weeklyPlans);
  let html = '';
  FREQ_RULES.forEach(r => {
    const c = counts[r.id];
    const isOk = c >= r.min && c <= r.max;
    const rangeStr = r.max >= 99 ? `min ${r.min}x` : r.min === 0 ? `max ${r.max}x` : `${r.min}-${r.max}x`;
    html += `<div class="freq-item ${isOk ? 'freq-ok' : 'freq-warn'}">
      <div class="freq-label">${r.label}</div>
      <div class="freq-value">${c}x</div>
      <div class="freq-range">${rangeStr} / sett</div>
    </div>`;
  });
  document.getElementById('weekly-freq-grid').innerHTML = html;
}

function renderWeeklyPlan() {
  if (!weeklyPlans) return;
  const macros = calcMacros();
  let html = '';

  weeklyPlans.forEach((plan, di) => {
    const isON = weeklyCalendar[di];
    let dayKcal=0, dayC=0, dayP=0, dayG=0;
    plan.forEach(meal => {
      meal.items.forEach(it => {
        const f = FOODS_DB.find(x => x.name === it.food);
        if (f) {
          dayKcal += it.grams/100*f.kcal;
          dayC += it.grams/100*f.carbo;
          dayP += it.grams/100*f.prot;
          dayG += it.grams/100*f.grassi;
        }
      });
    });

    const dayLabel = isON ? '<span style="color:#2ecc71;font-weight:bold">ON</span>' : '<span style="color:#e74c3c;font-weight:bold">OFF</span>';
    html += `<div class="weekly-day-card">
      <div class="weekly-day-header" id="weekly-header-${di}" onclick="toggleWeeklyDay(${di})">
        <span>${DAY_NAMES[di]} ${dayLabel} &mdash; ${Math.round(dayKcal)} kcal (C:${Math.round(dayC)} P:${Math.round(dayP)} G:${Math.round(dayG)})</span>
        <span style="display:flex;align-items:center;gap:6px">
          <select class="weekly-copy-select" onclick="event.stopPropagation()" onchange="copyWeeklyDayTo(${di},this.value);this.value=''" title="Copia questo giorno in un altro giorno">
            <option value="">Copia in...</option>
            ${DAY_NAMES.map((dn, idx) => idx === di ? '' : `<option value="${idx}">${dn}</option>`).join('')}
          </select>
          <button class="meal-refresh-btn" onclick="event.stopPropagation();importWeeklyDayToDailyPlan(${di})" title="Usa nel Piano Giornaliero">&#128203;</button>
          <button class="meal-refresh-btn" onclick="event.stopPropagation();refreshWeeklyDay(${di})" title="Rigenera ${DAY_NAMES[di]}">&#8635;</button>
          <span class="day-toggle">&#9660;</span>
        </span>
      </div>
      <div class="weekly-day-body ${di !== weeklyOpenDayIdx ? 'collapsed' : ''}" id="weekly-body-${di}">
        ${renderWeeklyDayMacroChart(di, dayKcal, dayP, dayG, dayC)}`;

    plan.forEach(meal => {
      let mKcal=0, mC=0, mP=0, mG=0;
      meal.items.forEach(it => {
        const f = FOODS_DB.find(x => x.name === it.food);
        if (f) { mKcal += it.grams/100*f.kcal; mC += it.grams/100*f.carbo; mP += it.grams/100*f.prot; mG += it.grams/100*f.grassi; }
      });

      html += `<div class="suggested-meal" style="margin:6px 0">
        <div class="suggested-meal-header ${meal.cls}" style="padding:8px 12px;font-size:0.8em">
          <span>${meal.name}</span>
          <span style="display:flex;align-items:center;gap:6px">
            <span style="font-size:0.8em;color:var(--accent)">${Math.round(mKcal)} kcal</span>
            <button class="meal-refresh-btn" onclick="weeklyAddFood(${di},${plan.indexOf(meal)})" title="Aggiungi alimento">+</button>
            <button class="meal-refresh-btn" onclick="weeklyRemoveMeal(${di},${plan.indexOf(meal)})" title="Elimina pasto">&#10006;</button>
          </span>
        </div>`;
      meal.items.forEach((it, ii) => {
        const f = FOODS_DB.find(x => x.name === it.food);
        const kcal = f ? Math.round(it.grams/100*f.kcal) : 0;
        html += `<div class="sg-food weekly-edit-food" style="font-size:0.75em">
          <select class="sg-select" onchange="weeklyChangeFood(${di},${plan.indexOf(meal)},${ii},this.value)">${FOODS_DB.map(fd => `<option value="${fd.name}"${fd.name===it.food?' selected':''}>${fd.name}</option>`).join('')}</select>
          <input type="number" class="sg-input" value="${it.grams}" min="0" step="10" onchange="weeklyChangeGrams(${di},${plan.indexOf(meal)},${ii},this.value)">
          <span class="sg-num">${kcal}</span>
          <span class="sg-num">${f ? (it.grams/100*f.carbo).toFixed(0) : 0}</span>
          <span class="sg-num">${f ? (it.grams/100*f.prot).toFixed(0) : 0}</span>
          <span class="sg-num">${f ? (it.grams/100*f.grassi).toFixed(0) : 0}</span>
          <select class="weekly-move-select" onchange="weeklyMoveFood(${di},${plan.indexOf(meal)},${ii},this.value)" title="Sposta in un altro pasto">
            <option value="">Sposta...</option>
            ${plan.map((targetMeal, targetIdx) => targetIdx === plan.indexOf(meal) ? '' : `<option value="${targetIdx}">${targetMeal.name}</option>`).join('')}
          </select>
          <button class="sub-btn" onclick="showWeeklySubstitutions(${di},${plan.indexOf(meal)},${ii},event)" title="Sostituzioni equivalenti">&#8644;</button>
          <button class="remove-btn" onclick="weeklyRemoveFood(${di},${plan.indexOf(meal)},${ii})" title="Elimina alimento">x</button>
        </div>`;
      });
      html += `</div>`;
    });

    html += `<div class="weekly-totals">
      <div><div class="wt-label">Kcal</div><div class="wt-value">${Math.round(dayKcal)}</div></div>
      <div><div class="wt-label">Prot</div><div class="wt-value">${Math.round(dayP)}g</div></div>
      <div><div class="wt-label">Grassi</div><div class="wt-value">${Math.round(dayG)}g</div></div>
      <div><div class="wt-label">Carbo</div><div class="wt-value">${Math.round(dayC)}g</div></div>
    </div></div></div>`;
  });

  // Weekly averages
  let avgKcal=0, avgP=0, avgG=0, avgC=0;
  weeklyPlans.forEach(plan => {
    plan.forEach(meal => meal.items.forEach(it => {
      const f = FOODS_DB.find(x => x.name === it.food);
      if (f) { avgKcal += it.grams/100*f.kcal; avgP += it.grams/100*f.prot; avgG += it.grams/100*f.grassi; avgC += it.grams/100*f.carbo; }
    }));
  });

  html += `<div class="sg-totals" style="margin-top:16px">
    <div><div class="sg-t-label">Media Kcal/giorno</div><div class="sg-t-value">${Math.round(avgKcal/7)}</div><div class="sg-t-label">target: ${macros.kcal}</div></div>
    <div><div class="sg-t-label">Media Prot</div><div class="sg-t-value">${Math.round(avgP/7)}g</div><div class="sg-t-label">target: ${macros.prot}g</div></div>
    <div><div class="sg-t-label">Media Grassi</div><div class="sg-t-value">${Math.round(avgG/7)}g</div><div class="sg-t-label">target: ${macros.grassi}g</div></div>
    <div><div class="sg-t-label">Media Carbo</div><div class="sg-t-value">${Math.round(avgC/7)}g</div><div class="sg-t-label">target: ${macros.carbo}g</div></div>
  </div>`;

  document.getElementById('weekly-meals').innerHTML = html;
  renderWeeklyFreqDashboard();
}

// ===================== NAVIGATION =====================
function toggleHamburger() {
  const dd = document.getElementById('hamburger-dropdown');
  const ov = document.getElementById('hm-overlay');
  dd.classList.toggle('open');
  ov.classList.toggle('open');
}

function closeHamburger() {
  document.getElementById('hamburger-dropdown').classList.remove('open');
  document.getElementById('hm-overlay').classList.remove('open');
}

function navigateTo(page) {
  closeHamburger();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');

  document.querySelectorAll('.hm-link').forEach(l => l.classList.remove('active'));
  document.querySelector(`.hm-link[data-page="${page}"]`).classList.add('active');

  const titles = { home:'Dashboard', tracker:'Tracker Manuale', giornaliero:'Piano Giornaliero', settimanale:'Piano Settimanale', alimenti:'Gestione Alimenti' };
  document.getElementById('page-subtitle').textContent = titles[page] || '';

  if (page === 'home') {
    renderHomeDashboard();
  }
  if (page === 'tracker') {
    syncTrackerProfileUI();
    renderTrackerResults();
    renderAllTracker();
    updateTrackerStickyTotals();
  }
  if (page === 'settimanale') {
    renderResults();
    renderWeeklyCalendar();
  }
  if (page === 'giornaliero') {
    // Sync from tracker profile if it was changed there
    document.getElementById('prof-sesso').value = profile.sesso;
    document.getElementById('prof-eta').value = profile.eta;
    document.getElementById('prof-altezza').value = profile.altezza;
    document.getElementById('prof-peso').value = profile.peso;
    document.getElementById('prof-attivita').value = profile.attivita;
    updateDayType();
  }
  if (page === 'alimenti') {
    renderFoodDB();
    renderTemplateManager();
  }

  const stickyBar = document.getElementById('sticky-totals');
  const stickyBarTracker = document.getElementById('sticky-totals-tracker');
  if (page === 'giornaliero' && currentPlan) {
    stickyBar.classList.add('show');
  } else {
    stickyBar.classList.remove('show');
  }
  if (page === 'tracker') {
    updateTrackerStickyTotals();
  } else {
    if (stickyBarTracker) stickyBarTracker.classList.remove('show');
  }
}

function switchTrackerTab(tab) {
  document.querySelectorAll('.tracker-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tracker-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`.tracker-tab-btn.${tab}`).classList.add('active');
  document.getElementById(`tracker-${tab}`).classList.add('active');
  updateTrackerStickyTotals();
}

// ===================== TRACKER RENDERING =====================
function renderAllTracker() {
  DAY_TYPES.forEach(day => renderTrackerDay(day));
}

function renderTrackerDay(day) {
  const container = document.getElementById(`tracker-${day}`);
  const cfg = trackerState[day].config;
  const meals = trackerState[day].meals;

  let totKcal=0, totCarbo=0, totProt=0, totGrassi=0;
  MEALS.forEach(meal => {
    meals[meal].forEach(item => {
      if (item.food && item.grams) {
        const f = FOODS_DB.find(x => x.name === item.food);
        if (f) {
          const g = parseFloat(item.grams)||0;
          totKcal += g/100*f.kcal; totCarbo += g/100*f.carbo;
          totProt += g/100*f.prot; totGrassi += g/100*f.grassi;
        }
      }
    });
  });

  const targets = getTrackerDayTargets(day);
  const targetKcal = targets.kcal;
  const minProt = targets.prot;
  const minGrassi = targets.grassi;
  const minCarbo = targets.carbo;
  const pctProt = minProt > 0 ? totProt/minProt : 0;
  const pctGrassi = minGrassi > 0 ? totGrassi/minGrassi : 0;
  const pctCarbo = minCarbo > 0 ? totCarbo/minCarbo : 0;

  function getStatus(pct) {
    if (pct >= 1) return 'green';
    if (pct >= 0.9) return 'green-light';
    if (pct >= 0.7) return 'orange';
    if (pct >= 0.5) return 'red';
    return 'red-dark';
  }
  function getColor(status) {
    return { green:'var(--green)', 'green-light':'var(--green-light)', orange:'var(--orange)', red:'var(--red)', 'red-dark':'var(--red-dark)' }[status];
  }

  const totMacroKcal = totCarbo*4 + totProt*4 + totGrassi*9;
  const distCarbo = totMacroKcal > 0 ? (totCarbo*4/totMacroKcal*100) : 0;
  const distProt = totMacroKcal > 0 ? (totProt*4/totMacroKcal*100) : 0;
  const distGrassi = totMacroKcal > 0 ? (totGrassi*9/totMacroKcal*100) : 0;

  const dayTypeLabel = day === 'work' ? 'ON - Allenamento' : 'OFF - Riposo';
  const dayTypeColor = day === 'work' ? '#4fc3f7' : '#ffb74d';

  let html = '';
  html += `<div style="padding:8px 12px;margin-bottom:8px;background:var(--card2);border-radius:8px;border:1px solid ${dayTypeColor};display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
    <span style="font-size:0.8em;font-weight:bold;color:${dayTypeColor}">${dayTypeLabel}</span>
    <span style="font-size:0.75em;color:var(--text-dim)">Target: <b>${targetKcal}</b> kcal | P: <b>${minProt}g</b> | G: <b>${minGrassi}g</b> | C: <b>${minCarbo}g</b></span>
  </div>`;

  // Kcal card
  const kcalDiff = totKcal - targetKcal;
  const kcalPct = targetKcal > 0 ? totKcal/targetKcal : 0;
  let kcalStatus='', kcalColor='';
  if (totKcal===0) { kcalStatus=''; kcalColor='var(--text-dim)'; }
  else if (kcalPct>=0.95 && kcalPct<=1.05) { kcalStatus='IN TARGET'; kcalColor='var(--green)'; }
  else if (kcalPct<0.95) { kcalStatus=`${kcalDiff.toFixed(0)} kcal sotto`; kcalColor='var(--orange)'; }
  else { kcalStatus=`+${kcalDiff.toFixed(0)} kcal sopra`; kcalColor='var(--red)'; }

  html += `<div class="kcal-card" style="border-color:${totKcal>0?kcalColor:'var(--accent)'}">
    <div class="kcal-label">Kcal / Target: ${targetKcal}</div>
    <div class="kcal-value">${totKcal.toFixed(0)} <span style="font-size:0.45em;color:${kcalColor}">${kcalStatus}</span></div>
    <div class="macro-bar" style="margin-top:8px;height:7px;background:#2c3e50;border-radius:4px;overflow:hidden"><div style="height:100%;width:${Math.min(kcalPct*100,100)}%;background:${kcalColor};border-radius:4px"></div></div>
    <div style="font-size:0.7em;color:var(--text-dim);margin-top:4px">${(kcalPct*100).toFixed(0)}% del target</div>
  </div>`;

  // Dashboard
  const macrosList = [
    { name:'Proteine', total:totProt, min:minProt, pct:pctProt, gkg:cfg.peso>0?totProt/cfg.peso:0 },
    { name:'Grassi', total:totGrassi, min:minGrassi, pct:pctGrassi, gkg:cfg.peso>0?totGrassi/cfg.peso:0 },
    { name:'Carboidrati', total:totCarbo, min:minCarbo, pct:pctCarbo, gkg:cfg.peso>0?totCarbo/cfg.peso:0 },
  ];
  html += `<div class="dashboard">`;
  macrosList.forEach(m => {
    const status = getStatus(m.pct);
    const color = getColor(status);
    html += `<div class="dash-card status-${status}">
      <div class="macro-name">${m.name}</div>
      <div class="macro-value" style="color:${color}">${m.total.toFixed(1)}g</div>
      <div class="macro-target">target: ${m.min.toFixed(0)}g &middot; ${(m.pct*100).toFixed(0)}%</div>
      <div class="macro-gkg">${m.gkg.toFixed(2)} g/kg</div>
      <div class="macro-bar"><div class="macro-bar-fill" style="width:${Math.min(m.pct*100,100)}%;background:${color}"></div></div>
    </div>`;
  });
  html += `</div>`;

  // Distribution
  if (totMacroKcal > 0) {
    html += `<div class="dist-bar-container">
      <div class="dist-bar">
        <div class="dist-segment" style="width:${distCarbo}%;background:#3498db">C ${distCarbo.toFixed(0)}%</div>
        <div class="dist-segment" style="width:${distProt}%;background:#e74c3c">P ${distProt.toFixed(0)}%</div>
        <div class="dist-segment" style="width:${distGrassi}%;background:#f39c12">G ${distGrassi.toFixed(0)}%</div>
      </div>
      <div class="dist-labels"><span>Carbo: ${distCarbo.toFixed(0)}%</span><span>Prot: ${distProt.toFixed(0)}%</span><span>Grassi: ${distGrassi.toFixed(0)}%</span></div>
    </div>`;
  }

  // Meals
  const mealClasses = ['col','mer1','pranzo','mer2','cena'];
  MEALS.forEach((meal, mi) => {
    let mKcal=0, mC=0, mP=0, mG=0;
    meals[meal].forEach(item => {
      if (item.food && item.grams) {
        const f = FOODS_DB.find(x => x.name === item.food);
        if (f) { const g=parseFloat(item.grams)||0; mKcal+=g/100*f.kcal; mC+=g/100*f.carbo; mP+=g/100*f.prot; mG+=g/100*f.grassi; }
      }
    });

    html += `<div class="meal-group"><div class="meal-header ${mealClasses[mi]}">
      <span>${meal}</span>
      <span class="meal-subtotal">${mKcal.toFixed(0)} kcal | C:${mC.toFixed(0)} P:${mP.toFixed(0)} G:${mG.toFixed(0)}</span>
    </div>`;

    meals[meal].forEach((item, idx) => {
      const f = item.food ? FOODS_DB.find(x => x.name === item.food) : null;
      const g = parseFloat(item.grams)||0;
      html += `<div class="food-row tr-draggable" data-day="${day}" data-meal="${meal}" data-idx="${idx}">
        <select onchange="updateTFood('${day}','${meal}',${idx},this.value)">
          <option value="">-- scegli --</option>
          ${FOODS_DB.map(fd => `<option value="${fd.name}" ${fd.name===item.food?'selected':''}>${fd.name}</option>`).join('')}
        </select>
        <input type="number" placeholder="g" value="${item.grams}" onchange="updateTGrams('${day}','${meal}',${idx},this.value)">
        <div class="calc">${f?(g/100*f.kcal).toFixed(0):'-'}</div>
        <div class="calc">${f?(g/100*f.carbo).toFixed(1):'-'}</div>
        <div class="calc">${f?(g/100*f.prot).toFixed(1):'-'}</div>
        <div class="calc">${f?(g/100*f.grassi).toFixed(1):'-'}</div>
        <button class="sub-btn" onclick="showTrackerSubstitutions('${day}','${meal}',${idx},event)" title="Sostituzioni equivalenti">&#8644;</button>
        <button class="remove-btn" onclick="removeTFood('${day}','${meal}',${idx})">x</button>
      </div>`;
    });

    html += `<button class="add-food-btn" onclick="addTFood('${day}','${meal}')">+ Aggiungi alimento</button></div>`;
  });

  // Bottom totals summary
  html += `<div class="sg-totals" style="margin-top:16px">
    <div><div class="sg-t-label">Kcal</div><div class="sg-t-value">${Math.round(totKcal)}</div><div class="sg-t-label">target: ${targetKcal}</div></div>
    <div><div class="sg-t-label">Proteine</div><div class="sg-t-value">${Math.round(totProt)}g</div><div class="sg-t-label">target: ${Math.round(minProt)}g</div></div>
    <div><div class="sg-t-label">Grassi</div><div class="sg-t-value">${Math.round(totGrassi)}g</div><div class="sg-t-label">target: ${Math.round(minGrassi)}g</div></div>
    <div><div class="sg-t-label">Carboidrati</div><div class="sg-t-value">${Math.round(totCarbo)}g</div><div class="sg-t-label">target: ${Math.round(minCarbo)}g</div></div>
  </div>`;

  // Inline donut charts
  function inlineDonut(label, current, target, color, unit) {
    const pct = target > 0 ? Math.min(current / target, 1.5) : 0;
    const r = 38, cx = 44, cy = 44, stroke = 7;
    const circ = 2 * Math.PI * r;
    const dash = Math.min(pct, 1) * circ;
    const c = pct > 1.05 ? '#ff4444' : pct >= 0.95 ? '#44ff88' : color;
    const diff = Math.round(current - target);
    const diffStr = diff >= 0 ? '+' + diff : '' + diff;
    return `<div style="display:flex;flex-direction:column;align-items:center">
      <svg viewBox="0 0 88 88" width="88" height="88">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="${stroke}"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="${stroke}"
          stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}" stroke-linecap="round"
          transform="rotate(-90 ${cx} ${cy})"/>
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="white" font-size="13" font-weight="bold">${Math.round(current)}${unit||''}</text>
        <text x="${cx}" y="${cy + 10}" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8">/ ${target}${unit||''}</text>
        <text x="${cx}" y="${cy + 22}" text-anchor="middle" fill="${c}" font-size="8">(${diffStr})</text>
      </svg>
      <div style="font-size:0.6em;color:var(--text-dim);text-transform:uppercase;margin-top:2px">${label}</div>
    </div>`;
  }

  const kcDiff = Math.round(totKcal - targetKcal);
  const kcColor = Math.abs(kcDiff) <= 50 ? '#44ff88' : kcDiff > 50 ? '#ff4444' : '#ffaa33';

  html += `<div style="display:flex;justify-content:center;gap:12px;margin-top:12px;flex-wrap:wrap;padding-bottom:90px">
    ${inlineDonut('Kcal', totKcal, targetKcal, kcColor, '')}
    ${inlineDonut('Proteine', totProt, minProt, '#4fc3f7', 'g')}
    ${inlineDonut('Grassi', totGrassi, minGrassi, '#ffb74d', 'g')}
    ${inlineDonut('Carboidrati', totCarbo, minCarbo, '#81c784', 'g')}
  </div>`;

  container.innerHTML = html;
  initTrackerDragDrop(container, day);
}

// ===================== TRACKER DRAG & DROP =====================
let trDragState = null;
let trDragGhost = null;
let trLongPressTimer = null;

function initTrackerDragDrop(container, day) {
  const rows = container.querySelectorAll('.food-row.tr-draggable');
  rows.forEach(row => {
    row.addEventListener('mousedown', onTrDragStart);
    row.addEventListener('touchstart', onTrDragStart, { passive: false });
  });
}

function onTrDragStart(e) {
  if (e.target.closest('select, input, button')) return;
  const row = e.target.closest('.food-row.tr-draggable');
  if (!row) return;

  const day = row.dataset.day;
  const meal = row.dataset.meal;
  const idx = parseInt(row.dataset.idx);
  const startX = e.touches ? e.touches[0].clientX : e.clientX;
  const startY = e.touches ? e.touches[0].clientY : e.clientY;

  e.preventDefault();

  trLongPressTimer = setTimeout(() => {
    trDragState = { day, meal, idx, startX, startY, active: true };

    const item = trackerState[day].meals[meal][idx];
    const foodName = item.food || '(vuoto)';
    trDragGhost = document.createElement('div');
    trDragGhost.className = 'drag-ghost';
    trDragGhost.textContent = foodName;
    trDragGhost.style.left = startX + 'px';
    trDragGhost.style.top = (startY - 20) + 'px';
    document.body.appendChild(trDragGhost);

    document.body.classList.add('is-dragging');
    row.classList.add('tr-dragging');

    if (e.touches) {
      document.addEventListener('touchmove', onTrDragMove, { passive: false });
      document.addEventListener('touchend', onTrDragEnd);
    } else {
      document.addEventListener('mousemove', onTrDragMove);
      document.addEventListener('mouseup', onTrDragEnd);
    }
  }, 400);

  const cancelLongPress = () => {
    clearTimeout(trLongPressTimer);
    trLongPressTimer = null;
    document.removeEventListener('mousemove', cancelLongPress);
    document.removeEventListener('touchmove', cancelLongPress);
  };

  if (e.touches) {
    document.addEventListener('touchmove', cancelLongPress, { once: true, passive: true });
  } else {
    document.addEventListener('mousemove', cancelLongPress, { once: true });
  }
}

function onTrDragMove(e) {
  if (!trDragState || !trDragState.active) return;
  e.preventDefault();

  const x = e.touches ? e.touches[0].clientX : e.clientX;
  const y = e.touches ? e.touches[0].clientY : e.clientY;

  if (trDragGhost) {
    trDragGhost.style.left = x + 'px';
    trDragGhost.style.top = (y - 20) + 'px';
  }

  document.querySelectorAll('.food-row.tr-drag-over-top, .food-row.tr-drag-over-bottom').forEach(el => {
    el.classList.remove('tr-drag-over-top', 'tr-drag-over-bottom');
  });

  const target = document.elementFromPoint(x, y);
  if (!target) return;
  const targetRow = target.closest('.food-row.tr-draggable');
  if (!targetRow || targetRow.classList.contains('tr-dragging')) return;

  const rect = targetRow.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  if (y < midY) {
    targetRow.classList.add('tr-drag-over-top');
  } else {
    targetRow.classList.add('tr-drag-over-bottom');
  }
}

function onTrDragEnd(e) {
  document.removeEventListener('mousemove', onTrDragMove);
  document.removeEventListener('mouseup', onTrDragEnd);
  document.removeEventListener('touchmove', onTrDragMove);
  document.removeEventListener('touchend', onTrDragEnd);
  clearTimeout(trLongPressTimer);

  if (trDragGhost) {
    trDragGhost.remove();
    trDragGhost = null;
  }

  document.body.classList.remove('is-dragging');
  document.querySelectorAll('.food-row.tr-dragging').forEach(el => el.classList.remove('tr-dragging'));

  if (!trDragState || !trDragState.active) { trDragState = null; return; }

  const overTop = document.querySelector('.food-row.tr-drag-over-top');
  const overBottom = document.querySelector('.food-row.tr-drag-over-bottom');
  document.querySelectorAll('.food-row.tr-drag-over-top, .food-row.tr-drag-over-bottom').forEach(el => {
    el.classList.remove('tr-drag-over-top', 'tr-drag-over-bottom');
  });

  const dropRow = overTop || overBottom;
  if (dropRow) {
    const srcDay = trDragState.day;
    const srcMeal = trDragState.meal;
    const srcIdx = trDragState.idx;
    const tgtDay = dropRow.dataset.day;
    const tgtMeal = dropRow.dataset.meal;
    let tgtIdx = parseInt(dropRow.dataset.idx);
    if (overBottom) tgtIdx += 1;

    if (srcDay === tgtDay) {
      const item = trackerState[srcDay].meals[srcMeal].splice(srcIdx, 1)[0];
      if (srcMeal === tgtMeal && tgtIdx > srcIdx) tgtIdx -= 1;
      trackerState[tgtDay].meals[tgtMeal].splice(tgtIdx, 0, item);

      if (trackerState[srcDay].meals[srcMeal].length === 0) {
        trackerState[srcDay].meals[srcMeal].push({ food:'', grams:'' });
      }
      saveTrackerState();
      renderTrackerDay(srcDay);
    }
  }

  trDragState = null;
}



function showTrackerSubstitutions(day, meal, idx, event) {
  event.stopPropagation();
  closeSubPopup();
  const item = trackerState[day] && trackerState[day].meals[meal] ? trackerState[day].meals[meal][idx] : null;
  if (!item || !item.food || !item.grams) return;
  const subs = getSubstitutions(item.food, parseFloat(item.grams) || 0);
  const popup = document.createElement('div');
  popup.className = 'sub-popup';
  if (subs.length === 0) {
    popup.innerHTML = `<div class="sub-popup-title">Nessuna sostituzione per ${item.food}</div>`;
  } else {
    popup.innerHTML = `<div class="sub-popup-title">Sostituzioni per ${item.food} (${item.grams}g)</div>` +
      subs.map((s, si) => {
        const fd = FOODS_DB.find(x => x.name === s.name);
        const kcal = fd ? Math.round(s.grams / 100 * fd.kcal) : '?';
        return `<div class="sub-item" onclick="applyTrackerSubstitution('${day}','${meal}',${idx},${si})">
          <span class="sub-name">${s.name}</span>
          <span class="sub-grams">${s.grams}g (${kcal} kcal)</span>
        </div>`;
      }).join('');
  }
  popup._subs = subs;
  const btn = event.target;
  const rect = btn.getBoundingClientRect();
  popup.style.position = 'fixed';
  popup.style.top = Math.min(rect.bottom + 4, window.innerHeight - 320) + 'px';
  popup.style.left = Math.max(8, Math.min(rect.left - 100, window.innerWidth - 350)) + 'px';
  document.body.appendChild(popup);
  activeSubPopup = popup;
}

function applyTrackerSubstitution(day, meal, idx, subIdx) {
  if (!activeSubPopup || !activeSubPopup._subs) return;
  const sub = activeSubPopup._subs[subIdx];
  if (!trackerState[day] || !trackerState[day].meals[meal] || !trackerState[day].meals[meal][idx]) return;
  trackerState[day].meals[meal][idx].food = sub.name;
  trackerState[day].meals[meal][idx].grams = sub.grams;
  closeSubPopup();
  saveTrackerState();
  renderTrackerDay(day);
  updateTrackerStickyTotals();
  renderHomeDashboard();
}

// ===================== TRACKER ACTIONS =====================
function updateTConfig(day, key, value) {
  trackerState[day].config[key] = parseFloat(value)||0;
  saveTrackerState(); renderTrackerDay(day); updateTrackerStickyTotals();
}
function updateTFood(day, meal, idx, value) {
  trackerState[day].meals[meal][idx].food = value;
  saveTrackerState(); renderTrackerDay(day); updateTrackerStickyTotals();
}
function updateTGrams(day, meal, idx, value) {
  trackerState[day].meals[meal][idx].grams = value;
  saveTrackerState(); renderTrackerDay(day); updateTrackerStickyTotals();
}
function addTFood(day, meal) {
  trackerState[day].meals[meal].push({ food:'', grams:'' });
  saveTrackerState(); renderTrackerDay(day); updateTrackerStickyTotals();
}
function removeTFood(day, meal, idx) {
  trackerState[day].meals[meal].splice(idx, 1);
  if (trackerState[day].meals[meal].length === 0) trackerState[day].meals[meal].push({ food:'', grams:'' });
  saveTrackerState(); renderTrackerDay(day); updateTrackerStickyTotals();
}


function renderProfileTargets(targetElId) {
  const el = document.getElementById(targetElId);
  if (!el) return;
  const tdee = calcTDEE();
  const gs = getGoalSettings();
  const on = calcMacros('ON');
  const off = calcMacros('OFF');
  el.innerHTML = `
    <h2>Profilo e Target</h2>
    <p class="sub-desc">Dati profilo e target manuali ON/OFF usati da Piano Giornaliero, Settimanale e Tracker.</p>
    <div class="profile-grid">
      <div class="field-group"><label>Sesso</label><select id="home-prof-sesso" onchange="updateHomeProfile()"><option value="M" ${profile.sesso==='M'?'selected':''}>Maschio</option><option value="F" ${profile.sesso==='F'?'selected':''}>Femmina</option></select></div>
      <div class="field-group"><label>Età</label><input type="number" id="home-prof-eta" value="${profile.eta}" onchange="updateHomeProfile()"></div>
      <div class="field-group"><label>Altezza</label><input type="number" id="home-prof-altezza" value="${profile.altezza}" onchange="updateHomeProfile()"></div>
      <div class="field-group"><label>Peso</label><input type="number" step="0.1" id="home-prof-peso" value="${profile.peso}" onchange="updateHomeProfile()"></div>
      <div class="field-group"><label>Attività</label><select id="home-prof-attivita" onchange="updateHomeProfile()"><option value="1.2" ${profile.attivita==1.2?'selected':''}>Sedentario</option><option value="1.375" ${profile.attivita==1.375?'selected':''}>Leggera</option><option value="1.55" ${profile.attivita==1.55?'selected':''}>Moderata</option><option value="1.725" ${profile.attivita==1.725?'selected':''}>Intensa</option><option value="1.9" ${profile.attivita==1.9?'selected':''}>Molto intensa</option></select></div>
      <div class="field-group"><label>Giorni ON settimanali</label><input type="text" id="home-on-days" value="${weeklyCalendar.map((v,i)=>v?i+1:null).filter(Boolean).join(',')}" placeholder="es. 1,3,5" onchange="updateHomeWeeklyOnDays()"></div>
    </div>
    <div class="results-grid" style="margin-top:12px">
      <div class="result-item"><div class="r-label">BMR</div><div class="r-value">${Math.round(tdee / profile.attivita)}</div><div class="r-sub">kcal base</div></div>
      <div class="result-item"><div class="r-label">TDEE</div><div class="r-value">${tdee}</div><div class="r-sub">kcal/giorno</div></div>
      <div class="result-item" style="border-color:#4fc3f7"><div class="r-label">Target ON</div><div class="r-value" style="color:#4fc3f7">${on.kcal}</div><div class="r-sub">P:${on.prot} G:${on.grassi} C:${on.carbo}</div></div>
      <div class="result-item" style="border-color:#ffb74d"><div class="r-label">Target OFF</div><div class="r-value" style="color:#ffb74d">${off.kcal}</div><div class="r-sub">P:${off.prot} G:${off.grassi} C:${off.carbo}</div></div>
    </div>
    <div style="margin-top:16px;padding:14px;background:var(--card2);border-radius:10px;border:1px solid var(--border)">
      <div style="font-size:0.8em;color:var(--text-dim);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px">Personalizza Target per Tipo Giornata</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:280px;padding:10px;border-radius:8px;border:1px solid #4fc3f7;background:rgba(79,195,247,0.05)">
          <div style="font-size:0.75em;font-weight:bold;color:#4fc3f7;margin-bottom:8px;text-transform:uppercase">ON - Allenamento</div>
          <div class="target-grid-onoff">
            <div class="field-group"><label>Prot (g/kg)</label><input type="number" step="0.1" value="${gs.on.protGkg.toFixed(1)}" onchange="updateDayTarget('on','protGkg',this.value)"></div>
            <div class="field-group"><label>Grassi (g/kg)</label><input type="number" step="0.1" value="${gs.on.grassiGkg.toFixed(1)}" onchange="updateDayTarget('on','grassiGkg',this.value)"></div>
            <div class="field-group"><label>Carbo (g/kg)</label><input type="number" step="0.1" value="${gs.on.carboGkg.toFixed(1)}" onchange="updateDayTarget('on','carboGkg',this.value)"></div>
          </div>
          <div style="font-size:0.65em;color:var(--text-dim);margin-top:4px">Kcal ON: <b style="color:#4fc3f7">${on.kcal}</b></div>
        </div>
        <div style="flex:1;min-width:280px;padding:10px;border-radius:8px;border:1px solid #ffb74d;background:rgba(255,183,77,0.05)">
          <div style="font-size:0.75em;font-weight:bold;color:#ffb74d;margin-bottom:8px;text-transform:uppercase">OFF - Riposo</div>
          <div class="target-grid-onoff">
            <div class="field-group"><label>Prot (g/kg)</label><input type="number" step="0.1" value="${gs.off.protGkg.toFixed(1)}" onchange="updateDayTarget('off','protGkg',this.value)"></div>
            <div class="field-group"><label>Grassi (g/kg)</label><input type="number" step="0.1" value="${gs.off.grassiGkg.toFixed(1)}" onchange="updateDayTarget('off','grassiGkg',this.value)"></div>
            <div class="field-group"><label>Carbo (g/kg)</label><input type="number" step="0.1" value="${gs.off.carboGkg.toFixed(1)}" onchange="updateDayTarget('off','carboGkg',this.value)"></div>
          </div>
          <div style="font-size:0.65em;color:var(--text-dim);margin-top:4px">Kcal OFF: <b style="color:#ffb74d">${off.kcal}</b></div>
        </div>
      </div>
    </div>`;
}

function updateHomeProfile() {
  profile.sesso = document.getElementById('home-prof-sesso').value;
  profile.eta = parseInt(document.getElementById('home-prof-eta').value) || 30;
  profile.altezza = parseInt(document.getElementById('home-prof-altezza').value) || 175;
  profile.peso = parseFloat(document.getElementById('home-prof-peso').value) || 80;
  profile.attivita = parseFloat(document.getElementById('home-prof-attivita').value) || 1.55;
  profile.goals = buildDefaultGoals(profile);
  saveProfile();
  renderHomeDashboard();
  renderResults();
  syncTrackerProfileUI();
  renderTrackerResults();
  renderAllTracker();
}

function updateHomeWeeklyOnDays() {
  const input = document.getElementById('home-on-days');
  const days = (input && input.value ? input.value : '').split(',').map(x => parseInt(x.trim(), 10) - 1).filter(x => x >= 0 && x < 7);
  weeklyCalendar = [0,1,2,3,4,5,6].map(i => days.includes(i));
  renderWeeklyCalendar();
  renderHomeDashboard();
}


// ===================== FOOD AUTO IMPORT =====================
let barcodeScanner = null;
let barcodeScanLocked = false;

function setBarcodeStatus(message) {
  const el = document.getElementById('barcode-status');
  if (el) el.textContent = message;
}

function openBarcodeScanner() {
  const overlay = document.getElementById('barcode-scanner-overlay');
  if (!overlay) return;
  barcodeScanLocked = false;
  overlay.classList.add('show');
  setBarcodeStatus('Inquadra il codice a barre del prodotto.');
  if (typeof Html5Qrcode === 'undefined') {
    setBarcodeStatus('Scanner non disponibile. Controlla la connessione internet o usa OCR Etichetta.');
    return;
  }
  barcodeScanner = new Html5Qrcode('barcode-reader');
  barcodeScanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 260, height: 160 } },
    code => handleBarcodeDetected(code),
    () => {}
  ).catch(() => setBarcodeStatus('Impossibile aprire la fotocamera. Usa HTTPS o OCR Etichetta.'));
}

function closeBarcodeScanner() {
  const overlay = document.getElementById('barcode-scanner-overlay');
  if (overlay) overlay.classList.remove('show');
  if (barcodeScanner) {
    barcodeScanner.stop().catch(() => {}).finally(() => {
      barcodeScanner.clear().catch(() => {});
      barcodeScanner = null;
    });
  }
}

async function handleBarcodeDetected(code) {
  if (barcodeScanLocked) return;
  barcodeScanLocked = true;
  setBarcodeStatus(`Barcode letto: ${code}. Cerco su Open Food Facts...`);
  try {
    const food = await fetchOpenFoodFactsProduct(code);
    closeBarcodeScanner();
    prefillFoodForm(food, 'Open Food Facts');
  } catch (err) {
    setBarcodeStatus('Prodotto non trovato. Puoi fotografare la tabella nutrizionale con OCR Etichetta.');
    barcodeScanLocked = false;
  }
}

async function fetchOpenFoodFactsProduct(barcode) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,nutriments`);
  if (!res.ok) throw new Error('Open Food Facts non raggiungibile');
  const data = await res.json();
  if (!data || data.status !== 1 || !data.product) throw new Error('Prodotto non trovato');
  const n = data.product.nutriments || {};
  const kcal = parseFloat(n['energy-kcal_100g'] || n['energy-kcal'] || (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0));
  const carbo = parseFloat(n['carbohydrates_100g']);
  const prot = parseFloat(n['proteins_100g']);
  const grassi = parseFloat(n['fat_100g']);
  if (![kcal, carbo, prot, grassi].every(v => Number.isFinite(v))) throw new Error('Valori nutrizionali incompleti');
  return {
    name: [data.product.brands, data.product.product_name].filter(Boolean).join(' - ') || `Prodotto ${barcode}`,
    kcal: kcal,
    carbo: carbo,
    prot: prot,
    grassi: grassi
  };
}

function triggerNutritionOcr() {
  closeBarcodeScanner();
  const input = document.getElementById('nutrition-ocr-input');
  if (input) {
    input.value = '';
    input.click();
  }
}

async function handleNutritionOcr(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (typeof Tesseract === 'undefined') {
    alert('OCR non disponibile. Controlla la connessione internet e riprova.');
    return;
  }
  openFoodForm();
  document.getElementById('food-form-title').textContent = 'Lettura etichetta in corso...';
  try {
    const result = await Tesseract.recognize(file, 'ita+eng');
    const parsed = parseNutritionText(result.data.text || '', file.name);
    prefillFoodForm(parsed, 'OCR Etichetta');
  } catch (err) {
    alert('Non sono riuscito a leggere bene l\'etichetta. Puoi inserire i dati manualmente.');
    document.getElementById('food-form-title').textContent = 'Nuovo Alimento';
  }
}

function parseNutritionText(text, fallbackName) {
  const clean = text.replace(/,/g, '.').replace(/[|]/g, ' ').replace(/\s+/g, ' ');
  function findValue(patterns) {
    for (const pattern of patterns) {
      const match = clean.match(pattern);
      if (match) return parseFloat(match[1]);
    }
    return 0;
  }
  const kcal = findValue([/kcal\s*([0-9]+(?:\.[0-9]+)?)/i, /energia[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)\s*kcal/i, /energy[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)\s*kcal/i]);
  const carbo = findValue([/carboidrati[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)/i, /carbohydrates[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)/i]);
  const prot = findValue([/proteine[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)/i, /protein[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)/i]);
  const grassi = findValue([/grassi[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)/i, /fat[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)/i]);
  const firstLine = (text.split('\n').map(x => x.trim()).find(x => x.length > 3 && !/kcal|energia|nutrition|valori|grassi|carbo|prote/i.test(x)) || '').slice(0, 60);
  return {
    name: firstLine || fallbackName.replace(/\.[^.]+$/, ''),
    kcal: kcal,
    carbo: carbo,
    prot: prot,
    grassi: grassi
  };
}

function prefillFoodForm(food, source) {
  openFoodForm();
  document.getElementById('food-form-title').textContent = `Conferma Alimento (${source})`;
  document.getElementById('ff-name').value = food.name || '';
  document.getElementById('ff-kcal').value = Number.isFinite(food.kcal) ? Math.round(food.kcal * 10) / 10 : '';
  document.getElementById('ff-carbo').value = Number.isFinite(food.carbo) ? Math.round(food.carbo * 10) / 10 : '';
  document.getElementById('ff-prot').value = Number.isFinite(food.prot) ? Math.round(food.prot * 10) / 10 : '';
  document.getElementById('ff-grassi').value = Number.isFinite(food.grassi) ? Math.round(food.grassi * 10) / 10 : '';
  document.getElementById('ff-pref').checked = false;
}

// ===================== FOOD DB MANAGEMENT =====================
let editingFoodIdx = -1;

function renderFoodDB() {
  const search = (document.getElementById('db-search').value || '').toLowerCase();
  const tbody = document.getElementById('db-table-body');
  if (!tbody) return;

  const filtered = FOODS_DB.map((f, i) => ({...f, _idx: i})).filter(f =>
    !search || f.name.toLowerCase().includes(search)
  );

  document.getElementById('db-count').textContent = `${filtered.length} / ${FOODS_DB.length} alimenti`;

  tbody.innerHTML = filtered.map(f => `<tr>
    <td style="font-weight:500">${f.name}</td>
    <td>${f.kcal}</td>
    <td>${f.carbo}</td>
    <td>${f.prot}</td>
    <td>${f.grassi}</td>
    <td><span class="pref-star ${f.pref?'active':''}" onclick="toggleFoodPref(${f._idx})">&#9733;</span></td>
    <td><div class="db-actions">
      <button class="db-edit-btn" onclick="openFoodForm(${f._idx})">Modifica</button>
      <button class="db-del-btn" onclick="deleteFood(${f._idx})">Elimina</button>
    </div></td>
  </tr>`).join('');
}

function toggleFoodPref(idx) {
  FOODS_DB[idx].pref = !FOODS_DB[idx].pref;
  saveFoodsDB();
  rebuildCategories();
  renderFoodDB();
}

function openFoodForm(idx) {
  editingFoodIdx = idx !== undefined ? idx : -1;
  const isEdit = editingFoodIdx >= 0;
  document.getElementById('food-form-title').textContent = isEdit ? 'Modifica Alimento' : 'Nuovo Alimento';

  if (isEdit) {
    const f = FOODS_DB[idx];
    document.getElementById('ff-name').value = f.name;
    document.getElementById('ff-kcal').value = f.kcal;
    document.getElementById('ff-carbo').value = f.carbo;
    document.getElementById('ff-prot').value = f.prot;
    document.getElementById('ff-grassi').value = f.grassi;
    document.getElementById('ff-pref').checked = f.pref;
  } else {
    document.getElementById('ff-name').value = '';
    document.getElementById('ff-kcal').value = '';
    document.getElementById('ff-carbo').value = '';
    document.getElementById('ff-prot').value = '';
    document.getElementById('ff-grassi').value = '';
    document.getElementById('ff-pref').checked = false;
  }
  document.getElementById('food-form-overlay').classList.add('show');
}

function closeFoodForm() {
  document.getElementById('food-form-overlay').classList.remove('show');
  editingFoodIdx = -1;
}

function saveFoodForm() {
  const name = document.getElementById('ff-name').value.trim();
  if (!name) { alert('Inserisci un nome per l\'alimento'); return; }

  const food = {
    name: name,
    kcal: parseFloat(document.getElementById('ff-kcal').value) || 0,
    carbo: parseFloat(document.getElementById('ff-carbo').value) || 0,
    prot: parseFloat(document.getElementById('ff-prot').value) || 0,
    grassi: parseFloat(document.getElementById('ff-grassi').value) || 0,
    pref: document.getElementById('ff-pref').checked
  };

  if (editingFoodIdx >= 0) {
    FOODS_DB[editingFoodIdx] = food;
  } else {
    const exists = FOODS_DB.findIndex(f => f.name.toLowerCase() === name.toLowerCase());
    if (exists >= 0) {
      if (!confirm(`"${name}" esiste gia. Vuoi sovrascriverlo?`)) return;
      FOODS_DB[exists] = food;
    } else {
      FOODS_DB.push(food);
      FOODS_DB.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  saveFoodsDB();
  rebuildCategories();
  closeFoodForm();
  renderFoodDB();
}

function deleteFood(idx) {
  const name = FOODS_DB[idx].name;
  if (!confirm(`Eliminare "${name}" dal database?`)) return;
  FOODS_DB.splice(idx, 1);
  saveFoodsDB();
  rebuildCategories();
  renderFoodDB();
}



// ===================== PRODUCTIVITY FEATURES v2.3 =====================
let lastAutoAdjustSuggestion = 0;
let mealTemplates = loadMealTemplates();
let dayTemplates = loadDayTemplates();

function loadMealTemplates() {
  try { return JSON.parse(localStorage.getItem('newProjectDiet_mealTemplates') || '[]'); } catch(e) { return []; }
}
function saveMealTemplates() { localStorage.setItem('newProjectDiet_mealTemplates', JSON.stringify(mealTemplates)); }
function loadDayTemplates() {
  try { return JSON.parse(localStorage.getItem('newProjectDiet_dayTemplates') || '[]'); } catch(e) { return []; }
}
function saveDayTemplates() { localStorage.setItem('newProjectDiet_dayTemplates', JSON.stringify(dayTemplates)); }

function getTrackerTotals(day) {
  const state = trackerState[day];
  let kcal=0, prot=0, grassi=0, carbo=0;
  if (!state) return { kcal, prot, grassi, carbo };
  MEALS.forEach(meal => state.meals[meal].forEach(item => {
    const f = FOODS_DB.find(x => x.name === item.food);
    const g = parseFloat(item.grams) || 0;
    if (f && g > 0) { kcal += g/100*f.kcal; prot += g/100*f.prot; grassi += g/100*f.grassi; carbo += g/100*f.carbo; }
  }));
  return { kcal, prot, grassi, carbo };
}

function renderHomeDashboard() {
  const grid = document.getElementById('home-dashboard-grid');
  if (!grid) return;
  renderProfileTargets('home-profile-targets');
  const day = new Date().getDay();
  const idx = day === 0 ? 6 : day - 1;
  const isON = weeklyCalendar[idx];
  const trackerDay = isON ? 'work' : 'rest';
  const targets = getTrackerDayTargets(trackerDay);
  const totals = getTrackerTotals(trackerDay);
  const diff = Math.round(totals.kcal - targets.kcal);
  const title = document.getElementById('home-today-title');
  const summary = document.getElementById('home-summary-text');
  if (title) title.textContent = `Oggi: ${isON ? 'ON Allenamento' : 'OFF Riposo'}`;
  if (summary) summary.textContent = `Target ${targets.kcal} kcal. Tracker: ${Math.round(totals.kcal)} kcal (${diff >= 0 ? '+' : ''}${diff}).`;
  grid.innerHTML = [
    ['Target kcal', targets.kcal, `${targets.prot}g P · ${targets.grassi}g G · ${targets.carbo}g C`],
    ['Tracker oggi', Math.round(totals.kcal), `${Math.round(totals.prot)}g P · ${Math.round(totals.carbo)}g C`],
    ['Auto adjust', `${parseInt(profile.autoAdjustDelta)||0} kcal`, 'correzione applicata ai target'],
    ['Template pasti', mealTemplates.length, 'pasti salvati riutilizzabili'],
    ['Template giorno', dayTemplates.length, 'giornate complete salvate'],
  ].map(c => `<div class="home-card"><div class="label">${c[0]}</div><div class="value">${c[1]}</div><div class="sub">${c[2]}</div></div>`).join('');
}

function quickGenerateTodayPlan() { navigateTo('giornaliero'); generateMealPlan(); }
function quickAddTrackerFood() { navigateTo('tracker'); addTFood(getActiveTrackerDay(), 'Colazione'); }
function copyTrackerDay(src, dest) {
  if (!trackerState[src] || !trackerState[dest]) return;
  if (!confirm(`Copiare ${src} in ${dest}?`)) return;
  trackerState[dest].meals = JSON.parse(JSON.stringify(trackerState[src].meals));
  saveTrackerState(); renderAllTracker(); updateTrackerStickyTotals(); renderHomeDashboard();
}
function exportAllData() {
  const data = { version:'2.3', exportedAt:new Date().toISOString(), profile, trackerState, foodsDB:FOODS_DB, weeklyCalendar, weeklyPlans, mealTemplates, dayTemplates };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `new-project-diet-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
}
function importAllData(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!confirm('Importare il backup e sovrascrivere i dati locali?')) return;
      if (data.profile) { profile = data.profile; saveProfile(); }
      if (data.trackerState) { trackerState = data.trackerState; saveTrackerState(); }
      if (data.foodsDB) { FOODS_DB = data.foodsDB; saveFoodsDB(); rebuildCategories(); }
      if (Array.isArray(data.weeklyCalendar)) weeklyCalendar = data.weeklyCalendar;
      if (data.weeklyPlans) weeklyPlans = data.weeklyPlans;
      if (Array.isArray(data.mealTemplates)) { mealTemplates = data.mealTemplates; saveMealTemplates(); }
      if (Array.isArray(data.dayTemplates)) { dayTemplates = data.dayTemplates; saveDayTemplates(); }
      init(); alert('Backup importato correttamente.');
    } catch(e) { alert('Backup non valido.'); }
    event.target.value = '';
  };
  reader.readAsText(file);
}
function generateShoppingList() {
  if (!weeklyPlans || weeklyPlans.length === 0) generateWeeklyPlan();
  const totals = {};
  weeklyPlans.forEach(plan => plan.forEach(meal => meal.items.forEach(it => {
    if (!it.food || !it.grams) return;
    totals[it.food] = (totals[it.food] || 0) + (parseFloat(it.grams) || 0);
  })));
  const entries = Object.entries(totals).sort((a,b) => a[0].localeCompare(b[0]));
  const panel = document.getElementById('shopping-list-panel');
  if (!panel) return;
  panel.style.display = '';
  panel.innerHTML = `<h3>Lista spesa settimanale</h3><div class="btn-row"><button class="btn-export-pdf" onclick="copyShoppingList()">Copia lista</button></div><div class="shopping-list-grid">${entries.map(([name,g]) => `<div class="shopping-item"><span>${name}</span><b>${Math.round(g)}g</b></div>`).join('')}</div>`;
  navigateTo('settimanale');
}
function copyShoppingList() {
  const items = Array.from(document.querySelectorAll('.shopping-item')).map(el => el.innerText.replace('\t', ': ')).join('\n');
  navigator.clipboard.writeText(items).then(() => alert('Lista spesa copiata.')).catch(() => alert(items));
}
function calculateAutoAdjust() {
  const prev = parseFloat(document.getElementById('adj-prev-weight').value);
  const cur = parseFloat(document.getElementById('adj-current-weight').value);
  let targetRate = parseFloat(document.getElementById('adj-target-rate').value);
  if (isNaN(targetRate)) targetRate = profile.goal === 'deficit' ? -0.5 : profile.goal === 'surplus' ? 0.25 : 0;
  const box = document.getElementById('auto-adjust-result');
  if (!prev || !cur || !box) return;
  const actualRate = ((cur - prev) / prev) * 100;
  const gap = actualRate - targetRate;
  let suggestion = Math.abs(gap) < 0.15 ? 0 : (gap > 0 ? -100 : 100);
  if (profile.goal === 'maintenance') suggestion = Math.abs(actualRate) <= 0.2 ? 0 : (actualRate > 0 ? -100 : 100);
  lastAutoAdjustSuggestion = suggestion;
  box.innerHTML = `<b>Trend reale:</b> ${actualRate.toFixed(2)}%/sett · <b>Target:</b> ${targetRate.toFixed(2)}%/sett<br><b>Suggerimento:</b> ${suggestion === 0 ? 'mantieni le calorie attuali' : (suggestion > 0 ? '+' : '') + suggestion + ' kcal/giorno'}`;
}
function applyAutoAdjust() {
  profile.autoAdjustDelta = (parseInt(profile.autoAdjustDelta) || 0) + lastAutoAdjustSuggestion;
  saveProfile(); renderResults(); renderTrackerResults(); renderAllTracker(); renderHomeDashboard();
  alert(`Auto adjust applicato: ${profile.autoAdjustDelta || 0} kcal totali.`);
}
function saveCurrentMealAsTemplate(mi) {
  if (!currentPlan || !currentPlan[mi]) return;
  const name = prompt('Nome template pasto:', currentPlan[mi].name);
  if (!name) return;
  mealTemplates.push({ name, mealName: currentPlan[mi].name, items: JSON.parse(JSON.stringify(currentPlan[mi].items)), createdAt:new Date().toISOString() });
  saveMealTemplates(); renderTemplateManager(); renderHomeDashboard();
}
function applyTemplateToCurrentPlan(ti, mi) {
  if (!currentPlan) { alert('Genera prima un piano giornaliero.'); return; }
  const tpl = mealTemplates[ti];
  if (!tpl) return;
  currentPlan[mi].items = JSON.parse(JSON.stringify(tpl.items));
  renderPlanFromData();
}
function deleteTemplate(ti) {
  if (!confirm('Eliminare questo template?')) return;
  mealTemplates.splice(ti, 1); saveMealTemplates(); renderTemplateManager(); renderHomeDashboard();
}
function renderTemplateManager() {
  const el = document.getElementById('template-manager');
  if (!el) return;
  const mealHtml = mealTemplates.length ? mealTemplates.map((t,i) => `<div class="template-row"><div><b>${t.name}</b><div class="sub-desc">${t.mealName} · ${t.items.length} alimenti</div></div><div><button class="db-edit-btn" onclick="applyTemplateToCurrentPlan(${i},0)">Usa a colazione</button><button class="db-del-btn" onclick="deleteTemplate(${i})">Elimina</button></div></div>`).join('') : '<p class="sub-desc">Nessun template pasto salvato.</p>';
  const dayHtml = dayTemplates.length ? dayTemplates.map((t,i) => `<div class="template-row"><div><b>${t.name}</b><div class="sub-desc">${t.source} · ${t.plan.reduce((n,m)=>n+(m.items?m.items.length:0),0)} alimenti</div></div><div><button class="db-edit-btn" onclick="applyDayTemplateToDailyPlan(${i})">Usa come piano</button><button class="db-edit-btn" onclick="applyDayTemplateToTracker(${i})">Usa nel tracker</button><button class="db-del-btn" onclick="deleteDayTemplate(${i})">Elimina</button></div></div>`).join('') : '<p class="sub-desc">Nessun template giornata salvato.</p>';
  el.innerHTML = `<h3>Template giornate salvate</h3>${dayHtml}<h3 style="margin-top:16px">Template pasti salvati</h3>${mealHtml}`;
}


function normalizeMealName(name) {
  const raw = (name || '').toLowerCase();
  return MEALS.find(m => raw.includes(m.toLowerCase())) || MEALS[0];
}

function planToTrackerMeals(plan) {
  const meals = {};
  MEALS.forEach(m => meals[m] = []);
  if (!Array.isArray(plan)) return meals;
  plan.forEach(meal => {
    const key = normalizeMealName(meal.name);
    meals[key] = (meal.items || []).map(it => ({ food: it.food, grams: parseFloat(it.grams) || 0 })).filter(it => it.food && it.grams > 0);
  });
  return meals;
}

function trackerMealsToPlan(day) {
  const state = trackerState[day];
  if (!state || !state.meals) return null;
  return MEALS.map((mealName, idx) => ({
    name: mealName,
    cls: ['colazione','spuntino','pranzo','spuntino','cena'][idx] || 'pranzo',
    items: (state.meals[mealName] || []).map(it => ({ food: it.food, grams: parseFloat(it.grams) || 0 })).filter(it => it.food && it.grams > 0)
  }));
}

function copyDailyPlanToTracker() {
  if (!currentPlan) { alert('Genera prima un piano giornaliero.'); return; }
  const dest = prompt('Dove copiare il piano? Scrivi work, rest o test:', getDayType() === 'ON' ? 'work' : 'rest');
  if (!['work','rest','test'].includes(dest)) return;
  if (!confirm(`Copiare il Piano Giornaliero nel Tracker ${dest}? I pasti esistenti verranno sovrascritti.`)) return;
  trackerState[dest].meals = planToTrackerMeals(currentPlan);
  saveTrackerState(); renderAllTracker(); renderHomeDashboard(); alert(`Piano copiato nel Tracker ${dest}.`);
}

function copyActiveTrackerToDailyPlan() {
  const day = getActiveTrackerDay();
  const plan = trackerMealsToPlan(day);
  if (!plan) return;
  if (!confirm(`Usare il Tracker ${day} come Piano Giornaliero? Il piano attuale verrà sostituito.`)) return;
  currentPlan = plan;
  renderPlanFromData(); navigateTo('giornaliero');
  document.getElementById('btn-refresh-all').style.display = 'inline-block';
  document.getElementById('btn-export-pdf').style.display = 'inline-block';
  document.getElementById('btn-copy-to-tracker').style.display = 'inline-block';
  document.getElementById('btn-save-day-template').style.display = 'inline-block';
  document.getElementById('btn-clear-plan').style.display = 'inline-block';
}

function saveCurrentPlanAsDayTemplate() {
  if (!currentPlan) { alert('Genera prima un piano giornaliero.'); return; }
  const name = prompt('Nome template giornata:', `Giornata ${getDayType()} ${new Date().toLocaleDateString('it-IT')}`);
  if (!name) return;
  dayTemplates.push({ name, source:'daily-plan', dayType:getDayType(), plan: JSON.parse(JSON.stringify(currentPlan)), createdAt:new Date().toISOString() });
  saveDayTemplates(); renderTemplateManager(); renderHomeDashboard(); alert('Template giornata salvato.');
}

function saveActiveTrackerAsDayTemplate() {
  const day = getActiveTrackerDay();
  const plan = trackerMealsToPlan(day);
  if (!plan) return;
  const name = prompt('Nome template giornata:', `Tracker ${day} ${new Date().toLocaleDateString('it-IT')}`);
  if (!name) return;
  dayTemplates.push({ name, source:`tracker-${day}`, dayType:day, plan, createdAt:new Date().toISOString() });
  saveDayTemplates(); renderTemplateManager(); renderHomeDashboard(); alert('Template giornata salvato.');
}

function applyDayTemplateToDailyPlan(ti) {
  const tpl = dayTemplates[ti];
  if (!tpl) return;
  currentPlan = JSON.parse(JSON.stringify(tpl.plan));
  renderPlanFromData(); navigateTo('giornaliero');
  document.getElementById('btn-refresh-all').style.display = 'inline-block';
  document.getElementById('btn-export-pdf').style.display = 'inline-block';
  document.getElementById('btn-copy-to-tracker').style.display = 'inline-block';
  document.getElementById('btn-save-day-template').style.display = 'inline-block';
  document.getElementById('btn-clear-plan').style.display = 'inline-block';
}

function applyDayTemplateToTracker(ti) {
  const tpl = dayTemplates[ti];
  if (!tpl) return;
  const dest = prompt('Dove caricare il template? Scrivi work, rest o test:', 'test');
  if (!['work','rest','test'].includes(dest)) return;
  if (!confirm(`Caricare il template nel Tracker ${dest}? I pasti esistenti verranno sovrascritti.`)) return;
  trackerState[dest].meals = planToTrackerMeals(tpl.plan);
  saveTrackerState(); renderAllTracker(); renderHomeDashboard(); navigateTo('tracker');
}

function deleteDayTemplate(ti) {
  if (!confirm('Eliminare questo template giornata?')) return;
  dayTemplates.splice(ti, 1); saveDayTemplates(); renderTemplateManager(); renderHomeDashboard();
}

function init() {
  document.getElementById('prof-sesso').value = profile.sesso;
  document.getElementById('prof-eta').value = profile.eta;
  document.getElementById('prof-altezza').value = profile.altezza;
  document.getElementById('prof-peso').value = profile.peso;
  document.getElementById('prof-attivita').value = profile.attivita;
  setGoal(profile.goal);
  renderResults();
  syncTrackerProfileUI();
  renderTrackerResults();
  renderAllTracker();
  updateTrackerStickyTotals();
  updateDayType();
  renderWeeklyCalendar();
}

init();

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      console.log('SW registered:', reg.scope);
    }).catch(err => console.log('SW registration failed:', err));
  });
}