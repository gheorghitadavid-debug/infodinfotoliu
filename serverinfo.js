const express = require('express');
const axios = require('axios');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

const PORT = process.env.PORT || 10000;

// Parola de administrator stabilita anterior
const ADMIN_PASSWORD = "P)a1s2s2"; 

// 1. Conectare Baza de Date
const MONGO_URI = "mongodb+srv://gheorghitadavid_db_user:P)a1s2s2@cluster0.dun9hav.mongodb.net/?appName=Cluster0";
mongoose.connect(MONGO_URI)
    .then(() => console.log("Conexiune reusita la baza de date"))
    .catch(err => console.error("Eroare DB:", err));

// 2. Scheme de Date
const ProblemaSchema = new mongoose.Schema({
    nr: Number,
    titlu: String,
    cerinta: String,
    capitol: { type: String, default: "Diverse" },
    dificultate: { type: String, default: "Mediu" }
});
const Problema = mongoose.model('Problema', ProblemaSchema);

const SubmissionSchema = new mongoose.Schema({
    username: String,
    problemaTitlu: String,
    scor: Number,
    data: { type: Date, default: Date.now }
});
const Submission = mongoose.model('Submission', SubmissionSchema);

// 3. Configurari Server
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ 
    secret: 'cheie-sesiune-fotoliu-premium', 
    resave: false, 
    saveUninitialized: false 
}));

// Helper Design - Interfata de ultima generatie fara emoji
const renderPage = (title, content, activeNav = 'arhiva') => `
<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | Info Fotoliu</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #020617; color: #f8fafc; margin: 0; }
        .glass-header { background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
        .accent-bg { background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); }
        .card-custom { background: #0f172a; border: 1px solid #1e293b; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .card-custom:hover { border-color: #38bdf8; transform: translateY(-3px); box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5); }
        input, select, textarea { background: #020617 !important; border: 1px solid #1e293b !important; color: #f8fafc !important; }
        input:focus, select:focus, textarea:focus { border-color: #38bdf8 !important; outline: none; ring: 2px rgba(56, 189, 248, 0.2); }
        .sidebar-link { transition: all 0.2s ease; }
        .sidebar-link.active { color: #38bdf8; background: rgba(56, 189, 248, 0.05); }
    </style>
</head>
<body class="selection:bg-sky-500/30">
    <div class="min-h-screen flex flex-col">
        <nav class="sticky top-0 z-50 glass-header h-16">
            <div class="max-w-7xl mx-auto px-6 h-full flex justify-between items-center">
                <div class="flex items-center gap-3 cursor-pointer" onclick="location.href='/'">
                    <div class="accent-bg p-2 rounded-lg">
                        <i data-lucide="code" class="text-white w-5 h-5"></i>
                    </div>
                    <span class="text-xl font-bold tracking-tight">INFO<span class="text-sky-400">FOTOLIU</span></span>
                </div>
                <div class="flex items-center gap-8">
                    <a href="/probleme" class="sidebar-link px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${activeNav === 'arhiva' ? 'active' : 'text-slate-400 hover:text-white'}">
                        <i data-lucide="box" class="w-4 h-4"></i> Arhiva
                    </a>
                    <a href="/secret-admin" class="sidebar-link px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${activeNav === 'admin' ? 'active' : 'text-slate-400 hover:text-white'}">
                        <i data-lucide="shield" class="w-4 h-4"></i> Admin
                    </a>
                </div>
            </div>
        </nav>

        <main class="flex-grow max-w-7xl mx-auto px-6 py-12 w-full">
            ${content}
        </main>

        <footer class="py-8 border-t border-slate-900 text-center">
            <p class="text-slate-600 text-[10px] font-bold uppercase tracking-[0.3em]">Platforma Educationala de Informatica v3.0</p>
        </footer>
    </div>
    <script>lucide.createIcons();</script>
</body>
</html>`;

// 4. Rute Admin

app.get('/secret-admin', (req, res) => {
    res.send(renderPage("Panou Admin", `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div class="lg:col-span-2">
                <div class="card-custom rounded-3xl p-8 lg:p-10">
                    <h2 class="text-2xl font-bold mb-8 flex items-center gap-3">
                        <i data-lucide="file-plus" class="text-sky-400"></i> Adaugare Problema Noua
                    </h2>
                    
                    <form action="/admin/add" method="POST" class="space-y-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="space-y-2">
                                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">ID Problema</label>
                                <input type="number" name="nr" placeholder="Ex: 100" class="w-full px-4 py-3 rounded-xl outline-none" required>
                            </div>
                            <div class="space-y-2">
                                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Titlu Problema</label>
                                <input type="text" name="titlu" placeholder="Ex: Algoritmul lui Euclid" class="w-full px-4 py-3 rounded-xl outline-none" required>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="space-y-2">
                                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Selecteaza Capitol</label>
                                <select name="capitol_select" class="w-full px-4 py-3 rounded-xl outline-none cursor-pointer">
                                    <option value="Diverse">Alege capitol...</option>
                                    <option value="Operatori si expresii">Operatori si expresii</option>
                                    <option value="Structuri de decizie">Structuri de decizie</option>
                                    <option value="Structuri repetitive">Structuri repetitive</option>
                                    <option value="Vectori">Tablouri unidimensionale</option>
                                    <option value="Matrice">Tablouri bidimensionale</option>
                                    <option value="Siruri de caractere">Siruri de caractere</option>
                                </select>
                            </div>
                            <div class="space-y-2">
                                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Sau Capitol Nou</label>
                                <input type="text" name="capitol_nou" placeholder="Nume capitol nou..." class="w-full px-4 py-3 rounded-xl outline-none">
                            </div>
                        </div>

                        <div class="space-y-2">
                            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Dificultate</label>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                                ${['Usor', 'Mediu', 'Greu', 'Concurs'].map(d => `
                                    <label class="flex items-center gap-2 p-3 rounded-xl border border-slate-800 bg-slate-900/50 cursor-pointer hover:border-sky-500/50">
                                        <input type="radio" name="dificultate" value="${d}" ${d === 'Mediu' ? 'checked' : ''} class="w-4 h-4 text-sky-500">
                                        <span class="text-sm font-medium text-slate-300">${d}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>

                        <div class="space-y-2">
                            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Cerinta (HTML acceptat)</label>
                            <textarea name="cerinta" rows="8" placeholder="Formatati cerinta folosind tag-uri HTML daca este nevoie..." class="w-full px-4 py-3 rounded-xl outline-none font-mono text-sm" required></textarea>
                        </div>

                        <div class="p-6 bg-sky-500/5 border border-sky-500/10 rounded-2xl">
                            <label class="block text-xs font-bold text-sky-400 uppercase tracking-wider mb-2">Parola Admin Obligatorie</label>
                            <input type="password" name="admin_pass" placeholder="Introdu parola P)a1s2s2" class="w-full px-4 py-3 rounded-xl outline-none" required>
                        </div>

                        <button type="submit" class="w-full accent-bg text-white font-bold py-4 rounded-xl shadow-lg hover:opacity-90 transition-all uppercase text-sm tracking-widest">
                            Salveaza si Publica
                        </button>
                    </form>
                </div>
            </div>

            <div class="space-y-10">
                <div class="card-custom rounded-3xl p-8 border-red-900/20 bg-red-950/5">
                    <h2 class="text-lg font-bold text-red-500 mb-4 flex items-center gap-2">
                        <i data-lucide="trash-2" class="w-5 h-5"></i> Zona de Resetare
                    </h2>
                    <p class="text-sm text-slate-400 mb-6">Actiunea de resetare va sterge toate problemele adaugate pana in prezent.</p>
                    <form action="/admin/reset" method="POST" onsubmit="return confirm('Confirmi stergerea tuturor datelor?')">
                        <input type="password" name="admin_pass" placeholder="Parola confirmare" class="w-full px-4 py-3 rounded-xl outline-none mb-4 text-sm" required>
                        <button type="submit" class="w-full border border-red-500/30 text-red-500 py-3 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-all text-xs uppercase tracking-tighter">
                            Sterge Intreaga Arhiva
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `, 'admin'));
});

// 5. Logica Backend Admin

app.post('/admin/add', async (req, res) => {
    const { nr, titlu, cerinta, capitol_select, capitol_nou, dificultate, admin_pass } = req.body;
    if (admin_pass !== ADMIN_PASSWORD) return res.send("<script>alert('Parola incorecta!'); window.history.back();</script>");

    const capitolFinal = (capitol_nou && capitol_nou.trim() !== "") ? capitol_nou.trim() : capitol_select;

    try {
        await new Problema({ nr, titlu, cerinta, capitol: capitolFinal, dificultate }).save();
        res.send("<script>alert('Problema a fost adaugata!'); window.location='/secret-admin';</script>");
    } catch (e) { res.send(e.message); }
});

app.post('/admin/reset', async (req, res) => {
    if (req.body.admin_pass !== ADMIN_PASSWORD) return res.send("Parola incorecta.");
    await Problema.deleteMany({});
    await Submission.deleteMany({});
    res.send("<script>alert('Baza de date a fost curatata.'); window.location='/secret-admin';</script>");
});

// 6. Rute Publice (Vizibile pentru elevi)

app.get('/probleme', async (req, res) => {
    const list = await Problema.find().sort({ capitol: 1, nr: 1 }).lean();
    const capitole = {};
    list.forEach(p => {
        if (!capitole[p.capitol]) capitole[p.capitol] = [];
        capitole[p.capitol].push(p);
    });

    let content = `
        <div class="mb-12">
            <h1 class="text-4xl font-black text-white tracking-tight">Arhiva de Probleme</h1>
            <p class="text-slate-400 mt-2 text-lg">Alege o tema si incepe sa exersezi algoritmii.</p>
        </div>
    `;

    if (Object.keys(capitole).length === 0) {
        content += `<div class="p-16 border-2 border-dashed border-slate-800 rounded-[2.5rem] text-center text-slate-600 font-bold uppercase tracking-widest italic">Nicio problema disponibila momentan</div>`;
    }

    for (const cap in capitole) {
        content += `
        <div class="mb-14">
            <div class="flex items-center gap-4 mb-8">
                <h2 class="text-[10px] font-black uppercase tracking-[0.4em] text-sky-500 whitespace-nowrap">${cap}</h2>
                <div class="h-px bg-slate-800 flex-grow"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                ${capitole[cap].map(p => {
                    const d = p.dificultate.toLowerCase();
                    const theme = d === 'usor' ? 'emerald' : d === 'mediu' ? 'amber' : d === 'greu' ? 'rose' : 'violet';
                    return `
                    <div class="card-custom rounded-3xl p-8 flex flex-col justify-between h-full">
                        <div>
                            <div class="flex justify-between items-start mb-6">
                                <span class="text-[10px] font-bold text-slate-600">ID #${p.nr}</span>
                                <span class="text-[9px] px-3 py-1 rounded-full border border-${theme}-500/30 bg-${theme}-500/10 text-${theme}-400 font-black uppercase tracking-widest">${p.dificultate}</span>
                            </div>
                            <h3 class="text-xl font-bold text-white leading-tight mb-4">${p.titlu}</h3>
                        </div>
                        <a href="/problema/${p._id}" class="mt-8 flex items-center justify-center gap-2 w-full py-4 bg-slate-900 hover:bg-sky-600 text-white rounded-2xl font-bold transition-all text-xs uppercase tracking-widest">
                            Deschide Problema <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                        </a>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }
    
    res.send(renderPage("Arhiva", content));
});

app.get('/problema/:id', async (req, res) => {
    try {
        const p = await Problema.findById(req.params.id).lean();
        res.send(renderPage(p.titlu, `
            <div class="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <div class="text-sky-400 text-[10px] font-black uppercase tracking-widest mb-2">${p.capitol} / #${p.nr}</div>
                    <h1 class="text-5xl font-black text-white tracking-tighter">${p.titlu}</h1>
                </div>
                <button onclick="window.print()" class="flex items-center gap-2 px-6 py-3 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-all font-bold text-xs uppercase tracking-widest">
                    <i data-lucide="printer" class="w-4 h-4"></i> Versiune Print
                </button>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div class="lg:col-span-2">
                    <div class="card-custom rounded-[2.5rem] p-10 lg:p-14 leading-relaxed text-slate-300 text-lg shadow-2xl">
                        <div class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-10 border-b border-slate-800 pb-6 flex items-center gap-3">
                            Enuntul Problemei
                        </div>
                        <div class="prose prose-invert max-w-none prose-p:mb-4">
                            ${p.cerinta}
                        </div>
                    </div>
                </div>

                <div class="space-y-10">
                    <div class="card-custom rounded-[2.5rem] p-10">
                        <div class="flex items-center gap-3 mb-8">
                            <i data-lucide="terminal" class="text-sky-400 w-5 h-5"></i>
                            <h3 class="text-xl font-bold text-white tracking-tight">Consola Solutie</h3>
                        </div>
                        <p class="text-xs text-slate-500 mb-6 italic leading-relaxed">Implementeaza rezolvarea in C++ mai jos.</p>
                        <textarea placeholder="#include <iostream>..." class="w-full bg-black border border-slate-800 rounded-2xl p-6 font-mono text-xs text-sky-300 mb-8" rows="16"></textarea>
                        <button class="w-full accent-bg text-white font-bold py-5 rounded-2xl shadow-xl hover:opacity-90 transition-all uppercase text-[10px] tracking-[0.2em]">
                            Evalueaza Codul
                        </button>
                    </div>
                </div>
            </div>
        `));
    } catch (e) {
        res.redirect('/probleme');
    }
});

app.get('/', (req, res) => res.redirect('/probleme'));

app.listen(PORT, () => console.log(`Server activ pe portul ${PORT}`));
