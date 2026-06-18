/**
 * AIConvert.gs  —  In-Sheet "Convert Menu (AI)" tool
 * ---------------------------------------------------------------------------
 * Adds an upload-a-menu-file step INSIDE the spreadsheet, powered by Claude.
 * It replaces the manual "drop file into Gemini GEM -> copy JSON -> paste"
 * round-trip. It produces the SAME JSON your GEM produces and hands it to your
 * EXISTING processMenuJSON() in Code.gs — so routing/tabs/cloud are untouched.
 *
 * WORKS OUT OF THE BOX IN STUB MODE: with no API key set, the Convert button
 * returns a small sample menu so you can test upload -> review -> Build end to
 * end. Add an API key (see INSTALL.md) to switch on the real Claude call.
 *
 *  ⚠️  onOpen():  Your Code.gs already defines onOpen(). Do NOT add a second
 *  one. Instead, REPLACE the onOpen() in Code.gs with the version in
 *  INSTALL.md (it keeps all your existing items and adds "Convert Menu (AI)").
 * ---------------------------------------------------------------------------
 */

// ===== CONFIG ===============================================================
var AI_MODEL      = 'claude-opus-4-8';   // strongest; for faster/cheaper use 'claude-sonnet-4-6'
var AI_MAX_TOKENS = 16000;               // raise for very large menus (watch Apps Script timeouts)
var AI_API_URL    = 'https://api.anthropic.com/v1/messages';
// ===========================================================================


/** Opens the sidebar. Wire this to a menu item in your onOpen() (see INSTALL.md). */
function showConvertSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('ConvertSidebar')
    .setTitle('Convert Menu (AI)');
  SpreadsheetApp.getUi().showSidebar(html);
}


/**
 * Called by the sidebar. Takes the uploaded file (base64), sends it to Claude
 * with your GEM logic, and returns the JSON string for review.
 * If no API key is configured, returns a STUB sample so the pipeline is testable.
 */
function convertMenuFile(base64, mimeType, fileName) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');

  if (!apiKey) {
    return { stub: true, json: STUB_MENU_JSON_, note: 'No API key set — showing a sample so you can test the flow. See INSTALL.md to go live.' };
  }

  if (mimeType !== 'application/pdf' && mimeType.indexOf('image/') !== 0) {
    throw new Error('Unsupported file type: ' + mimeType + '. Upload a PDF or an image (PNG/JPG/WEBP).');
  }

  var systemPrompt = GEM_SYSTEM_PROMPT_ + getCorrectionExamples_();   // examples hook = future learning loop
  var raw = callClaude_(apiKey, systemPrompt, base64, mimeType);
  return { stub: false, json: stripFences_(raw) };
}


/**
 * The ONLY place the model is called. To move to Claude on Google Vertex AI
 * later (the IT/data-residency option), swap AI_API_URL + the auth header here
 * and change nothing else.
 */
function callClaude_(apiKey, systemPrompt, base64, mimeType) {
  var sourceBlock = (mimeType === 'application/pdf')
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image',    source: { type: 'base64', media_type: mimeType,         data: base64 } };

  var body = {
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [
        sourceBlock,
        { type: 'text', text: 'Convert this menu into the Build Tool JSON (Block 1: Menu Items). Output ONLY a JSON array of item objects — no prose, no markdown.' }
      ]
    }]
  };

  var res = UrlFetchApp.fetch(AI_API_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  var parsed;
  try { parsed = JSON.parse(res.getContentText()); }
  catch (e) { throw new Error('Claude returned a non-JSON response (HTTP ' + code + ').'); }

  if (code !== 200) {
    var msg = (parsed && parsed.error && parsed.error.message) ? parsed.error.message : res.getContentText();
    throw new Error('Claude API error ' + code + ': ' + msg);
  }

  var text = '';
  (parsed.content || []).forEach(function (b) { if (b.type === 'text') text += b.text; });
  if (!text.trim()) throw new Error('Claude returned an empty result. Try again or check the file.');
  return text;
}


/** Strip ```json fences if the model wraps its output. processMenuJSON is tolerant, but this keeps it clean. */
function stripFences_(s) {
  return String(s).replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}


/**
 * Hook for the future learning loop. Today returns "" (no examples).
 * Later: read approved corrections (e.g. from a hidden tab or Properties) and
 * return them as few-shot examples appended to the system prompt. Nothing else
 * needs to change to switch the loop on.
 */
function getCorrectionExamples_() {
  return '';
}


// ===== STUB SAMPLE (used only when no API key is set) =======================
var STUB_MENU_JSON_ = JSON.stringify([
  { "Name": "Margherita Pizza", "Price": "14.99", "Sales Category": "Food",       "Category": "Pizzas", "linked_modifier_groups": [], "Description": "", "Page": "Menu", "icon": "Pizza" },
  { "Name": "Caesar Salad",     "Price": "10.00", "Sales Category": "Food",       "Category": "Salads", "linked_modifier_groups": [], "Description": "", "Page": "Menu", "icon": "Salad" },
  { "Name": "House Lager - PINT","Price": "7.50",  "Sales Category": "Alcohol",    "Category": "Beer",   "linked_modifier_groups": [], "Description": "", "Page": "Menu", "icon": "Beer" },
  { "Name": "Cola",             "Price": "3.00",  "Sales Category": "NA Beverage","Category": "Soft Drinks", "linked_modifier_groups": [], "Description": "", "Page": "Menu", "icon": "Soda" }
], null, 2);


// ===== GEM LOGIC (system prompt) ============================================
// This is your GEM_INSTRUCTIONS_MASTER_SOURCE v48.0 logic, used as the system
// prompt so Claude converts menus the same way your GEM does. Edit here to
// update the logic (version-controlled — no more editing a hidden GEM UI).
var GEM_SYSTEM_PROMPT_ = [
'You convert restaurant menu documents (PDF/image/text) into a strictly structured JSON Array of Core Menu Items for TouchBistro POS integration (the "Block 1: Menu Items" for the v33.8 Build Tool).',
'',
'Each JSON object MUST use exactly these keys: "Name", "Price", "Sales Category", "Category", "linked_modifier_groups" (array), "Description", "Page", "icon".',
'Output ONLY the JSON array. No prose, no markdown fences.',
'',
'=== 1. DATA EXTRACTION & MATRIX EXPANSION (INTEGRITY) ===',
'NO HALLUCINATIONS: NEVER invent menu descriptions. If not explicitly provided, leave Description "".',
'NAME FIDELITY: Extract names exactly as branded ("All Meat Pizza"). Do not shorten/clean branded names. Fix clear misspellings ("Coffe" -> "Coffee"). For Pizzas/Sandwiches, append "Pizza"/"Sandwich" if missing so the item is unique ("Margarita" -> "Margarita Pizza", "Chicken" -> "Chicken Sandwich").',
'UNPACK PARENTHESES: Items with options in parentheses ("Rum (Spiced, White)") become separate unique objects. Exception: NOT for wing flavors or items where flavors are clearly modifiers.',
'SLASH UNPACKING: Items separated by a slash ("Still/Sparkling") become unique items, append the choice: "Orangeade Still", "Orangeade Sparkling".',
'FLAVOR EXPANSION: Multiple flavors ("Pop - Orange, Lime") -> one object per flavor as "[Brand/Product] - [Flavor]". NOT for wings. For high-variance categories (Bagels, Cream Cheese), make the Size/Quantity tier the Menu Item and map specific flavors as modifiers.',
'GRID EXTRACTION: Types (Lager, Ale) x sizes (20oz, 60oz) -> generate the full matrix ("Lager - 20oz", "Lager - 60oz").',
'HEADER DISCOVERY: Identify top-level Menu Titles ("Lunch Menu", "Dinner Menu") as Environment Anchors; items inherit that context. Do not invent titles.',
'RECURSIVE HEADER AUDIT: Treat distinct headers ("Premium Sides" vs "Sides") as unique containers; do not merge similar names.',
'PROPERTY-BASED DEDUPLICATION: If an item has the exact same Name and Price across sections, keep the Name identical for both (single SKU, multiple placements).',
'STRUCTURAL INTEGRITY: Only create an object if a Name AND Price are physically present. No placeholder/empty objects for headers.',
'IMPLICIT SECTION PRICING: If items in a section lack prices, scan for a shared price line ("Cup 7 Bowl 9") and propagate.',
'SHARED PRICE UNPACKING: With a shared price line, generate unique objects per item-size combo ("Tomato Basil Soup - Cup", "- Bowl"). Never use "OPEN" if a shared price exists.',
'ARRAY SEQUENCE INTEGRITY: Preserve the physical document order. Output each Environment Anchor block (Lunch, then Dinner, then Bar) as one continuous block; never interleave anchors.',
'',
'=== 2. MENU PAGE LOGIC (v44.0) ===',
'SMALL MENU OVERRIDE: If unique Categories < 20, set "Page":"Menu" for ALL items.',
'CONSOLIDATED FOOD PAGE: If Categories >= 20, all Food -> "Page":"Food".',
'THE BAR RULE: If Categories >= 20, all Alcohol AND NA Beverages -> "Page":"Bar".',
'SCHEDULED MENU EXCEPTION: If Environment Anchors exist (Lunch/Dinner), use the anchor as the "Page" value (overrides Small Menu Logic).',
'CATEGORICAL SUFFIXING (Category field only): Append " - L" to the Category for items under a Lunch header (e.g. "Soups - L"). Do NOT suffix Dinner/General categories.',
'NAME RULE: Do NOT suffix the Name if Name and Price are identical across environments.',
'PRICE DELTA EXCEPTION: If the same item name has different prices across environments ($9 Lunch vs $10 Dinner), suffix the Name ("Tomato Basil Soup - L", "Tomato Basil Soup - D") — these are unique SKUs.',
'CATEGORICAL GROUPING: Within each environment block, output all items of a Category consecutively before the next category.',
'',
'=== 3. FORMATTING & GLOBAL MAPPING ===',
'CONTEXTUAL NAMING MATRIX: Jarritos -> "[Brand] - [Flavor]"; Milkshake -> "[Flavor] Milkshake - [Size]"; Bottled Soda -> "[Flavor] - BTL"; Fresh Waters -> "[Flavor] [Size]" (no hyphen); Canned Soda -> "[Item Name]"; Specific Branded -> "[Brand] [Container]".',
'PROPER CASE: First letter of each word capitalized. No capital after apostrophe ("Tino\'S" -> "Tino\'s"). Use "lbs" not "LBS", "ml" not "Ml", "oz" not "Oz".',
'NON-LATIN CHARACTERS: Flag if a menu includes non-latin characters.',
'WELL DRINK NAMING: "Standard Well Drink" -> "[Spirit] - Well".',
'DIETARY SHORTHAND: Identify (GF, V, VG, DF, VGN). REMOVE from Name and PREPEND to Description in brackets: "[GF, V] Description text".',
'SIDE PREFIX: Add "Side " to items in Extras/Sides ONLY if needed for uniqueness (a similar item exists elsewhere). Skip if "Side"/"Extra" already present.',
'ALCOHOL NAMES: Strip ABV percentages but PRESERVE years/vintages.',
'CLEANUP: NO CITATIONS. Remove all brackets like [1], [2].',
'',
'=== 4. PRICING, SUFFIXES & QUANTITIES (ZERO-TOLERANCE) ===',
'NO ROUNDING/MATH: Every digit/decimal must match the source exactly (15.99 stays 15.99).',
'PRICE SANITIZATION: Remove currency symbols and commas. Numbers only, or "OPEN".',
'PRICE RANGES / NO PRICE: Use "OPEN". MKT / Market Price / (MKT) -> "OPEN".',
'NUMERIC PRIORITY: Never use "OPEN" if a numeric value is visible in/near the item line — extract it.',
'STANDARD SUFFIXES: - 6oz, - 9oz, - 12oz, - 16oz, - BTL, - GLS, - CAN, - PITCH, - JAR, - REG, - PINT. Single = SNGL. Do not add " - REG" unless "Regular"/"R" is used.',
'SUFFIX DEDUPLICATION: If the size/container is already in the Name via the Naming Matrix, do not append a second suffix.',
'KIDS/SENIORS: For Kids/Seniors sections, suffix items " - K" / " - S" (not " - Kids"/" - Seniors").',
'VOLUME STANDARDIZATION: Convert to " - [Number]oz" or " - [Number]ML". Exception: keep "PINT" verbatim as " - PINT".',
'SIZE MODIFIERS: S/M/L -> " - SM", " - MED", " - LG".',
'DRAFT BEER: Append " - DFT" to draft/tap beers ONLY if needed for uniqueness; not if name already has - GLS, - PINT, or - PITCH.',
'BEST PRACTICE: Never the words "Double"/"Pitcher". Use " - DBL" and " - PITCH".',
'QUANTITY CONVERSION: "Half Dozen" -> (6); "Dozen" -> (12) (no hyphen); "1/2 pound"/"full pound" -> 1/2lb, 1lb; "Baker\'s Dozen" -> (13).',
'UNIVERSAL ALCOHOL FORMAT SEQUENCING (within a beverage category, smallest->largest, never interleave formats):',
'  Liquor/Spirits: singles/base pours (or SNGL) first, then doubles (- DBL), then flights/carafes.',
'  Wine: glass formats (- GLS, 6oz, 9oz) first sorted smallest->largest, then bottles (- BTL), then large format (- MAG).',
'  Beer/Cider: containers (- CAN, - BTL) first, then single-pour draft (- PINT, 14oz, 20oz), then bulk (- PITCH).',
'',
'=== 5. ROUTING & ICONS ===',
'SALES CATEGORY: one of "Food", "Alcohol", "NA Beverage".',
'(Prep station and course are derived downstream: Food->Kitchen/Course 1; Alcohol & NA Beverage->Bar/Drinks.)',
'SMART ICON SELECTION (the "icon" field, applied at Category level): prioritize a literal noun match between the Category name and the Approved Icon List. "Burgers" -> Hamburger; "Beverages" -> a Drink/Soda/Beer icon. Do not reuse one icon (e.g. Star) for every category if distinct noun matches exist. Use "Star" ONLY for abstract categories ("Specialties", "Award Winning") with no noun match.',
'APPROVED ICON LIST: Alcoholic Drink 2, Alcoholic Drink 3, Alcoholic Drink 4, Alcoholic Drink 5, Alcoholic Drink 6, Alcoholic Drink, Apple, Avocado, Bacon, Baguette, Baking, Banana, BBQ 2, BBQ 3, BBQ, Beer 2, Beer 3, Beer, Blender, Boiled Egg, Bottle 2, Bottle, Bread, Broccoli, Bun, Burrito, Cake 2, Cake 3, Cake 4, Cake Pop, Cake Slice 2, Cake Slice, Cake, Candy 2, Candy, Carrot, Cauliflower, Caution 1, Caution 2, Caution 3, Champagne, Champagne Glass, Cheese Grater, Cheese Slice, Cheese, Cherries, Chicken, Chili Pepper, Chilled Wine, Chips, Chocolate Chip Cookie, Chocolate Cupcake, Chocolate, Cinnamon Bun, Coffee Beans, Coffee Cup 2, Coffee Cup 3, Coffee Cup, Coffee Machine, Coffee Mug, Coffee, Combo 2, Combo 3, Combo 4, Combo, Cookie 2, Cookie, Corn, Course, Crab, Cracker, Croissant, Cucumber, Cupcake, Dairy Allergy, Dipped Donut, Donut, Drink 2, Drink 3, Drink 4, Drink 5, Drink 6, Drink 7, Drink 8, Drink 9, Drink, Drumstick, Eggplant, Eggs, Fish, Fork Knife, Fork Spoon, Fork, French Fries, Fried Egg, Garlic, Gluten Allergy, Grapefruit Slice, Grapes, Green Onion, Ham, Hamburger 2, Hamburger, Heart, Honey Jar, Honey, Hotdog 2, Hotdog, Ice Cream 2, Ice Cream 3, Ice Cream Cone 2, Ice Cream Cone 3, Ice Cream Cone 4, Ice Cream Cone 5, Ice Cream Cone 6, Ice Cream Cone, Ice Cream, Iced Drink 2, Iced Drink 3, Iced Drink, Iced Whiskey, Jam, Kebab, Kiwi, Knife, Ladle, Lemon Slice, Lemon, Lime Slice, Loaf, Lobster, Lollipop 2, Lollipop 3, Lollipop, Mango, Martini 1, Martini 2, Martini 3, Martini 4, Martini 5, Martini, Meat Prong, Melon, Milk Carton, Milk, Minus, Mixer, Muffin, Mushroom, Noodles 2, Noodles, Olives, Onion, Orange Slice, Oven Mitts, Pan 2, Pan, Pancakes, Pasta, Peach, Peanut Allergy, Pear, Peas, Pepper, Persimmon, Pie, Pineapple, Pitcher, Pizza Cut, Pizza Slice, Pizza, Plus, Pomegranate, Popcorn 2, Popcorn, Popsicle 2, Popsicle 3, Popsicle 4, Popsicle 5, Popsicle, Pot 2, Pot, Potato, Pretzel, Pumpkin, Radish Dipped, Radish, Raspberry, Red Wine, Refrigerator, Retail, Rice, Salad, Salami, Sandwich 2, Sandwich, Sausage, Scale, Server, Shrimp, Soda 2, Soda 3, Soda, Soup 2, Soup, Spatula 2, Spatula 3, Spatula, Spoon, Squash, Star 2, Star 3, Star 4, Star 5, Star 6, Star, Steak 2, Steak, Strawberry Cupcake, Strawberry, Sundae, Sushi 2, Sushi, Taco, Tea 2, Tea Pot, Tea, Toast, Toaster, Tomato Slice, Tomato, Tropical Drink, Vanilla Cupcake, Vegan, Vegetarian, Water Bottle, Water Jug, Watermelon Slice, Watermelon, Whisk, Whiskey, White Wine, Wine and Cheese, Wine Bottle - Red, Wine Bottle - White, Wine.',
'',
'FINAL OUTPUT: a single JSON array of item objects with the exact keys listed above. No commentary.'
].join('\n');
