const express = require('express');
const axios = require('axios');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

const PORT = process.env.PORT || 10000;

// --- CONECTARE MONGODB (Pune parola ta în loc de PAROLA_TA_AICI) ---
const MONGO_URI = "mongodb+srv://gheorghitadavid_db_user:PAROLA_TA_AICI@cluster0.dun9hav.mongodb.net/?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Conectat la MongoDB Atlas"))
    .catch(err => console.error("❌ Eroare conectare MongoDB:", err));

// --- SCHEME DATE (În loc de JSON) ---
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

// --- PROBLEME ---
app.get('/probleme', async (req, res) => {
    const lista = await Problema.find();
    let html = `<html><head><link rel="stylesheet" href="/style.css"></head><body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;">`;
    html += `<h1>Arhiva Probleme</h1><a href="/" style="color:#38bdf8;text-decoration:none;"><- Acasa</a><br><br>`;
    lista.forEach((p, i) => {
        html += `<div style="background:#1e293b;padding:20px;border-radius:10px;margin-bottom:10px;border:1px solid #333;">
            <h3>${p.titlu} (${p.dificultate})</h3>
            <a href="/problema/${p._id}"><button style="background:#38bdf8; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer;">Rezolva</button></a>
        </div>`;
    });
    res.send(html + "</body></html>");
});

app.get('/problema/:id', async (req, res) => {
    if (!req.session.user) return res.send("Logheaza-te!");
    const p = await Problema.findById(req.params.id);
    if (!p) return res.send("Nu exista.");
    res.send(`<html><head><link rel="stylesheet" href="/style.css"></head><body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;">
        <h1>${p.titlu}</h1><div style="background:#1e293b;padding:20px;border-radius:10px;">${p.cerinta}</div>
        <form action="/submit/${p._id}" method="POST">
            <textarea name="cod" rows="15" style="width:100%;background:#011627;color:white;padding:15px;margin-top:20px;font-family:monospace;"></textarea>
            <button type="submit" style="width:100%;margin-top:10px;background:#38bdf8;color:white;padding:15px;border:none;border-radius:5px;cursor:pointer;">Trimite Solutia</button>
        </form><br><a href="/probleme" style="color:#38bdf8">Inapoi</a></body></html>`);
});

// --- EVALUATOR ---
app.post('/submit/:id', async (req, res) => {
    if (!req.session.user) return res.send("Sesiune expirata.");
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
            } else { feedback += `<p style="color:#f87171">Test ${i+1}: Gresit ❌</p>`; }
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
                feedback += `<h2 style="color:#38bdf8">Scorul a crescut!</h2>`;
            }
        }
        res.send(`<body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;"><h1>Scor: ${scorFinal}p</h1>${feedback}<br><a href="/probleme" style="color:#38bdf8">Inapoi</a></body>`);
    } catch (e) { res.send("Eroare evaluator."); }
});

// --- CLASAMENT ---
app.get('/clasament', async (req, res) => {
    let users = await User.find().sort({ score: -1 });
    let rows = users.map((u, i) => `<tr><td style="padding:10px;border:1px solid #333;">${i+1}</td><td style="padding:10px;border:1px solid #333;">${u.username}</td><td style="padding:10px;border:1px solid #333;">${u.score}p</td></tr>`).join('');
    res.send(`<html><head><link rel="stylesheet" href="/style.css"></head><body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;"><h1 style="text-align:center">Top Programatori</h1><table style="width:100%;background:#1e293b;border-collapse:collapse;text-align:center;">${rows}</table><br><center><a href="/" style="color:#38bdf8">Acasa</a></center></body></html>`);
});

// --- ADMIN ---
app.post('/adauga-problema', async (req, res) => {
    const { parola, titlu, dificultate, cerinta, teste_raw } = req.body;
    if (parola !== "admin123") return res.send("Gresit!");
    let teste = teste_raw.split(',').map(p => { 
        let parts = p.split('|'); 
        return { in: parts[0].trim(), out: parts[1].trim() }; 
    });
    const noua = new Problema({ titlu, dificultate, cerinta, teste });
    await noua.save();
    res.send("Adaugat! <a href='/admin-secret'>Inapoi</a>");
});

app.post('/sterge-problema', async (req, res) => {
    const { parola, titlu } = req.body;
    if (parola !== "admin123") return res.send("Gresit!");
    await Problema.deleteOne({ titlu: titlu });
    res.send("Sters! <a href='/admin-secret'>Inapoi</a>");
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server on port ${PORT}`));
