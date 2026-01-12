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
    secret: 'infodinfotoliu-session-secure-key', 
    resave: false, 
    saveUninitialized: true 
}));

app.use(async (req, res, next) => {
    if (req.session.user) { 
        await User.updateOne({ username: req.session.user }, { lastActive: new Date() }); 
    }
    next();
});

// --- HELPER DESIGN (Profesional) ---
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
        .glass-header { background: rgba(3, 7, 18, 0.9); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.08); }
        .nav-link { color: #9ca3af; font-weight: 600; transition: 0.2s; font-size: 0.875rem; }
        .nav-link:hover, .nav-link.active { color: #0ea5e9; }
        .prob-card { background: #111827; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; transition: 0.2s; }
        .prob-card:hover { border-color: #0ea5e9; background: #1a202c; }
        .glass-table { width: 100%; border-collapse: separate; border-spacing: 0 4px; }
        .glass-table tr { background: rgba(255,255,255,0.02); }
        .glass-table td, .glass-table th { padding: 14px 20px; }
        input, select, textarea { background: #0f172a !important; border: 1px solid rgba(255,255,255,0.1) !important; color: white !important; }
    </style>
</head>
<body>
    <nav class="sticky top-0 z-50 glass-header h-16">
        <div class="max-w-7xl mx-auto px-6 h-full flex justify-between items-center">
            <div class="flex items-center gap-3 cursor-pointer" onclick="location.href='/'">
                <div class="bg-sky-600 p-2 rounded-lg shadow-lg"><i data-lucide="armchair" class="text-white w-5 h-5"></i></div>
                <span class="text-xl font-bold tracking-tight uppercase">INFOD<span class="text-sky-400">INFOTOLIU</span></span>
            </div>
            <div class="hidden md:flex items-center gap-8">
                <a href="/probleme" class="nav-link ${activeNav === 'probleme' ? 'active' : ''}">Probleme</a>
                <a href="/submisii" class="nav-link ${activeNav === 'submisii' ? 'active' : ''}">Submisii</a>
                <a href="/clase" class="nav-link ${activeNav === 'clase' ? 'active' : ''}">Clase</a>
                <a href="/clasament" class="nav-link ${activeNav === 'top' ? 'active' : ''}">Top</a>
                <a href="/login.html" class="px-5 py-2 bg-sky-600 rounded-lg text-xs font-bold uppercase hover:bg-sky-500 transition-all">Contul meu</a>
            </div>
        </div>
    </nav>
    <main class="max-w-7xl mx-auto px-6 py-12">${content}</main>
    <script>lucide.createIcons();</script>
</body>
</html>`;

// --- 4. RUTE ---

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

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
            <p class="text-slate-500 font-medium">Performanțele programatorilor de pe platformă.</p>
        </div>
        <div class="max-w-3xl mx-auto bg-slate-900/40 border border-white/5 rounded-2xl p-4">
            <table class="glass-table">
                <thead>
                    <tr class="text-slate-500 text-xs uppercase tracking-widest text-left">
                        <th>Loc</th>
                        <th>Utilizator</th>
                        <th class="text-right">Scor</th>
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
            <p class="text-slate-500 font-medium">Selectează o problemă pentru rezolvare.</p>
        </div>

        <div class="flex flex-col md:flex-row gap-4 mb-10">
            <div class="relative flex-grow">
                <i data-lucide="search" class="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500"></i>
                <input id="s" onkeyup="filter()" placeholder="Caută problemă..." class="w-full pl-14 pr-6 py-4 rounded-xl outline-none border-white/5">
            </div>
            <div class="relative md:w-72">
                <select id="c" onchange="filter()" class="w-full px-6 py-4 rounded-xl outline-none border-white/5">
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
                            <span class="px-3 py-1 bg-sky-500/10 text-sky-400 text-[10px] font-bold uppercase rounded-md border border-sky-500/20">${p.categorie}</span>
                            <span class="text-slate-600 font-bold text-xs">#${p.nr}</span>
                        </div>
                        <h3 class="text-xl font-bold text-white mb-6">${p.titlu}</h3>
                    </div>
                    <a href="/problema/${p._id}" class="flex items-center justify-center gap-2 w-full py-3 bg-slate-800 hover:bg-sky-600 text-white rounded-xl font-bold text-xs uppercase transition-all">
                        Rezolvă Problema
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
                    card.style.display = (title.includes(search) && (category === "" || cat === category)) ? "flex" : "none";
                });
            }
        </script>
    `;
    res.send(renderPage("Arhivă", content, 'probleme'));
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
                <span class="px-3 py-1 rounded-md text-xs font-black ${s.scor === 100 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}">
                    ${s.scor}p
                </span>
            </td>
            <td class="text-[10px] font-mono text-slate-500">${s.timp}ms | ${s.memorie}KB</td>
        </tr>
    `).join('');

    const content = `
        <div class="mb-12">
            <h1 class="text-4xl font-black text-white tracking-tight mb-2">⚡ Submisii Recente</h1>
            <p class="text-slate-500 font-medium">Ultimele soluții trimise spre evaluare.</p>
        </div>
        <div class="bg-slate-900/40 border border-white/5 rounded-2xl p-4 overflow-x-auto">
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
                    <a href="/probleme" class="p-2 bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"><i data-lucide="arrow-left" class="w-5 h-5"></i></a>
                    <span class="text-sky-500 font-bold uppercase text-xs tracking-widest">${p.categorie}</span>
                </div>
                <h1 class="text-4xl font-black text-white mb-8 tracking-tight">${p.titlu}</h1>
                <div class="bg-slate-900/50 border border-white/5 p-8 rounded-2xl text-slate-300 leading-relaxed text-md mb-8">
                    ${p.cerinta}
                </div>
                <div class="bg-slate-900 border border-white/10 p-6 rounded-2xl">
                    <h3 class="font-bold text-white mb-4 flex items-center gap-3"><i data-lucide="code-2" class="text-sky-400"></i> Editor Soluție (C++)</h3>
                    <textarea class="w-full h-64 font-mono text-sm p-5 rounded-xl mb-4 bg-black/40 border border-white/10 resize-none focus:border-sky-500 outline-none" placeholder="int main() { ... }"></textarea>
                    <button class="w-full py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold uppercase text-xs transition-all">Trimite Soluția</button>
                </div>
            </div>
        `));
    } catch(e) { res.redirect('/probleme'); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server INFODINFOTOLIU pe port ${PORT}`));
