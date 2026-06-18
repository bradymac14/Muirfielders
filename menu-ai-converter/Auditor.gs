/**
 * Auditor.gs  —  FREE, deterministic QA + correction capture (no API, no cost)
 * ---------------------------------------------------------------------------
 * Two free tools that run entirely in Apps Script:
 *
 *  1) QA Audit (Auto)  -> showAuditReport()
 *     Checks the menu currently in the sheet against the rule-checkable parts of
 *     your GEM standards (prices, icons, casing, citations, banned words, etc.)
 *     and shows a score + a list of issues to fix. Works on ANY menu in the
 *     sheet — including ones built by the old Gemini GEM.
 *
 *  2) Capture AI Corrections  -> showCorrectionsReport()
 *     Diffs the current sheet against the snapshot of what the AI produced at
 *     build time, so you can see exactly what your team changed. Logged to a
 *     hidden "AI_Corrections" tab — the raw material for the future learning loop.
 *
 *  Baseline snapshot: aiBuildAndRemember() saves the AI's original JSON, then
 *  calls your existing processMenuJSON(). To enable it, change ONE word in
 *  ConvertSidebar.html (see INSTALL note at bottom of this file).
 * ---------------------------------------------------------------------------
 */

var VALID_SALES_CATS_ = ['Food', 'Alcohol', 'NA Beverage'];

// Build a lowercase lookup of the Approved Icon List (from GEM v48).
var APPROVED_ICON_SET_ = (function () {
  var list = 'Alcoholic Drink 2,Alcoholic Drink 3,Alcoholic Drink 4,Alcoholic Drink 5,Alcoholic Drink 6,Alcoholic Drink,Apple,Avocado,Bacon,Baguette,Baking,Banana,BBQ 2,BBQ 3,BBQ,Beer 2,Beer 3,Beer,Blender,Boiled Egg,Bottle 2,Bottle,Bread,Broccoli,Bun,Burrito,Cake 2,Cake 3,Cake 4,Cake Pop,Cake Slice 2,Cake Slice,Cake,Candy 2,Candy,Carrot,Cauliflower,Caution 1,Caution 2,Caution 3,Champagne,Champagne Glass,Cheese Grater,Cheese Slice,Cheese,Cherries,Chicken,Chili Pepper,Chilled Wine,Chips,Chocolate Chip Cookie,Chocolate Cupcake,Chocolate,Cinnamon Bun,Coffee Beans,Coffee Cup 2,Coffee Cup 3,Coffee Cup,Coffee Machine,Coffee Mug,Coffee,Combo 2,Combo 3,Combo 4,Combo,Cookie 2,Cookie,Corn,Course,Crab,Cracker,Croissant,Cucumber,Cupcake,Dairy Allergy,Dipped Donut,Donut,Drink 2,Drink 3,Drink 4,Drink 5,Drink 6,Drink 7,Drink 8,Drink 9,Drink,Drumstick,Eggplant,Eggs,Fish,Fork Knife,Fork Spoon,Fork,French Fries,Fried Egg,Garlic,Gluten Allergy,Grapefruit Slice,Grapes,Green Onion,Ham,Hamburger 2,Hamburger,Heart,Honey Jar,Honey,Hotdog 2,Hotdog,Ice Cream 2,Ice Cream 3,Ice Cream Cone 2,Ice Cream Cone 3,Ice Cream Cone 4,Ice Cream Cone 5,Ice Cream Cone 6,Ice Cream Cone,Ice Cream,Iced Drink 2,Iced Drink 3,Iced Drink,Iced Whiskey,Jam,Kebab,Kiwi,Knife,Ladle,Lemon Slice,Lemon,Lime Slice,Loaf,Lobster,Lollipop 2,Lollipop 3,Lollipop,Mango,Martini 1,Martini 2,Martini 3,Martini 4,Martini 5,Martini,Meat Prong,Melon,Milk Carton,Milk,Minus,Mixer,Muffin,Mushroom,Noodles 2,Noodles,Olives,Onion,Orange Slice,Oven Mitts,Pan 2,Pan,Pancakes,Pasta,Peach,Peanut Allergy,Pear,Peas,Pepper,Persimmon,Pie,Pineapple,Pitcher,Pizza Cut,Pizza Slice,Pizza,Plus,Pomegranate,Popcorn 2,Popcorn,Popsicle 2,Popsicle 3,Popsicle 4,Popsicle 5,Popsicle,Pot 2,Pot,Potato,Pretzel,Pumpkin,Radish Dipped,Radish,Raspberry,Red Wine,Refrigerator,Retail,Rice,Salad,Salami,Sandwich 2,Sandwich,Sausage,Scale,Server,Shrimp,Soda 2,Soda 3,Soda,Soup 2,Soup,Spatula 2,Spatula 3,Spatula,Spoon,Squash,Star 2,Star 3,Star 4,Star 5,Star 6,Star,Steak 2,Steak,Strawberry Cupcake,Strawberry,Sundae,Sushi 2,Sushi,Taco,Tea 2,Tea Pot,Tea,Toast,Toaster,Tomato Slice,Tomato,Tropical Drink,Vanilla Cupcake,Vegan,Vegetarian,Water Bottle,Water Jug,Watermelon Slice,Watermelon,Whisk,Whiskey,White Wine,Wine and Cheese,Wine Bottle - Red,Wine Bottle - White,Wine';
  var set = {};
  list.split(',').forEach(function (n) { set[n.trim().toLowerCase()] = true; });
  return set;
})();


// ===== 1. AUTO-AUDITOR ======================================================

function showAuditReport() {
  var r = runMenuAudit_();
  var rows = r.issues.map(function (i) {
    return '<tr><td>' + (i.row || '') + '</td><td>' + esc_(i.item) + '</td><td><b>' + esc_(i.rule) + '</b><br><span style="color:#5f6368">' + esc_(i.detail) + '</span></td></tr>';
  }).join('');
  var color = r.score >= 90 ? '#2A7E81' : (r.score >= 70 ? '#a06a00' : '#c5221f');
  var body = '<div style="font-family:Roboto,Arial,sans-serif;padding:16px;">'
    + '<h2 style="margin:0 0 4px;">QA Audit</h2>'
    + '<div style="font-size:13px;color:#5f6368;margin-bottom:12px;">' + r.count + ' items checked &middot; ' + r.issues.length + ' auto-checkable issue(s)</div>'
    + '<div style="font-size:34px;font-weight:700;color:' + color + ';margin-bottom:12px;">' + r.score + '<span style="font-size:16px;">/100</span></div>'
    + (r.issues.length
        ? '<table style="width:100%;border-collapse:collapse;font-size:12px;"><tr style="text-align:left;color:#2A7E81;"><th>Row</th><th>Item</th><th>Issue</th></tr>' + rows + '</table>'
        : '<div style="color:#2A7E81;font-weight:500;">No rule-checkable issues found. (Remember: accuracy vs. the source menu and category judgment still need a human review.)</div>')
    + '<div style="margin-top:14px;font-size:11px;color:#9aa0a6;">Auto-audit covers mechanical rules only (prices, icons, casing, citations, banned words). It does not verify correctness against the original menu.</div>'
    + '</div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(body).setWidth(560).setHeight(620), ' ');
}

function runMenuAudit_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var items = ss.getSheetByName('Your Items');
  var issues = [], count = 0;

  if (items && items.getLastRow() >= 10) {
    var vals = items.getRange(10, 1, items.getLastRow() - 9, 13).getValues();
    vals.forEach(function (r, idx) {
      var name = String(r[0] || '').trim();
      if (!name) return;
      count++;
      var rowNum = 10 + idx;
      var price = String(r[1] || '').trim();
      var sCat = String(r[2] || '').trim();
      var desc = String(r[12] || '').trim();

      if (!price) {
        issues.push(mk_(rowNum, name, 'Missing price', 'Blank price — use a number or "OPEN".'));
      } else if (/[$,£€]/.test(price)) {
        issues.push(mk_(rowNum, name, 'Currency symbol in price', 'Price should be digits only or "OPEN": "' + price + '"'));
      } else if (price.toUpperCase() !== 'OPEN' && !/^\d+(\.\d{1,2})?$/.test(price)) {
        issues.push(mk_(rowNum, name, 'Price format', 'Not a clean number or "OPEN": "' + price + '"'));
      }

      if (sCat && VALID_SALES_CATS_.indexOf(sCat) === -1) {
        issues.push(mk_(rowNum, name, 'Invalid Sales Category', 'Must be Food, Alcohol, or NA Beverage: "' + sCat + '"'));
      }

      if (/\[\d+\]/.test(name) || /\[\d+\]/.test(desc)) {
        issues.push(mk_(rowNum, name, 'Leftover citation', 'Remove bracketed citations like [1], [2].'));
      }
      if (/['’]S\b/.test(name)) {
        issues.push(mk_(rowNum, name, 'Capital after apostrophe', 'e.g. "Tino’S" should be "Tino’s".'));
      }
      if (/[A-Za-z]/.test(name) && name === name.toUpperCase()) {
        issues.push(mk_(rowNum, name, 'Name in ALL CAPS', 'Use Proper Case.'));
      }
      if (/\b(Double|Pitcher)\b/.test(name)) {
        issues.push(mk_(rowNum, name, 'Banned word', 'Use " - DBL" / " - PITCH" instead of the word.'));
      }
      if (/\bOz\b|\bOZ\b/.test(name)) {
        issues.push(mk_(rowNum, name, 'Volume casing', 'Use lowercase "oz".'));
      }
    });
  }

  // Icon check on Your Menu Groups (categories row 5 / icons row 8, per Code.gs layout)
  var groups = ss.getSheetByName('Your Menu Groups');
  if (groups) {
    try {
      var g = groups.getRange('B1:Z150').getValues();
      var catRow = g[4], iconRow = g[7];
      for (var c = 0; c < catRow.length; c++) {
        var cat = String(catRow[c] || '').trim();
        var icon = String(iconRow[c] || '').trim();
        if (cat && icon && !APPROVED_ICON_SET_[icon.toLowerCase()]) {
          issues.push(mk_('', cat, 'Icon not on Approved List', '"' + icon + '" is not a recognized icon.'));
        }
      }
    } catch (e) { /* groups layout differs — skip icon check */ }
  }

  var score = count ? Math.max(0, Math.round(100 * (1 - issues.length / count))) : 100;
  return { count: count, issues: issues, score: score };
}

function mk_(row, item, rule, detail) { return { row: row, item: item, rule: rule, detail: detail }; }
function esc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }


// ===== 2. BASELINE + CORRECTION CAPTURE =====================================

/**
 * Drop-in for the sidebar's build step: saves the AI's original JSON as the
 * "before" snapshot, then routes via your existing processMenuJSON().
 * In ConvertSidebar.html, change ".processMenuJSON(json)" to
 * ".aiBuildAndRemember(json)" so corrections can be detected later.
 */
function aiBuildAndRemember(jsonStr) {
  try { PropertiesService.getDocumentProperties().setProperty('AI_BASELINE', jsonStr); } catch (e) {}
  return processMenuJSON(jsonStr);   // reuse the existing Code.gs routing untouched
}

function showCorrectionsReport() {
  var r = captureCorrections_();
  var body;
  if (!r.ok) {
    body = '<div style="font-family:Roboto,Arial,sans-serif;padding:16px;font-size:13px;">' + esc_(r.message) + '</div>';
  } else if (!r.changes.length) {
    body = '<div style="font-family:Roboto,Arial,sans-serif;padding:16px;font-size:13px;">No differences found between the AI output and the current sheet. (Either nothing was changed, or changes were outside Your Items.)</div>';
  } else {
    var rows = r.changes.map(function (c) {
      return '<tr><td>' + esc_(c.item) + '</td><td>' + esc_(c.type) + '</td><td>' + esc_(c.field) + '</td><td>' + esc_(c.from) + '</td><td>' + esc_(c.to) + '</td></tr>';
    }).join('');
    body = '<div style="font-family:Roboto,Arial,sans-serif;padding:16px;">'
      + '<h2 style="margin:0 0 4px;">AI Corrections Captured</h2>'
      + '<div style="font-size:13px;color:#5f6368;margin-bottom:12px;">' + r.changes.length + ' change(s) your team made vs. the AI output. Logged to the hidden "AI_Corrections" tab.</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:12px;"><tr style="text-align:left;color:#2A7E81;"><th>Item</th><th>Type</th><th>Field</th><th>From</th><th>To</th></tr>' + rows + '</table>'
      + '</div>';
  }
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(body).setWidth(620).setHeight(560), ' ');
}

function captureCorrections_() {
  var base = PropertiesService.getDocumentProperties().getProperty('AI_BASELINE');
  if (!base) return { ok: false, message: 'No AI snapshot found for this menu. Run Convert → Build with the AI tool first, then make your edits, then run this.' };

  var orig = parseBaselineItems_(base);
  var cur = readCurrentItems_();
  var curByName = {}, origByName = {};
  cur.forEach(function (c) { curByName[c.name.toLowerCase()] = c; });
  orig.forEach(function (o) { origByName[o.name.toLowerCase()] = o; });

  var changes = [];
  orig.forEach(function (o) {
    var c = curByName[o.name.toLowerCase()];
    if (!c) { changes.push({ item: o.name, type: 'removed/renamed', field: '', from: o.name, to: '' }); return; }
    if (normPrice_(o.price) !== normPrice_(c.price)) changes.push({ item: o.name, type: 'edited', field: 'Price', from: o.price, to: c.price });
    if (o.salesCat !== c.salesCat) changes.push({ item: o.name, type: 'edited', field: 'Sales Category', from: o.salesCat, to: c.salesCat });
  });
  cur.forEach(function (c) {
    if (!origByName[c.name.toLowerCase()]) changes.push({ item: c.name, type: 'added/renamed', field: '', from: '', to: c.name });
  });

  logCorrections_(changes);
  return { ok: true, changes: changes };
}

function readCurrentItems_() {
  var items = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Your Items');
  var out = [];
  if (items && items.getLastRow() >= 10) {
    items.getRange(10, 1, items.getLastRow() - 9, 13).getValues().forEach(function (r) {
      var name = String(r[0] || '').trim();
      if (!name) return;
      out.push({ name: name, price: String(r[1] || '').trim(), salesCat: String(r[2] || '').trim() });
    });
  }
  return out;
}

function parseBaselineItems_(str) {
  var arr;
  try { arr = JSON.parse(str); }
  catch (e) {
    var m = String(str).match(/\{[\s\S]*?\}/g) || [];
    arr = m.map(function (x) { try { return JSON.parse(x.replace(/,[\s\r\n\t]*([\]}])/g, '$1')); } catch (e2) { return null; } }).filter(Boolean);
  }
  if (!Array.isArray(arr)) arr = [];
  return arr.map(function (it) {
    return {
      name: String(it.Name || it.Item || '').trim(),
      price: normPrice_(it.Price),
      salesCat: String(it['Sales Category'] || it.SalesCategory || '').trim()
    };
  }).filter(function (x) { return x.name; });
}

function normPrice_(p) {
  var s = String(p == null ? '' : p).replace(/[$,]/g, '').trim();
  if (s.toUpperCase() === 'OPEN') return 'OPEN';
  var n = parseFloat(s);
  return isNaN(n) ? s : n.toFixed(2);
}

function logCorrections_(changes) {
  if (!changes.length) return;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('AI_Corrections');
    if (!sh) {
      sh = ss.insertSheet('AI_Corrections');
      sh.appendRow(['Timestamp', 'Item', 'Type', 'Field', 'From', 'To']);
      sh.hideSheet();
    }
    var now = new Date();
    changes.forEach(function (c) { sh.appendRow([now, c.item, c.type, c.field, c.from, c.to]); });
  } catch (e) { /* logging is best-effort */ }
}

/*
 * INSTALL NOTES
 * 1) Add this file as a Script file named "Auditor".
 * 2) In your onOpen() (Code.gs), add these two items:
 *      .addItem('QA Audit (Auto)', 'showAuditReport')
 *      .addItem('Capture AI Corrections', 'showCorrectionsReport')
 * 3) In ConvertSidebar.html, change ONE word so the snapshot is saved:
 *      .processMenuJSON(json)   ->   .aiBuildAndRemember(json)
 */
