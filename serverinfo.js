const express = require('express');
const axios = require('axios');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

const PORT = process.env.PORT || 10000;

// --- 1. CONECTARE MONGODB ---
const MONGO_URI = "mongodb+srv://gheorghitadavid_db_user:PAROLA_TA_AICI@cluster0.dun9hav.mongodb.net/?appName=Cluster0";
mongoose.connect(MONGO_URI).then(() => console.log("✅ Conectat la MongoDB")).catch(err => console.error(err));

// --- 2. SCHEME DATE (MODELE) ---
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: { type: String },
    score: { type: Number, default: 0 },
    friends: [String],
    claseInrolate: [String],
    lastActive: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const MessageSchema = new mongoose.Schema({
    from: String, to: String, text: String, data: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

const CapitolSchema = new mongoose.Schema({ nume: { type: String, unique: true } });
const Capitol = mongoose.model('Capitol', CapitolSchema);

const ProblemaSchema = new mongoose.Schema({
    nr: Number, titlu: String, dificultate: String, categorie: String, cerinta: String, teste: Array
});
const Problema = mongoose.model('Problema', ProblemaSchema);

const SubmissionSchema = new mongoose.Schema({
    username: String, problemaTitlu: String, scor: Number, timp: String, memorie: String, codSursa: String, data: { type: Date, default: Date.now }
});
const Submission = mongoose.model('Submission', SubmissionSchema);

const ClasaSchema = new mongoose.Schema({
    nume: String, cod: { type: String, unique: true }, parolaClasa: String, creator: String,
    teme: [{ titlu: String, problemaId: String }]
});
const Clasa = mongoose.model('Clasa', ClasaSchema);

// --- 3. MIDDLEWARE & DESIGN HELPER ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'rizz-ultra-key', resave: false, saveUninitialized: true }));

app.use(async (req, res, next) => {
    if (req.session.user) await User.updateOne({ username: req.session.user }, { lastActive: new Date() });
    next();
});

const layout = (title, content) => `
<html>
<head>
    <title>${title} | RIZZ Code</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        :root { --primary: #38bdf8; --bg: #0f172a; --card: #1e293b; --text: #f1f5f9; }
        body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', sans-serif; margin: 0; }
        header { background: rgba(15, 23, 42, 0.95); padding: 15px; position: sticky; top: 0; z-index: 100; border-bottom: 1px solid #334155; display: flex; justify-content: center; gap: 20px; }
        header a { color: white; text-decoration: none; font-weight: bold; font-size: 0.9rem; transition: 0.3s; }
        header a:hover { color: var(--primary); }
        .container { max-width: 900px; margin: 40px auto; padding: 20px; }
        .card { background: var(--card); padding: 25px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 20px; }
        .btn { background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; text-decoration: none; display: inline-block; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { text-align: left; padding: 12px; color: #94a3b8; border-bottom: 1px solid #334155; }
        td { padding: 12px; border-bottom: 1px solid #1e293b; }
        input, textarea, select { width: 100%; padding: 10px; margin: 10px 0; border-radius: 5px; border: 1px solid #334155; background: #0f172a; color: white; }
    </style>
</head>
<body>
    <header>
        <a href="/probleme"><i class="fas fa-book"></i> PROBLEME</a>
        <a href="/submisii"><i class="fas fa-code"></i> SUBMISII</a>
        <a href="/clase"><i class="fas fa-school"></i> CLASE</a>
        <a href="/prieteni"><i class="fas fa-users"></i> PRIETENI</a>
        <a href="/clasament"><i class="fas fa-trophy"></i> TOP</a>
        <a href="/"><i class="fas fa-home"></i> ACASĂ</a>
    </header>
    <div class="container">${content}</div>
</body>
</html>`;

// --- 4. RUTE AUTENTIFICARE ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'indexrizz.html')));
app.post('/auth/register', async (req, res) => {
    try { await new User({ username: req.body.username, password: req.body.password }).save(); res.redirect('/login.html'); }
    catch (e) { res.send("Eroare: Nume deja existent."); }
});
app.post('/auth/login', async (req, res) => {
    const u = await User.findOne({ username: req.body.username, password: req.body.password });
    if (u) { req.session.user = u.username; res.redirect('/'); } else res.send("Date incorecte.");
});

// --- 5. ARHIVĂ & ADMIN (CAPITOLE) ---
app.get('/admin-secret', async (req, res) => {
    const caps = await Capitol.find();
    res.send(layout("Admin", `
        <div class="card">
            <h2>Creează Capitol</h2>
            <form action="/admin/adauga-capitol" method="POST"><input name="numeCapitol" placeholder="Nume Capitol..."><button class="btn">Adaugă</button></form>
            <hr>
            <h2>Adaugă Problemă</h2>
            <form action="/adauga-problema" method="POST">
                <input name="parola" type="password" placeholder="Parola Admin">
                <input name="titlu" placeholder="Titlu Problemă">
                <select name="categorie">${caps.map(c => `<option value="${c.nume}">${c.nume}</option>`).join('')}</select>
                <textarea name="cerinta" placeholder="Cerință..."></textarea>
                <input name="teste_raw" placeholder="input|output, input|output">
                <button class="btn">Publică</button>
            </form>
        </div>
    `));
});

app.post('/admin/adauga-capitol', async (req, res) => {
    await new Capitol({ nume: req.body.numeCapitol }).save();
    res.redirect('/admin-secret');
});

app.post('/adauga-problema', async (req, res) => {
    if (req.body.parola !== "admin123") return res.send("Neautorizat.");
    const count = await Problema.countDocuments();
    let teste = req.body.teste_raw.split(',').map(t => { let p = t.split('|'); return { in: p[0].trim(), out: p[1].trim() }; });
    await new Problema({ nr: count + 1, titlu: req.body.titlu, categorie: req.body.categorie, cerinta: req.body.cerinta, teste }).save();
    res.redirect('/admin-secret');
});

app.get('/probleme', async (req, res) => {
    const lista = await Problema.find().sort({ nr: 1 });
    const caps = await Capitol.find();
    let html = caps.map(c => `
        <div class="card">
            <h3 style="color:var(--primary); margin:0;">📂 ${c.nume}</h3>
            ${lista.filter(p => p.categorie === c.nume).map(p => `
                <div style="display:flex; justify-content:space-between; margin-top:10px; border-top:1px solid #334155; padding-top:10px;">
                    <span><b>#${p.nr}</b> ${p.titlu}</span>
                    <a href="/problema/${p._id}" style="color:var(--primary); text-decoration:none;">Rezolvă →</a>
                </div>
            `).join('')}
        </div>
    `).join('');
    res.send(layout("Arhivă", html));
});

app.get('/problema/:id', async (req, res) => {
    const p = await Problema.findById(req.params.id);
    res.send(layout(p.titlu, `
        <div class="card">
            <h2>${p.titlu}</h2>
            <p>${p.cerinta}</p>
            <form action="/submit/${p._id}" method="POST">
                <textarea name="cod" style="height:300px; font-family:monospace;" placeholder="Scrie codul C++ aici..."></textarea>
                <button class="btn">Trimite Soluția</button>
            </form>
        </div>
    `));
});

// --- 6. EVALUATOR & SUBMISII (SHARE) ---
app.post('/submit/:id', async (req, res) => {
    if (!req.session.user) return res.send("Loghează-te!");
    const p = await Problema.findById(req.params.id);
    const r = await axios.post('https://ce.judge0.com/submissions?base64_encoded=false&wait=true', {
        source_code: req.body.cod, language_id: 54, stdin: p.teste[0].in, expected_output: p.teste[0].out
    });
    let scor = r.data.status.description === "Accepted" ? 100 : 0;
    const sub = await new Submission({ 
        username: req.session.user, problemaTitlu: p.titlu, scor, 
        timp: r.data.time || "0", memorie: r.data.memory || "0", codSursa: req.body.cod 
    }).save();
    if (scor === 100) await User.updateOne({ username: req.session.user }, { $inc: { score: 10 } });
    res.redirect('/submisii');
});

app.get('/submisii', async (req, res) => {
    const subs = await Submission.find().sort({ data: -1 }).limit(20);
    let rows = subs.map(s => `
        <tr>
            <td><a href="/submission/${s._id}" style="color:var(--primary);">#${s._id.toString().slice(-6)}</a></td>
            <td>${s.username}</td>
            <td>${s.problemaTitlu}</td>
            <td style="color:${s.scor === 100 ? '#4ade80' : '#f87171'}">${s.scor}p</td>
            <td>${s.timp}s</td>
        </tr>`).join('');
    res.send(layout("Submisii", `<div class="card"><h2>Submisii</h2><table><thead><tr><th>ID (Share)</th><th>User</th><th>Problemă</th><th>Scor</th><th>Timp</th></tr></thead><tbody>${rows}</tbody></table></div>`));
});

app.get('/submission/:id', async (req, res) => {
    const s = await Submission.findById(req.params.id);
    res.send(layout("Cod", `
        <div class="card">
            <h2>Soluția lui ${s.username} <button class="btn" onclick="navigator.clipboard.writeText(window.location.href); alert('Link copiat!')">Share Link</button></h2>
            <pre style="background:#0f172a; padding:15px; border-radius:5px; border:1px solid #334155;">${s.codSursa}</pre>
        </div>
    `));
});

// --- 7. PRIETENI & CHAT ---
app.get('/prieteni', async (req, res) => {
    if (!req.session.user) return res.redirect('/login.html');
    const u = await User.findOne({ username: req.session.user });
    const lista = await User.find({ username: { $in: u.friends } });
    let html = lista.map(f => {
        const isOn = (new Date() - f.lastActive) < 300000;
        return `
        <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
            <span><i class="fas fa-circle" style="color:${isOn ? '#4ade80' : '#f87171'}"></i> <b>${f.username}</b></span>
            <a href="/chat/${f.username}" class="btn">Mesaj</a>
        </div>`;
    }).join('');
    res.send(layout("Prieteni", `<h1>Prieteni</h1><form action="/add-friend" method="POST"><input name="friendName" placeholder="Adaugă prieten..."><button class="btn">Adaugă</button></form><br>${html}`));
});

app.post('/add-friend', async (req, res) => {
    await User.updateOne({ username: req.session.user }, { $addToSet: { friends: req.body.friendName } });
    res.redirect('/prieteni');
});

app.get('/chat/:friend', async (req, res) => {
    const me = req.session.user;
    const friend = req.params.friend;
    const msgs = await Message.find({ $or: [{from: me, to: friend}, {from: friend, to: me}] }).sort({data: 1});
    let mHtml = msgs.map(m => `<p style="text-align:${m.from === me ? 'right' : 'left'}"><span style="background:#334155; padding:5px 10px; border-radius:10px;">${m.text}</span></p>`).join('');
    res.send(layout(`Chat cu ${friend}`, `<div class="card"><div style="height:300px; overflow-y:auto;">${mHtml}</div><form action="/send-msg" method="POST"><input type="hidden" name="to" value="${friend}"><input name="text" placeholder="Scrie un mesaj..."><button class="btn">Trimite</button></form></div>`));
});

app.post('/send-msg', async (req, res) => {
    await new Message({ from: req.session.user, to: req.body.to, text: req.body.text }).save();
    res.redirect('/chat/' + req.body.to);
});

// --- 8. CLASAMENT ---
app.get('/clasament', async (req, res) => {
    const users = await User.find().sort({ score: -1 });
    let rows = users.map((u, i) => `<tr><td>${i+1}</td><td>${u.username}</td><td><b>${u.score}p</b></td></tr>`).join('');
    res.send(layout("Top", `<div class="card"><h2>🏆 Top Elevi</h2><table><thead><tr><th>Loc</th><th>Nume</th><th>Scor</th></tr></thead><tbody>${rows}</tbody></table></div>`));
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server on port ${PORT}`));
