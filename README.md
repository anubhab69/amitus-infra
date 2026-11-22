# 🏗️ Real Estate & Construction Multi-Site Inventory Management System

A high-performance, easy-to-use inventory management application designed specifically for real estate developers and construction business owners. It allows tracking ongoing site projects, monitoring stock levels with critical reorder alerts, comparing standard market prices against subsidized rates, and executing rapid updates with one-click shortcuts.

---

## 🌟 Key Features

### 1. 🏢 Multi-Site Construction Project Tracking
- **Multiple Site Projects**: Track simultaneous projects such as residential high-rise towers, villa gated communities, commercial shopping complexes, and central logistics stockyards.
- **Site Supervisor Details**: Assign and view in-charge supervisors and click-to-call phone numbers for every site.
- **Material Budget vs. Actual Spend**: Live progress bars tracking current material expenditure against allocated site budgets.
- **Site Status Badges**: Monitor project stages (`Active`, `Finishing`, `Planning`, `On Hold`, `Completed`).
- **Global Site Switcher**: Switch the entire dashboard, inventory view, or report view to a specific project with one click.

### 2. 💰 Pricing, Total Cost & Subsidized Rate Tracking
- **Standard Market Price vs. Subsidized Net Rate**: Track both normal vendor list price and builder/contractor subsidized or discounted rate for every single material.
- **Subsidy Scheme Logging**: Record specific schemes (e.g., PMAY Affordable Housing Subsidy, Bulk Builder Tier-1 Discount, Direct Kiln Association Rate, Fly Ash Concession).
- **Executive Financial Dashboard**:
  - **Total Market Valuation**: Total portfolio value at standard dealer list prices.
  - **Total Subsidized Rate**: Total actual procurement cost to the business.
  - **Net Subsidy Saved / Claimable**: Exact money saved in ₹ and overall percentage discount.
- **Auto-Calculating Form Preview**: Live standard vs. subsidized comparison as you type prices and quantities.

### 3. ⚡ Rapid Shortcuts (No Manual Line-by-Line Typing!)
- **1-Click Rapid Stock Delta Buttons**: Every item row has instant `+10`, `+50`, `+100`, `-10`, `-50` buttons to adjust stock on the fly.
- **⭐ 1-Click Common Construction Materials Catalog (`Q`)**:
  - Pre-loaded with 25+ real-world construction materials across all trades:
    - *Cement & Binding*: UltraTech PPC 50kg, ACC Concrete+, Ready Mix Concrete (RMC) M25
    - *Steel & Structural*: Tata Tiscon TMT Fe550D (10mm, 12mm), Jindal Panther (16mm), GI Binding Wire
    - *Masonry & Bricks*: Class 1 Red Clay Kiln Bricks, Fly Ash Bricks, AAC Lightweight Blocks
    - *Aggregates & Sand*: Natural River Sand, M-Sand (Zone II), Blue Metal Aggregates (10mm, 20mm)
    - *Paints & Waterproofing*: Asian Paints Apex Weatherproof, Royale Interior, Dr. Fixit 201 LW+
    - *Plumbing & Electrical*: Astral CPVC 1", Supreme PVC 4", Finolex FRLS Copper Wire, Schneider MCBs
    - *Flooring & Formwork*: Kajaria Vitrified Tiles, Marine Grade Plywood, Scaffolding Pipes, Site Safety Kits
  - Click **1-Click Add**, choose the site and quantity, and it immediately populates units, market rates, and subsidized rates.
- **🔄 Inter-Site Stock Transfer (`T`)**: Move 100 bags of cement or 5 tons of steel from the Central Yard to an active site in 2 clicks.
- **📥 Quick Inward Delivery Challan (`I`)**: Rapidly log incoming delivery trucks with delivery slip number, vehicle number, and receiver name.
- **📤 Quick Site Consumption (`O`)**: Log materials consumed for today's slab casting or masonry work.

### 4. ⌨️ Global Keyboard Shortcuts
| Key | Action |
|:---:|:---|
| <kbd>N</kbd> | Add New Material Modal |
| <kbd>P</kbd> | Register New Site Project Modal |
| <kbd>Q</kbd> | Open 1-Click Common Materials Catalog |
| <kbd>T</kbd> | Open Inter-Site Stock Transfer Modal |
| <kbd>I</kbd> | Open Quick Inward Delivery Challan |
| <kbd>O</kbd> | Open Issue / Consume On Site Modal |
| <kbd>/</kbd> | Focus Global Search Bar |
| <kbd>1</kbd> | Switch to Executive Dashboard & Financials |
| <kbd>2</kbd> | Switch to Sites & Projects Tab |
| <kbd>3</kbd> | Switch to Inventory Master View |
| <kbd>4</kbd> | Switch to Shortcuts & Operations Center |
| <kbd>5</kbd> | Switch to Delivery Slips & Movement Log |
| <kbd>6</kbd> | Switch to Bill of Quantities (BOQ) Statement |
| <kbd>?</kbd> | View Shortcuts Cheatsheet |
| <kbd>Esc</kbd> | Close Any Active Modal |

### 5. 📑 Bill of Quantities (BOQ) & Audit Reports
- **Print / PDF Ready**: Dedicated `@media print` layout formatting an official A4 document with your company header, date stamps, and signature blocks for Store Incharge, Project Engineer, and Managing Director.
- **Excel CSV Export**: One-click download of full inventory or delivery log into `.csv` for accounting or audits.
- **Full JSON Backup & Restore**: Safe zero-friction backup of the entire database.

---

## 🚀 How to Run the Application

### Option A: Using the Launch Script
```bash
./start.sh
```

### Option B: Using Node directly
```bash
node server.js
```

Then open your browser and navigate to:
```
http://localhost:3000
```

---

## 🛠️ Architecture & Reliability
- **Zero External Dependencies**: Built with pure native Node.js (`http`, `fs`, `path`, `crypto`). No heavy `node_modules` or fragile dependencies required.
- **Atomic Disk Persistence**: Automatically saves data to `data/inventory_db.json` with temporary file swaps to prevent corruption during sudden power losses.
- **Responsive & Modern**: Crisp layout with custom CSS variables, dark/light mode toggle, and mobile/tablet responsive design for site visits.
