const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

const PORT = process.env.PORT || 10000;
const ADMIN_PASSWORD = "P)a1s2s2"; 

// 1. Conectare Baza de Date
const MONGO_URI = "mongodb+srv://gheorghitadavid_db_user:PAROLA_TA_AICI@cluster0.dun9hav.mongodb.net/?appName=Cluster0";
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

// 3. Configurari Server
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ 
    secret: 'cheie-sesiune-fotoliu-premium', 
    resave: false, 
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Helper Design
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
        .card-custom { background: #0f172a; border: 1px solid #1e293b; transition: all 0.3s ease; }
        .card-custom:hover { border-color: #38bdf8; }
        input, select, textarea { background: #020617 !important; border: 1px solid #1e293b !important; color: #f8fafc !important; }
    </style>
</head>
<body>
    <nav class="sticky top-0 z-50 glass-header h-16">
        <div class="max-w-7xl mx-auto px-6 h-full flex justify-between items-center">
            <div class="flex items-center gap-3 cursor-pointer" onclick="location.href='/'">
                <div class="accent-bg p-2 rounded-lg"><i data-lucide="code" class="text-white w-5 h-5"></i></div>
                <span class="text-xl font-bold tracking-tight">INFO<span class="text-sky-400">FOTOLIU</span></span>
            </div>
            <div class="flex items-center gap-6">
                <a href="/probleme" class="text-sm font-semibold ${activeNav === 'arhiva' ? 'text-sky-400' : 'text-slate-400 hover:text-white'}">Arhiva</a>
                <a href="/clase" class="text-sm font-semibold ${activeNav === 'clase' ? 'text-sky-400' : 'text-slate-400 hover:text-white'}">Clase</a>
                <a href="/clasament" class="text-sm font-semibold ${activeNav === 'top' ? 'text-sky-400' : 'text-slate-400 hover:text-white'}">Top</a>
            </div>
        </div>
    </nav>
    <main class="max-w-7xl mx-auto px-6 py-12 w-full">${content}</main>
    <script>lucide.createIcons();</script>
</body>
</html>`;

// --- RUTE ADMIN (SECRET) ---

app.get('/secret-admin', (req, res) => {
    res.send(renderPage("Admin", `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div class="card-custom rounded-3xl p-8">
                <h2 class="text-xl font-bold mb-6 flex items-center gap-2 text-sky-400"><i data-lucide="plus-circle"></i> Adauga Problema</h2>
                <form action="/admin/add" method="POST" class="space-y-4">
                    <input type="text" name="titlu" placeholder="Titlu Problema" class="w-full p-3 rounded-xl" required>
                    <select name="capitol" class="w-full p-3 rounded-xl">
                        <option>Operatori</option><option>Structuri</option><option>Vectori</option><option>Matrice</option><option>Diverse</option>
                    </select>
                    <textarea name="cerinta" placeholder="Cerinta HTML" class="w-full p-3 rounded-xl h-32" required></textarea>
                    <input type="password" name="pass" placeholder="Parola Admin" class="w-full p-3 rounded-xl" required>
                    <button class="w-full accent-bg py-3 rounded-xl font-bold uppercase text-xs tracking-widest">Adauga</button>
                </form>
            </div>

            <div class="space-y-6">
                <div class="card-custom rounded-3xl p-8 border-orange-900/30">
                    <h2 class="text-xl font-bold mb-6 flex items-center gap-2 text-orange-400"><i data-lucide="minus-circle"></i> Sterge o Problema</h2>
                    <form action="/admin/delete-one" method="POST" class="space-y-4">
                        <input type="text" name="titlu_exact" placeholder="Titlu exact al problemei" class="w-full p-3 rounded-xl" required>
                        <input type="password" name="pass" placeholder="Parola Admin" class="w-full p-3 rounded-xl" required>
                        <button class="w-full border border-orange-500 text-orange-500 py-3 rounded-xl font-bold uppercase text-xs hover:bg-orange-500 hover:text-white transition-all">Sterge Problema</button>
                    </form>
                </div>

                <div class="card-custom rounded-3xl p-8 border-red-900/30">
                    <h2 class="text-xl font-bold mb-6 flex items-center gap-2 text-red-500"><i data-lucide="trash-2"></i> Resetare Totala</h2>
                    <form action="/admin/reset" method="POST">
                        <input type="password" name="pass" placeholder="Parola Admin" class="w-full p-3 rounded-xl mb-4" required>
                        <button class="w-full bg-red-600 py-3 rounded-xl font-bold uppercase text-xs">Sterge Toata Arhiva</button>
                    </form>
                </div>
            </div>
        </div>
    `, 'admin'));
});

app.post('/admin/add', async (req, res) => {
    if (req.body.pass !== ADMIN_PASSWORD) return res.send("Parola incorecta.");
    await new Problema({ titlu: req.body.titlu, cerinta: req.body.cerinta, capitol: req.body.capitol }).save();
    res.redirect('/secret-admin');
});

app.post('/admin/delete-one', async (req, res) => {
    if (req.body.pass !== ADMIN_PASSWORD) return res.send("Parola incorecta.");
    await Problema.findOneAndDelete({ titlu: req.body.titlu_exact });
    res.send("<script>alert('Daca titlul a fost corect, problema a fost stearsa.'); window.location='/secret-admin';</script>");
});

app.post('/admin/reset', async (req, res) => {
    if (req.body.pass !== ADMIN_PASSWORD) return res.send("Parola incorecta.");
    await Problema.deleteMany({});
    res.redirect('/secret-admin');
});

// --- RUTE PUBLICE ---

app.get('/probleme', async (req, res) => {
    const q = req.query.search || "";
    const filter = q ? { titlu: { $regex: q, $options: 'i' } } : {};
    const list = await Problema.find(filter).sort({ capitol: 1 }).lean();

    let content = `
        <div class="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
            <h1 class="text-3xl font-black">Arhiva de Probleme</h1>
            <form action="/probleme" method="GET" class="relative w-full md:w-80">
                <input type="text" name="search" value="${q}" placeholder="Cauta o problema..." class="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-800 bg-slate-900/50">
                <i data-lucide="search" class="absolute left-3 top-2.5 w-4 h-4 text-slate-500"></i>
            </form>
        </div>
    `;

    if (list.length === 0) content += `<p class="text-slate-500 text-center py-20 font-bold uppercase">Nicio problema gasita</p>`;
    else {
        content += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">`;
        list.forEach(p => {
            content += `
                <div class="card-custom rounded-2xl p-6 flex flex-col justify-between">
                    <div>
                        <span class="text-[10px] text-sky-500 font-bold uppercase">${p.capitol}</span>
                        <h3 class="text-lg font-bold mt-1">${p.titlu}</h3>
                    </div>
                    <a href="/problema/${p._id}" class="mt-6 text-center py-3 bg-slate-900 rounded-xl text-xs font-bold uppercase hover:bg-sky-600 transition-all">Deschide</a>
                </div>
            `;
        });
        content += `</div>`;
    }
    res.send(renderPage("Arhiva", content));
});

app.get('/problema/:id', async (req, res) => {
    try {cum intru pe admin
    
        const p = await Problema.findById(req.params.id);
        res.send(renderPage(p.titlu, `
            <div class="max-w-4xl mx-auto">
                <h1 class="text-4xl font-black mb-2">${p.titlu}</h1>
                <p class="text-sky-500 font-bold uppercase text-xs mb-8">${p.capitol}</p>
                <div class="card-custom rounded-3xl p-10 text-slate-300 leading-relaxed">${p.cerinta}</div>
            </div>
        `));
    } catch(e) { res.redirect('/probleme'); }
});

// Rute placeholder pentru a nu mai da eroare 404
app.get('/clase', (req, res) => res.send(renderPage("Clase", "<h1 class='text-center text-slate-500 mt-20 font-bold uppercase tracking-widest'>Sectiune in lucru</h1>", "clase")));
app.get('/clasament', (req, res) => res.send(renderPage("Clasament", "<h1 class='text-center text-slate-500 mt-20 font-bold uppercase tracking-widest'>Clasament momentan indisponibil</h1>", "top")));

app.get('/', (req, res) => res.redirect('/probleme'));
app.listen(PORT, () => console.log(`Server pe port ${PORT}`));
