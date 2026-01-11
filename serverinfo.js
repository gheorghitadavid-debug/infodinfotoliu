const express = require('express');
const axios = require('axios');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

const PORT = process.env.PORT || 10000;

// --- 1. CONECTARE MONGODB ---
const MONGO_URI = "mongodb+srv://gheorghitadavid_db_user:P)a1s2s2@cluster0.dun9hav.mongodb.net/?appName=Cluster0";
mongoose.connect(MONGO_URI).then(() => console.log("✅ Conectat la MongoDB")).catch(err => console.error(err));

// --- 2. SCHEME DATE (MODELE) ---
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
    nr: Number, titlu: String, dificultate: String, categorie: { type: String, default: "Diverse" },
    cerinta: String, teste: Array
});
const Problema = mongoose.model('Problema', ProblemaSchema);

const ClasaSchema = new mongoose.Schema({
    nume: String, cod: { type: String, unique: true }, parolaClasa: String, creator: String,
    materiale: [{ titlu: String, continut: String }], teme: [{ titlu: String, problemaId: String }]
});
const Clasa = mongoose.model('Clasa', ClasaSchema);

const SubmissionSchema = new mongoose.Schema({
    username: String, problemaId: mongoose.Schema.Types.ObjectId, problemaTitlu: String,
    scor: Number, timp: String, memorie: String, codDimensiune: Number, codSursa: String, data: { type: Date, default: Date.now }
});
const Submission = mongoose.model('Submission', SubmissionSchema);

// --- 3. MIDDLEWARE ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'rizz-ultra-key', resave: false, saveUninitialized: true }));

// Middleware pentru status Online/Offline
app.use(async (req, res, next) => {
    if (req.session.user) {
        await User.updateOne({ username: req.session.user }, { lastActive: new Date() });
    }
    next();
});

// --- 4. RUTE AUTENTIFICARE & PROFIL ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'indexrizz.html')));

app.post('/auth/register', async (req, res) => {
    try { await new User({ username: req.body.username, password: req.body.password }).save(); res.redirect('/login.html'); }
    catch (e) { res.send("Nume ocupat!"); }
});

app.post('/auth/login', async (req, res) => {
    const user = await User.findOne({ username: req.body.username, password: req.body.password });
    if (user) { req.session.user = user.username; res.redirect('/'); }
    else res.send("Date gresite!");
});

app.get('/profil', async (req, res) => {
    if (!req.session.user) return res.redirect('/login.html');
    const user = await User.findOne({ username: req.session.user });
    res.send(`<html><head><link rel="stylesheet" href="/style.css"></head><body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;text-align:center;">
        <img src="${user.avatar}" style="width:120px;height:120px;border-radius:50%;border:3px solid #38bdf8;object-fit:cover;">
        <h1>Profil: ${user.username}</h1>
        <p>Scor Global: <b style="color:#4ade80">${user.score}p</b></p>
        <form action="/update-avatar" method="POST"><input type="text" name="avatarUrl" placeholder="Link poza noua..."><button type="submit">Schimba</button></form>
        <br><a href="/" style="color:white;">Inapoi Acasa</a></body></html>`);
});

app.post('/update-avatar', async (req, res) => {
    await User.updateOne({ username: req.session.user }, { avatar: req.body.avatarUrl });
    res.redirect('/profil');
});

// --- 5. SISTEM PRIETENI (ONLINE/OFFLINE) ---
app.get('/prieteni', async (req, res) => {
    if (!req.session.user) return res.redirect('/login.html');
    const user = await User.findOne({ username: req.session.user });
    const lista = await User.find({ username: { $in: user.friends } });

    let htmlPrieteni = lista.map(f => {
        const isOnline = (new Date() - f.lastActive) < 300000;
        const color = isOnline ? "#4ade80" : "#f87171";
        return `<div style="background:#1e293b;padding:15px;margin-bottom:10px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;border-left:5px solid ${color};">
            <div><b>${f.username}</b><br><small>Scor: ${f.score}p</small></div>
            <div style="color:${color};font-weight:bold;">● ${isOnline ? 'Online' : 'Offline'}</div>
        </div>`;
    }).join('');

    res.send(`<html><body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;">
        <h1 style="color:#38bdf8;">👥 Prieteni</h1>
        <form action="/add-friend" method="POST" style="margin-bottom:20px;">
            <input name="friendName" placeholder="Adauga prieten dupa username..." required>
            <button type="submit">Adauga</button>
        </form>
        <div style="max-width:500px;">${htmlPrieteni || "Nu ai prieteni adaugati."}</div>
        <br><a href="/" style="color:white;">Inapoi</a></body></html>`);
});

app.post('/add-friend', async (req, res) => {
    await User.updateOne({ username: req.session.user }, { $addToSet: { friends: req.body.friendName } });
    res.redirect('/prieteni');
});

// --- 6. SISTEM CLASE (PROFESORI/ELEVI) ---
app.get('/clase', async (req, res) => {
    if (!req.session.user) return res.send("Logheaza-te!");
    const user = await User.findOne({ username: req.session.user });
    const cIn = await Clasa.find({ cod: { $in: user.claseInrolate } });
    const cMine = await Clasa.find({ creator: req.session.user });

    res.send(`<html><body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;">
        <h1>🏫 Clase & Teme</h1>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
            <div style="background:#1e293b;padding:20px;border-radius:10px;">
                <h2>Profesor (Creeaza)</h2>
                <form action="/creeaza-clasa" method="POST">
                    <input name="nume" placeholder="Nume Clasa" required><input name="cod" placeholder="Cod Unic" required><input name="parolaClasa" placeholder="Parola" required>
                    <button type="submit">Creeaza</button>
                </form>
                ${cMine.map(c => `<p>• <a href="/clasa/${c.cod}" style="color:#38bdf8;">${c.nume}</a></p>`).join('')}
            </div>
            <div style="background:#1e293b;padding:20px;border-radius:10px;">
                <h2>Elev (Inscrie-te)</h2>
                <form action="/inscrie-clasa" method="POST">
                    <input name="cod" placeholder="Cod Clasa"><input name="parolaClasa" placeholder="Parola">
                    <button type="submit">Intra</button>
                </form>
                ${cIn.map(c => `<p>• <a href="/clasa/${c.cod}" style="color:#38bdf8;">${c.nume}</a></p>`).join('')}
            </div>
        </div></body></html>`);
});

app.post('/creeaza-clasa', async (req, res) => {
    await new Clasa({ ...req.body, creator: req.session.user }).save();
    res.redirect('/clase');
});

app.post('/inscrie-clasa', async (req, res) => {
    const clasa = await Clasa.findOne({ cod: req.body.cod, parolaClasa: req.body.parolaClasa });
    if (clasa) await User.updateOne({ username: req.session.user }, { $addToSet: { claseInrolate: req.body.cod } });
    res.redirect('/clase');
});

app.get('/clasa/:cod', async (req, res) => {
    const c = await Clasa.findOne({ cod: req.params.cod });
    const eProf = c.creator === req.session.user;
    res.send(`<html><body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;">
        <h1>${c.nume}</h1>
        <h3>📝 Teme:</h3>${c.teme.map(t => `<p>${t.titlu} - <a href="/problema/${t.problemaId}" style="color:#38bdf8;">Rezolva</a></p>`).join('')}
        ${eProf ? `<hr><form action="/clasa/${c.cod}/tema" method="POST"><input name="titlu" placeholder="Titlu Tema"><input name="probId" placeholder="ID Problema"><button>Pune Tema</button></form>` : ""}
    </body></html>`);
});

app.post('/clasa/:cod/tema', async (req, res) => {
    await Clasa.updateOne({ cod: req.params.cod }, { $push: { teme: { titlu: req.body.titlu, problemaId: req.body.probId } } });
    res.redirect('/clasa/' + req.params.cod);
});

// --- 7. SUBMISII & SHARE ---
app.get('/monitor', async (req, res) => {
    const subs = await Submission.find().sort({ data: -1 }).limit(30);
    let rows = subs.map(s => `<tr style="border-bottom:1px solid #334155;text-align:center;">
        <td><a href="/submission/${s._id}" style="color:#94a3b8;font-size:11px;">#${s._id.toString().slice(-5)}</a></td>
        <td><b>${s.username}</b></td><td>${s.problemaTitlu}</td>
        <td style="color:${s.scor === 100 ? '#4ade80' : '#f87171'}">${s.scor}p</td>
        <td>${s.timp}ms / ${s.memorie}KB</td></tr>`).join('');
    res.send(`<html><body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;">
        <h1 style="text-align:center;color:#38bdf8;">🖥️ Submisii Solutii</h1>
        <table style="width:100%;max-width:800px;margin:0 auto;background:#1e293b;border-collapse:collapse;">
            <thead style="background:#334155;"><tr><th>ID (Share)</th><th>User</th><th>Problema</th><th>Scor</th><th>Resurse</th></tr></thead>
            <tbody>${rows}</tbody>
        </table></body></html>`);
});

app.get('/submission/:id', async (req, res) => {
    const sub = await Submission.findById(req.params.id);
    res.send(`<html><head><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.css"><script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/clike/clike.min.js"></script></head>
    <body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;">
        <h2>Solutie trimisa de ${sub.username}</h2>
        <textarea id="code">${sub.codSursa}</textarea>
        <script>CodeMirror.fromTextArea(document.getElementById("code"), {lineNumbers:true, mode:"text/x-c++src", readOnly:true}).setSize("100%","500px");</script>
    </body></html>`);
});

// --- 8. EVALUATOR ---
app.get('/probleme', async (req, res) => {
    const lista = await Problema.find().sort({ nr: 1 });
    res.send(`<html><body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;">
        <h1>Arhiva</h1>${lista.map(p => `<p>#${p.nr} ${p.titlu} <a href="/problema/${p._id}" style="color:#38bdf8;">Rezolva</a></p>`).join('')}
    </body></html>`);
});

app.get('/problema/:id', async (req, res) => {
    const p = await Problema.findById(req.params.id);
    res.send(`<html><head><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.css"><script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/clike/clike.min.js"></script></head>
    <body style="background:#0f172a;color:white;padding:40px;">
        <h2>${p.titlu}</h2><p>${p.cerinta}</p>
        <form action="/submit/${p._id}" method="POST"><textarea id="ed" name="cod"></textarea><button type="submit">Trimite</button></form>
        <script>CodeMirror.fromTextArea(document.getElementById("ed"), {lineNumbers:true, mode:"text/x-c++src"}).setSize("100%", "400px");</script>
    </body></html>`);
});

app.post('/submit/:id', async (req, res) => {
    if (!req.session.user) return res.send("Logheaza-te!");
    const p = await Problema.findById(req.params.id);
    let score = 0, maxT = 0, maxM = 0;
    for (let t of p.teste) {
        const r = await axios.post('https://ce.judge0.com/submissions?base64_encoded=false&wait=true', {
            source_code: req.body.cod, language_id: 54, stdin: t.in, expected_output: t.out
        });
        if (r.data.status?.description === "Accepted") score += (100 / p.teste.length);
        maxT = Math.max(maxT, parseFloat(r.data.time || 0)); maxM = Math.max(maxM, parseFloat(r.data.memory || 0));
    }
    const final = Math.round(score);
    await new Submission({ username: req.session.user, problemaId: p._id, problemaTitlu: p.titlu, scor: final, timp: (maxT * 1000).toFixed(0), memorie: maxM.toFixed(0), codDimensiune: Buffer.byteLength(req.body.cod), codSursa: req.body.cod }).save();
    
    const u = await User.findOne({ username: req.session.user });
    let v = u.rezolvate.get(p._id.toString()) || 0;
    if(final > v) { u.score += (final-v); u.rezolvate.set(p._id.toString(), final); await u.save(); }
    res.redirect('/monitor');
});

// --- 9. CLASAMENT & ADMIN ---
app.get('/clasament', async (req, res) => {
    const users = await User.find().sort({ score: -1 });
    let r = users.map((u, i) => `<tr><td>${i+1}</td><td>${u.username}</td><td>${u.score}p</td></tr>`).join('');
    res.send(`<html><body style="background:#0f172a;color:white;padding:50px;"><h1>Top</h1><table>${r}</table></body></html>`);
});

app.post('/adauga-problema', async (req, res) => {
    if (req.body.parola !== "admin123") return res.send("Gresit!");
    const count = await Problema.countDocuments();
    const { titlu, dificultate, categorie, cerinta, teste_raw } = req.body;
    let teste = teste_raw.split(',').map(p => { let parts = p.split('|'); return { in: parts[0].trim(), out: parts[1].trim() }; });
    await new Problema({ nr: count + 1, titlu, dificultate, categorie, cerinta, teste }).save();
    res.redirect('/admin-secret');
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server on port ${PORT}`));
