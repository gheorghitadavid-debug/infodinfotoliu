const express = require('express');
const axios = require('axios');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

const PORT = process.env.PORT || 10000;

// --- CONECTARE MONGODB (Pune parola ta!) ---
const MONGO_URI = "mongodb+srv://gheorghitadavid_db_user:P)a1s2s2@cluster0.dun9hav.mongodb.net/?appName=Cluster0";
mongoose.connect(MONGO_URI).then(() => console.log("✅ DB Connected")).catch(err => console.error(err));

// --- MODELE DATE ---
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true },
    password: { type: String },
    score: { type: Number, default: 0 },
    friends: [String],
    claseInrolate: [String],
    lastActive: { type: Date, default: Date.now }
}));

const Capitol = mongoose.model('Capitol', new mongoose.Schema({ nume: { type: String, unique: true } }));

const Problema = mongoose.model('Problema', new mongoose.Schema({
    nr: Number, titlu: String, categorie: String, cerinta: String, teste: Array
}));

const Submission = mongoose.model('Submission', new mongoose.Schema({
    username: String, problemaTitlu: String, scor: Number, timp: String, codSursa: String, data: { type: Date, default: Date.now }
}));

const Clasa = mongoose.model('Clasa', new mongoose.Schema({
    nume: String, cod: { type: String, unique: true }, parolaClasa: String, creator: String,
    teme: [{ titlu: String, problemaId: String }]
}));

// --- MIDDLEWARE ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'rizz-ultra-key', resave: false, saveUninitialized: true }));

// Funcție pentru Design Unificat
const layout = (title, content) => `
<html>
<head>
    <title>${title} | RIZZ</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        :root { --primary: #38bdf8; --bg: #0f172a; --card: #1e293b; --text: #f1f5f9; }
        body { background: var(--bg); color: var(--text); font-family: sans-serif; margin: 0; }
        header { background: #0b1120; padding: 20px; display: flex; justify-content: center; gap: 20px; border-bottom: 1px solid #334155; }
        header a { color: white; text-decoration: none; font-weight: bold; font-size: 0.9rem; }
        header a:hover { color: var(--primary); }
        .container { max-width: 800px; margin: 40px auto; padding: 20px; }
        .card { background: var(--card); padding: 20px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 20px; }
        .btn { background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; text-decoration: none; display: inline-block; font-weight: bold; }
        input { width: 100%; padding: 10px; margin: 10px 0; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; border-bottom: 1px solid #334155; text-align: left; }
    </style>
</head>
<body>
    <header>
        <a href="/probleme">PROBLEME</a>
        <a href="/submisii">SUBMISII</a>
        <a href="/clase">CLASE</a>
        <a href="/prieteni">PRIETENI</a>
        <a href="/clasament">TOP</a>
        <a href="/profil">PROFIL</a>
        <a href="/">ACASĂ</a>
    </header>
    <div class="container">${content}</div>
</body>
</html>`;

// --- RUTE PROFIL & LOGIN ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'indexrizz.html')));

app.get('/profil', async (req, res) => {
    if (!req.session.user) return res.send(layout("Profil", "<h2>Trebuie să fii logat.</h2><a href='/login.html' class='btn'>Login</a>"));
    const u = await User.findOne({ username: req.session.user });
    const submisiiCount = await Submission.countDocuments({ username: u.username });
    res.send(layout("Profil", `
        <div class="card">
            <h1>👤 Profil: ${u.username}</h1>
            <p>Scor Total: <b style="color:var(--primary)">${u.score} puncte</b></p>
            <p>Submisii trimise: <b>${submisiiCount}</b></p>
            <a href="/logout" class="btn" style="background:#f87171">Deconectare</a>
        </div>
    `));
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- RUTE CLASE & TEME ---
app.get('/clase', async (req, res) => {
    if (!req.session.user) return res.redirect('/login.html');
    const u = await User.findOne({ username: req.session.user });
    const claseElev = await Clasa.find({ cod: { $in: u.claseInrolate } });
    const claseProfesor = await Clasa.find({ creator: req.session.user });

    res.send(layout("Clase", `
        <div class="card">
            <h2>🏫 Înscrie-te într-o clasă</h2>
            <form action="/clasa/join" method="POST">
                <input name="cod" placeholder="Codul clasei (ex: MATH123)">
                <button class="btn">Înscrie-te</button>
            </form>
        </div>
        <div class="card">
            <h2>📚 Clasele mele (Elev)</h2>
            ${claseElev.map(c => `<p><b>${c.nume}</b> - <a href="/clasa/${c.cod}">Vezi Teme</a></p>`).join('') || "Nu ești în nicio clasă."}
        </div>
        <div class="card" style="border-color: #fbbf24;">
            <h2>👨‍🏫 Panou Profesor</h2>
            <form action="/clasa/create" method="POST">
                <input name="nume" placeholder="Nume Clasă Nouă">
                <input name="cod" placeholder="Cod Unic">
                <button class="btn" style="background:#fbbf24; color:black;">Creează Clasă</button>
            </form>
            ${claseProfesor.map(c => `<p><b>${c.nume}</b> (Cod: ${c.cod})</p>`).join('')}
        </div>
    `));
});

app.post('/clasa/join', async (req, res) => {
    await User.updateOne({ username: req.session.user }, { $addToSet: { claseInrolate: req.body.cod } });
    res.redirect('/clase');
});

app.post('/clasa/create', async (req, res) => {
    await new Clasa({ nume: req.body.nume, cod: req.body.cod, creator: req.session.user }).save();
    res.redirect('/clase');
});

// --- RUTE PROBLEME & SUBMISII (SHARE ID FIXED) ---
app.get('/probleme', async (req, res) => {
    const lista = await Problema.find().sort({ nr: 1 });
    const caps = await Capitol.find();
    let content = caps.map(c => `
        <div class="card">
            <h3>📂 ${c.nume}</h3>
            ${lista.filter(p => p.categorie === c.nume).map(p => `
                <div style="display:flex; justify-content:space-between; margin:10px 0;">
                    <span>#${p.nr} ${p.titlu}</span>
                    <a href="/problema/${p._id}" class="btn" style="padding:5px 10px;">Rezolvă</a>
                </div>
            `).join('')}
        </div>
    `).join('');
    res.send(layout("Arhivă", content));
});

app.get('/submisii', async (req, res) => {
    const subs = await Submission.find().sort({ data: -1 }).limit(20);
    let rows = subs.map(s => `<tr><td><a href="/submission/${s._id}" style="color:var(--primary)">#${s._id.toString().slice(-6)}</a></td><td>${s.username}</td><td>${s.problemaTitlu}</td><td>${s.scor}p</td></tr>`).join('');
    res.send(layout("Submisii", `<table><thead><tr><th>ID Share</th><th>User</th><th>Problemă</th><th>Scor</th></tr></thead><tbody>${rows}</tbody></table>`));
});

app.get('/submission/:id', async (req, res) => {
    const s = await Submission.findById(req.params.id);
    res.send(layout("Cod", `
        <div class="card">
            <h3>Soluția lui ${s.username} <button class="btn" onclick="navigator.clipboard.writeText(window.location.href); alert('Link copiat!')">Share</button></h3>
            <pre style="background:#0f172a; padding:15px; border-radius:5px; color:#4ade80; border:1px solid #334155;">${s.codSursa}</pre>
        </div>
    `));
});

// Adaugă aici restul rutelor de Admin și Clasament din codurile anterioare...

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 RIZZ Online pe port ${PORT}`));
