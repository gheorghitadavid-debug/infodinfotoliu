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
    teste: [{ input: String, output: String }] // Structură clară pentru teste
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
    secret: 'infodinfotoliu-main-secure-key', 
    resave: false, 
    saveUninitialized: true 
}));

// Auth Middleware pentru Admin
const isAdmin = (req, res, next) => {
    if (req.session.isAdmin) return next();
    res.status(401).send("Neautorizat. Te rugăm să te autentifici ca admin.");
};

// --- HELPER DESIGN ---
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
        input, select, textarea { background: #0f172a !important; border: 1px solid rgba(255,255,255,0.1) !important; color: white !important; padding: 10px; border-radius: 8px; }
    </style>
</head>
<body>
    <nav class="sticky top-0 z-50 glass-header h-16">
        <div class="max-w-7xl mx-auto px-6 h-full flex justify-between items-center">
            <div class="flex items-center gap-3 cursor-pointer" onclick="location.href='/'">
                <div class="bg-sky-600 p-2 rounded-lg"><i data-lucide="armchair" class="text-white w-5 h-5"></i></div>
                <span class="text-xl font-bold tracking-tight uppercase">INFOD<span class="text-sky-400">INFOTOLIU</span></span>
            </div>
            <div class="hidden md:flex items-center gap-8">
                <a href="/probleme" class="nav-link ${activeNav === 'probleme' ? 'active' : ''}">Probleme</a>
                <a href="/submisii" class="nav-link ${activeNav === 'submisii' ? 'active' : ''}">Submisii</a>
                <a href="/clase" class="nav-link ${activeNav === 'clase' ? 'active' : ''}">Clase</a>
                <a href="/clasament" class="nav-link ${activeNav === 'top' ? 'active' : ''}">Top</a>
                <a href="/admin" class="nav-link">Admin</a>
            </div>
        </div>
    </nav>
    <main class="max-w-7xl mx-auto px-6 py-12">${content}</main>
    <script>lucide.createIcons();</script>
</body>
</html>`;

// --- 4. RUTE ADMIN ---

// Login Admin
app.get('/admin', (req, res) => {
    if (req.session.isAdmin) return res.redirect('/admin/dashboard');
    res.send(renderPage("Admin Login", `
        <div class="max-w-md mx-auto bg-slate-900 p-8 rounded-2xl border border-white/10">
            <h2 class="text-2xl font-bold mb-6">Consolă Administrare</h2>
            <form action="/admin/login" method="POST" class="flex flex-col gap-4">
                <input type="password" name="password" placeholder="Parolă Administrator" required>
                <button class="bg-sky-600 py-3 rounded-lg font-bold hover:bg-sky-500">Autentificare</button>
            </form>
        </div>
    `));
});

app.post('/admin/login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.redirect('/admin/dashboard');
    } else {
        res.send("Parolă incorectă! <a href='/admin'>Încearcă din nou</a>");
    }
});

// Dashboard Admin
app.get('/admin/dashboard', isAdmin, async (req, res) => {
    const probleme = await Problema.find().sort({ nr: 1 });
    const content = `
        <div class="flex justify-between items-center mb-10">
            <h1 class="text-3xl font-bold text-white">Panou Control</h1>
            <a href="/admin/problema/noua" class="bg-emerald-600 px-6 py-2 rounded-lg font-bold hover:bg-emerald-500">+ Problemă Nouă</a>
        </div>
        
        <div class="bg-slate-900/40 border border-white/5 rounded-2xl p-6">
            <h2 class="text-xl font-bold mb-4">Gestionare Probleme existente</h2>
            <table class="glass-table">
                <thead>
                    <tr class="text-left text-slate-500 text-xs uppercase">
                        <th>Nr</th>
                        <th>Titlu</th>
                        <th>Categorie (Capitol)</th>
                        <th class="text-right">Acțiuni</th>
                    </tr>
                </thead>
                <tbody>
                    ${probleme.map(p => `
                        <tr>
                            <td>#${p.nr}</td>
                            <td class="font-bold">${p.titlu}</td>
                            <td><span class="bg-white/5 px-2 py-1 rounded text-xs">${p.categorie}</span></td>
                            <td class="text-right flex justify-end gap-2">
                                <a href="/admin/problema/sterge/${p._id}" class="text-rose-500 hover:underline" onclick="return confirm('Sigur ștergi problema?')">Șterge</a>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    res.send(renderPage("Dashboard Admin", content));
});

// Creare Problemă Nouă
app.get('/admin/problema/noua', isAdmin, (req, res) => {
    res.send(renderPage("Problemă Nouă", `
        <div class="max-w-3xl mx-auto bg-slate-900 p-8 rounded-2xl border border-white/10">
            <h2 class="text-2xl font-bold mb-6">Adaugă o problemă în programă</h2>
            <form action="/admin/problema/salveaza" method="POST" class="flex flex-col gap-5">
                <div class="grid grid-cols-2 gap-4">
                    <input type="number" name="nr" placeholder="Număr problemă (ex: 1)" required>
                    <input type="text" name="titlu" placeholder="Titlu Problemă" required>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <input type="text" name="categorie" placeholder="Capitol (ex: Vectori, Recursivitate)" required>
                    <select name="dificultate">
                        <option value="Ușor">Ușor</option>
                        <option value="Mediu" selected>Mediu</option>
                        <option value="Greu">Greu</option>
                    </select>
                </div>
                <textarea name="cerinta" rows="8" placeholder="Cerința problemei (poți folosi HTML pentru formatare)" required></textarea>
                
                <div class="p-4 bg-black/30 rounded-xl border border-white/5">
                    <h3 class="font-bold mb-2 text-sky-400">Test de Evaluare (Exemplu 1)</h3>
                    <div class="grid grid-cols-2 gap-4">
                        <textarea name="input1" placeholder="Intrare test"></textarea>
                        <textarea name="output1" placeholder="Ieșire așteptată"></textarea>
                    </div>
                </div>

                <button class="bg-sky-600 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-sky-500">Publică Problema</button>
            </form>
        </div>
    `));
});

// Salvare Problemă
app.post('/admin/problema/salveaza', isAdmin, async (req, res) => {
    const { nr, titlu, categorie, dificultate, cerinta, input1, output1 } = req.body;
    await Problema.create({
        nr, titlu, categorie, dificultate, cerinta,
        teste: [{ input: input1, output: output1 }]
    });
    res.redirect('/admin/dashboard');
});

// Ștergere Problemă
app.get('/admin/problema/sterge/:id', isAdmin, async (req, res) => {
    await Problema.findByIdAndDelete(req.params.id);
    res.redirect('/admin/dashboard');
});

// --- RUTE UTILIZATORI (Existente) ---

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.get('/probleme', async (req, res) => {
    const lista = await Problema.find().sort({ nr: 1 });
    const categorii = [...new Set(lista.map(p => p.categorie))];
    let content = `
        <div class="mb-12">
            <h1 class="text-4xl font-black text-white mb-2">📚 Arhivă Probleme</h1>
            <p class="text-slate-500">Explorează capitolele de informatică.</p>
        </div>
        <div id="grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${lista.map(p => `
                <div class="prob-card p-8 flex flex-col justify-between">
                    <div>
                        <span class="px-3 py-1 bg-sky-500/10 text-sky-400 text-[10px] font-bold uppercase rounded-md border border-sky-500/20">${p.categorie}</span>
                        <h3 class="text-xl font-bold text-white mt-4 mb-6">${p.titlu}</h3>
                    </div>
                    <a href="/problema/${p._id}" class="flex items-center justify-center py-3 bg-slate-800 hover:bg-sky-600 text-white rounded-xl font-bold text-xs uppercase transition-all">Rezolvă</a>
                </div>
            `).join('')}
        </div>
    `;
    res.send(renderPage("Probleme", content, 'probleme'));
});

app.get('/problema/:id', async (req, res) => {
    const p = await Problema.findById(req.params.id);
    if (!p) return res.redirect('/probleme');
    res.send(renderPage(p.titlu, `
        <div class="max-w-4xl mx-auto">
            <h1 class="text-4xl font-black mb-8">${p.titlu}</h1>
            <div class="bg-slate-900/50 border border-white/5 p-8 rounded-2xl text-slate-300 mb-8 leading-relaxed">
                ${p.cerinta}
            </div>
            <div class="bg-slate-900 p-6 rounded-2xl">
                <textarea class="w-full h-64 font-mono p-5 rounded-xl mb-4 bg-black/40 border border-white/10" placeholder="Codul tău C++..."></textarea>
                <button class="w-full py-4 bg-sky-600 hover:bg-sky-500 rounded-xl font-bold uppercase">Trimite Soluția</button>
            </div>
        </div>
    `));
});

// Păstrează celelalte rute (/submisii, /clasament) ca în versiunea anterioară

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server INFODINFOTOLIU pe port ${PORT}`));
