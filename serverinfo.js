const express = require('express');
const axios = require('axios');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

const PORT = process.env.PORT || 10000;
const ADMIN_PASSWORD = "P)a1s2s2"; 

// --- 1. CONECTARE MONGODB ---
const MONGO_URI = "mongodb+srv://gheorghitadavid_db_user:P)a1s2s2@cluster0.dun9hav.mongodb.net/?appName=Cluster0";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Conectat la MongoDB"))
    .catch(err => console.error("❌ Eroare DB:", err));

// --- 2. SCHEME DATE ---
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: { type: String },
    score: { type: Number, default: 0 },
    avatar: { type: String, default: "https://i.imgur.com/6VBx3io.png" },
    rezolvate: { type: Map, of: Number, default: {} },
    friends: [String],
    claseInrolate: [String],
    lastActive: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const ProblemaSchema = new mongoose.Schema({
    nr: { type: Number, required: true }, 
    titlu: { type: String, required: true }, 
    dificultate: { type: String, default: "Mediu" }, 
    categorie: { type: String, default: "Diverse" },
    cerinta: String, 
    teste: Array
});
const Problema = mongoose.model('Problema', ProblemaSchema);

const ClasaSchema = new mongoose.Schema({
    nume: String, 
    cod: { type: String, unique: true }, 
    parolaClasa: String, 
    creator: String,
    materiale: [{ titlu: String, continut: String }], 
    teme: [{ titlu: String, problemaId: String }]
});
const Clasa = mongoose.model('Clasa', ClasaSchema);

const SubmissionSchema = new mongoose.Schema({
    username: String, 
    problemaId: String, 
    problemaTitlu: String,
    scor: Number, 
    timp: String, 
    memorie: String, 
    codDimensiune: Number, 
    codSursa: String, 
    data: { type: Date, default: Date.now }
});
const Submission = mongoose.model('Submission', SubmissionSchema);

// --- 3. MIDDLEWARE ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ 
    secret: 'rizz-ultra-key-infodinfotoliu', 
    resave: false, 
    saveUninitialized: true 
}));

app.use(async (req, res, next) => {
    if (req.session.user) { 
        await User.updateOne({ username: req.session.user }, { lastActive: new Date() }); 
    }
    next();
});

// --- HELPER DESIGN (Design-ul tău original) ---
const renderPage = (title, content, activeNav = '') => `
<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | INFODINFOTOLIU</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #030712; color: #f9fafb; margin: 0; }
        .glass-header { background: rgba(3, 7, 18, 0.85); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.08); }
        .nav-link { color: #9ca3af; font-weight: 600; transition: 0.2s; font-size: 0.875rem; }
        .nav-link:hover, .nav-link.active { color: #0ea5e9; }
        .prob-card { background: #111827; border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .prob-card:hover { transform: translateY(-5px); border-color: #0ea5e9; box-shadow: 0 10px 30px -10px rgba(14, 165, 233, 0.3); }
        .glass-table { width: 100%; border-collapse: separate; border-spacing: 0 8px; }
        .glass-table tr { background: rgba(255,255,255,0.03); transition: 0.2s; }
        .glass-table tr:hover { background: rgba(255,255,255,0.05); }
        .glass-table td, .glass-table th { padding: 16px 24px; }
        .glass-table td:first-child { border-radius: 16px 0 0 16px; }
        .glass-table td:last-child { border-radius: 0 16px 16px 0; }
        input, select, textarea { background: #0f172a !important; border: 1px solid rgba(255,255,255,0.1) !important; color: white !important; }
        input:focus { border-color: #0ea5e9 !important; outline: none; }
        select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 1rem center; background-size: 1.5em; }
    </style>
</head>
<body>
    <nav class="sticky top-0 z-50 glass-header h-16">
        <div class="max-w-7xl mx-auto px-6 h-full flex justify-between items-center">
            <div class="flex items-center gap-3 cursor-pointer" onclick="location.href='/'">
                <div class="bg-sky-500 p-2 rounded-lg shadow-[0_0_15px_rgba(14,165,233,0.4)]"><i data-lucide="armchair" class="text-white w-5 h-5"></i></div>
                <span class="text-xl font-bold tracking-tight uppercase">INFOD<span class="text-sky-400">INFOTOLIU</span></span>
            </div>
            <div class="hidden md:flex items-center gap-8">
                <a href="/probleme" class="nav-link ${activeNav === 'probleme' ? 'active' : ''}">Probleme</a>
                <a href="/submisii" class="nav-link ${activeNav === 'submisii' ? 'active' : ''}">Submisii</a>
                <a href="/clase" class="nav-link ${activeNav === 'clase' ? 'active' : ''}">Clase</a>
                <a href="/clasament" class="nav-link ${activeNav === 'top' ? 'active' : ''}">Top</a>
                <a href="/login.html" class="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold uppercase hover:bg-white/10 transition-all">Contul meu</a>
            </div>
        </div>
    </nav>
    <main class="max-w-7xl mx-auto px-6 py-12">${content}</main>
    <script>lucide.createIcons();</script>
</body>
</html>`;

// --- 4. RUTE ---

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'indexrizz.html')));

app.get('/clasament', async (req, res) => {
    const users = await User.find().sort({ score: -1 }).limit(50);
    let rows = users.map((u, i) => `
        <tr>
            <td class="font-bold text-slate-500">#${i + 1}</td>
            <td>
                <div class="flex items-center gap-3">
                    <img src="${u.avatar}" class="w-8 h-8 rounded-full border border-white/10">
                    <span class="font-bold text-white">${u.username}</span>
                </div>
            </td>
            <td class="text-sky-400 font-black text-right">${u.score}p</td>
        </tr>
    `).join('');

    const content = `
        <div class="mb-12 text-center">
            <h1 class="text-4xl font-black text-white tracking-tight mb-2">🏆 Clasament Elevi</h1>
            <p class="text-slate-500 font-medium">Cei mai buni programatori de pe platformă.</p>
        </div>
        <div class="max-w-3xl mx-auto bg-slate-900/40 border border-white/5 rounded-3xl p-4">
            <table class="glass-table">
                <thead>
                    <tr class="text-slate-500 text-xs uppercase tracking-widest">
                        <th class="text-left">Loc</th>
                        <th class="text-left">Utilizator</th>
                        <th class="text-right">Scor Total</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
    res.send(renderPage("Top", content, 'top'));
});

app.get('/probleme', async (req, res) => {
    const lista = await Problema.find().sort({ nr: 1 });
    const categorii = [...new Set(lista.map(p => p.categorie))];
    
    let content = `
        <div class="mb-12">
            <h1 class="text-4xl font-black text-white tracking-tight mb-2">📚 Arhivă Probleme</h1>
            <p class="text-slate-500 font-medium">Filtrează după nume sau categorie.</p>
        </div>

        <div class="flex flex-col md:flex-row gap-4 mb-10">
            <div class="relative flex-grow">
                <i data-lucide="search" class="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500"></i>
                <input id="s" onkeyup="filter()" placeholder="Caută problemă..." class="w-full pl-14 pr-6 py-4 rounded-2xl outline-none transition-all shadow-lg shadow-black/10 border-white/5">
            </div>
            <div class="relative md:w-72">
                <select id="c" onchange="filter()" class="w-full px-6 py-4 rounded-2xl outline-none cursor-pointer shadow-lg shadow-black/10 border-white/5">
                    <option value="">Toate Categoriile</option>
                    ${categorii.map(ct => `<option value="${ct}">${ct}</option>`).join('')}
                </select>
            </div>
        </div>

        <div id="grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${lista.map(p => `
                <div class="prob-card p-8 flex flex-col justify-between" data-t="${p.titlu}" data-c="${p.categorie}">
                    <div>
                        <div class="flex justify-between items-center mb-4">
                            <span class="px-3 py-1 bg-sky-500/10 text-sky-400 text-[10px] font-bold uppercase tracking-widest rounded-full border border-sky-500/20">${p.categorie}</span>
                            <span class="text-slate-600 font-bold text-xs uppercase tracking-tighter">#${p.nr}</span>
                        </div>
                        <h3 class="text-2xl font-bold text-white mb-6 leading-tight">${p.titlu}</h3>
                    </div>
                    <a href="/problema/${p._id}" class="group flex items-center justify-center gap-2 w-full py-4 bg-slate-800/50 hover:bg-sky-600 text-white rounded-2xl font-bold text-xs uppercase transition-all tracking-widest">
                        Rezolvă <i data-lucide="chevron-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
                    </a>
                </div>
            `).join('')}
        </div>

        <script>
            function filter() {
                const search = document.getElementById('s').value.toLowerCase();
                const category = document.getElementById('c').value.toLowerCase();
                const cards = document.querySelectorAll('.prob-card');
                
                cards.forEach(card => {
                    const title = card.getAttribute('data-t').toLowerCase();
                    const cat = card.getAttribute('data-c').toLowerCase();
                    const matchesSearch = title.includes(search);
                    const matchesCategory = category === "" || cat === category;
                    card.style.display = (matchesSearch && matchesCategory) ? "flex" : "none";
                });
            }
        </script>
    `;
    res.send(renderPage("Arhiva", content, 'probleme'));
});

app.get('/submisii', async (req, res) => {
    const subs = await Submission.find().sort({ data: -1 }).limit(30);
    let rows = subs.map(s => `
        <tr>
            <td>
                <a href="/submission/${s._id}" class="text-sky-400 font-mono text-xs hover:underline uppercase">
                    #${s._id.toString().slice(-5)}
                </a>
            </td>
            <td class="font-bold text-white">${s.username}</td>
            <td class="text-slate-400">${s.problemaTitlu}</td>
            <td>
                <span class="px-3 py-1 rounded-lg text-xs font-black ${s.scor === 100 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}">
                    ${s.scor}p
                </span>
            </td>
            <td class="text-[10px] font-mono text-slate-500">${s.timp}ms / ${s.memorie}KB</td>
        </tr>
    `).join('');

    const content = `
        <div class="mb-12">
            <h1 class="text-4xl font-black text-white tracking-tight mb-2">⚡ Submisii Recente</h1>
            <p class="text-slate-500 font-medium">Ultimele soluții trimise spre evaluare.</p>
        </div>
        <div class="bg-slate-900/40 border border-white/5 rounded-3xl p-6 overflow-x-auto">
            <table class="glass-table min-w-[700px]">
                <thead>
                    <tr class="text-slate-500 text-xs uppercase tracking-widest text-left">
                        <th>ID</th>
                        <th>Utilizator</th>
                        <th>Problemă</th>
                        <th>Scor</th>
                        <th>Resurse</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
    res.send(renderPage("Submisii", content, 'submisii'));
});

app.get('/problema/:id', async (req, res) => {
    try {
        const p = await Problema.findById(req.params.id);
        if (!p) return res.redirect('/probleme');
        res.send(renderPage(p.titlu, `
            <div class="max-w-4xl mx-auto">
                <div class="flex items-center gap-4 mb-6">
                    <a href="/probleme" class="p-2 bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors"><i data-lucide="arrow-left" class="w-5 h-5"></i></a>
                    <span class="text-sky-500 font-bold uppercase text-xs tracking-widest">${p.categorie}</span>
                </div>
                <h1 class="text-5xl font-black text-white mb-10 tracking-tighter">${p.titlu}</h1>
                <div class="bg-slate-900/30 border border-white/5 p-10 rounded-[2.5rem] text-slate-300 leading-relaxed text-lg mb-10 shadow-inner">${p.cerinta}</div>
                <div class="bg-slate-900/80 border border-white/10 p-8 rounded-3xl">
                    <h3 class="font-bold text-white mb-6 flex items-center gap-3"><i data-lucide="code-2" class="text-sky-400"></i> Editor Soluție (C++)</h3>
                    <textarea class="w-full h-80 font-mono text-sm p-6 rounded-2xl mb-6 bg-black/50 border border-white/5 resize-none focus:border-sky-500/50 outline-none" placeholder="int main() { ... }"></textarea>
                    <button class="w-full py-5 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all">Trimite Soluția</button>
                </div>
            </div>
        `));
    } catch(e) { res.redirect('/probleme'); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server pe port ${PORT}`));
