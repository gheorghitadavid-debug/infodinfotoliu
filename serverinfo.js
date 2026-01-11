const express = require('express');
const axios = require('axios');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

const PORT = process.env.PORT || 10000;

// --- CONECTARE MONGODB (Înlocuiește PAROLA_TA_AICI) ---
const MONGO_URI = "mongodb+srv://gheorghitadavid_db_user:P)a1s2s2@cluster0.dun9hav.mongodb.net/?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Conectat la MongoDB Atlas"))
    .catch(err => console.error("❌ Eroare conectare MongoDB:", err));

// --- SCHEME DATE ---
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: { type: String },
    score: { type: Number, default: 0 },
    rezolvate: { type: Object, default: {} }
});
const User = mongoose.model('User', UserSchema);

const ProblemaSchema = new mongoose.Schema({
    titlu: String,
    dificultate: String,
    cerinta: String,
    teste: Array
});
const Problema = mongoose.model('Problema', ProblemaSchema);

// --- MIDDLEWARE ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'secret-info-fotoliu',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// --- RUTE NAVIGARE ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'indexrizz.html')));
app.get('/admin-secret', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// --- AUTENTIFICARE ---
app.post('/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const nou = new User({ username, password });
        await nou.save();
        res.redirect('/login.html');
    } catch (e) { res.send("Nume ocupat sau eroare!"); }
});

app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (user) {
        req.session.user = user.username;
        res.redirect('/');
    } else { res.send("Date gresite!"); }
});

// --- LISTA PROBLEME + LIVE SEARCH + DESIGN CONCURS (ALBASTRU) ---
app.get('/probleme', async (req, res) => {
    const lista = await Problema.find();

    let html = `<html><head>
    <link rel="stylesheet" href="/style.css">
    <style>
        .problem-card {
            background:#1e293b; padding:20px; border-radius:12px; margin-bottom:15px; 
            border:1px solid #334155; transition: transform 0.2s, border-color 0.2s;
        }
        .problem-card:hover {
            transform: translateY(-3px);
            border-color: #38bdf8;
        }
        .diff-badge {
            padding: 4px 10px; border-radius: 6px; font-size: 0.75em; font-weight: bold; text-transform: uppercase;
        }
        .search-input:focus {
            border-color: #38bdf8 !important;
            box-shadow: 0 0 10px rgba(56, 189, 248, 0.2);
        }
    </style>
    <script>
        function liveSearch() {
            let input = document.getElementById('searchInput').value.toLowerCase();
            let problems = document.getElementsByClassName('problem-card');
            for (let i = 0; i < problems.length; i++) {
                let title = problems[i].getAttribute('data-title').toLowerCase();
                problems[i].style.display = title.includes(input) ? "" : "none";
            }
        }
    </script>
    </head>
    <body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;">
        <h1 style="color:#38bdf8; margin-bottom: 5px;">Arhiva Probleme</h1>
        <p style="color: #94a3b8; margin-bottom: 25px;">Exersează și devino cel mai bun!</p>
        <a href="/" style="color:#38bdf8; text-decoration:none; font-weight:bold;"><- Înapoi la Acasă</a><br><br>

        <input type="text" id="searchInput" onkeyup="liveSearch()" placeholder="Caută instant o problemă..." 
               class="search-input"
               style="width: 100%; max-width: 600px; padding: 15px; border-radius: 8px; border: 1px solid #334155; background: #1e293b; color: white; outline: none; font-size: 16px; margin-bottom: 30px;">

        <div id="lista-probleme">`;

    if (lista.length === 0) {
        html += `<p style="color: #94a3b8;">Nu sunt probleme momentan.</p>`;
    } else {
        lista.forEach((p) => {
            let diff = p.dificultate.toLowerCase();
            let color = '#94a3b8'; // default gri

            if (diff.includes('ușor')) color = '#4ade80'; // verde
            else if (diff.includes('mediu')) color = '#fbbf24'; // galben
            else if (diff.includes('greu')) color = '#f87171'; // roșu
            else if (diff.includes('concurs')) color = '#38bdf8'; // albastru (cerul gurii/rizz blue)
            
            html += `<div class="problem-card" data-title="${p.titlu}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h3 style="margin:0; display:inline-block; vertical-align:middle;">${p.titlu}</h3>
                        <span class="diff-badge" style="background:${color}22; color:${color}; border:1px solid ${color}; margin-left:10px;">${p.dificultate}</span>
                    </div>
                    <a href="/problema/${p._id}"><button style="background:#38bdf8; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:bold;">Rezolvă</button></a>
                </div>
            </div>`;
        });
    }

    res.send(html + "</div></body></html>");
});

// --- RESTUL RUTELOR (RĂMÂN NESCHIMBATE) ---
app.get('/problema/:id', async (req, res) => {
    if (!req.session.user) return res.send("Te rugăm să te loghezi!");
    try {
        const p = await Problema.findById(req.params.id);
        res.send(`<html><head><link rel="stylesheet" href="/style.css"></head>
        <body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;">
            <h1 style="color:#38bdf8;">${p.titlu}</h1>
            <div style="background:#1e293b;padding:25px;border-radius:12px; border-left: 5px solid #38bdf8;">${p.cerinta}</div>
            <form action="/submit/${p._id}" method="POST">
                <h3 style="margin-top:30px;">Codul tău C++:</h3>
                <textarea name="cod" rows="15" style="width:100%;background:#011627;color:#d6deeb;padding:20px;border-radius:10px;font-family:monospace;font-size:16px;border:1px solid #334155;"></textarea>
                <button type="submit" style="width:100%;margin-top:15px;background:#38bdf8;color:white;padding:18px;border:none;border-radius:10px;cursor:pointer;font-size:18px;font-weight:bold;">Trimite</button>
            </form><br><a href="/probleme" style="color:#94a3b8">Înapoi</a></body></html>`);
    } catch(e) { res.send("Eroare."); }
});

app.post('/submit/:id', async (req, res) => {
    if (!req.session.user) return res.send("Sesiune expirată.");
    const p = await Problema.findById(req.params.id);
    let punctajDobandit = 0;
    let feedback = "";
    try {
        for (let i = 0; i < p.teste.length; i++) {
            const t = p.teste[i];
            const r = await axios.post('https://ce.judge0.com/submissions?base64_encoded=false&wait=true', {
                source_code: req.body.cod, language_id: 54, stdin: t.in, expected_output: t.out
            });
            const outReal = (r.data.stdout || "").trim();
            const outAsteptat = (t.out || "").trim();
            if (r.data.status && (r.data.status.description === "Accepted" || outReal === outAsteptat)) {
                punctajDobandit += (100 / p.teste.length);
                feedback += `<p style="color:#4ade80">Test ${i+1}: Corect ✅</p>`;
            } else { feedback += `<p style="color:#f87171">Test ${i+1}: Greșit ❌</p>`; }
        }
        let scorFinal = Math.round(punctajDobandit);
        const user = await User.findOne({ username: req.session.user });
        if (user) {
            let scorVechi = user.rezolvate[p._id] || 0;
            if (scorFinal > scorVechi) {
                user.score += (scorFinal - scorVechi);
                user.rezolvate[p._id] = scorFinal;
                user.markModified('rezolvate');
                await user.save();
            }
        }
        res.send(`<body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;text-align:center;">
            <h1>Scor: ${scorFinal}p</h1><div style="background:#1e293b;padding:20px;border-radius:15px;">${feedback}</div>
            <br><a href="/probleme" style="color:#38bdf8">Înapoi</a></body>`);
    } catch (e) { res.send("Eroare evaluator."); }
});

app.get('/clasament', async (req, res) => {
    let users = await User.find().sort({ score: -1 });
    let rows = users.map((u, i) => `<tr style="border-bottom: 1px solid #334155;"><td style="padding:15px;">${i+1}</td><td style="padding:15px;">${u.username}</td><td style="padding:15px; color:#38bdf8;">${u.score}p</td></tr>`).join('');
    res.send(`<html><head><link rel="stylesheet" href="/style.css"></head><body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;">
        <h1 style="text-align:center; color:#38bdf8;">Top Programatori</h1>
        <table style="width:100%; max-width:600px; margin:0 auto; background:#1e293b; border-collapse:collapse; border-radius:12px; overflow:hidden;">
            <thead style="background:#334155;"><tr><th style="padding:15px;">Loc</th><th style="padding:15px;">User</th><th style="padding:15px;">Scor</th></tr></thead>
            <tbody>${rows}</tbody>
        </table><br><center><a href="/" style="color:#94a3b8">Acasă</a></center></body></html>`);
});

app.post('/adauga-problema', async (req, res) => {
    const { parola, titlu, dificultate, cerinta, teste_raw } = req.body;
    if (parola !== "admin123") return res.send("Gresit!");
    let teste = teste_raw.split(',').map(p => { 
        let parts = p.split('|'); return { in: parts[0].trim(), out: parts[1].trim() }; 
    });
    await new Problema({ titlu, dificultate, cerinta, teste }).save();
    res.send("Adaugat! <a href='/admin-secret'>Inapoi</a>");
});

app.post('/sterge-problema', async (req, res) => {
    if (req.body.parola !== "admin123") return res.send("Gresit!");
    await Problema.deleteOne({ titlu: req.body.titlu });
    res.send("Sters! <a href='/admin-secret'>Inapoi</a>");
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server pe portul ${PORT}`));
