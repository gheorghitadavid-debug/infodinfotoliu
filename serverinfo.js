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

const MessageSchema = new mongoose.Schema({
    from: String, to: String, text: String, data: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

const CapitolSchema = new mongoose.Schema({ nume: { type: String, unique: true } });
const Capitol = mongoose.model('Capitol', CapitolSchema);

const ProblemaSchema = new mongoose.Schema({
    nr: Number, titlu: String, dificultate: String, categorie: String,
    cerinta: String, teste: Array
});
const Problema = mongoose.model('Problema', ProblemaSchema);

const ClasaSchema = new mongoose.Schema({
    nume: String, cod: { type: String, unique: true }, parolaClasa: String, creator: String,
    materiale: [{ titlu: String, continut: String }], teme: [{ titlu: String, problemaId: String }]
});
const Clasa = mongoose.model('Clasa', ClasaSchema);

const SubmissionSchema = new mongoose.Schema({
    username: String, problemaId: String, problemaTitlu: String,
    scor: Number, timp: String, memorie: String, codSursa: String, data: { type: Date, default: Date.now }
});
const Submission = mongoose.model('Submission', SubmissionSchema);

// --- 3. MIDDLEWARE ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'rizz-ultra-key', resave: false, saveUninitialized: true }));

app.use(async (req, res, next) => {
    if (req.session.user) { await User.updateOne({ username: req.session.user }, { lastActive: new Date() }); }
    next();
});

// --- 4. RUTE PRINCIPALE & AUTH ---
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

// --- 5. MESAGERIE (CHAT) ---
app.get('/chat/:friend', async (req, res) => {
    if (!req.session.user) return res.redirect('/login.html');
    const me = req.session.user;
    const friend = req.params.friend;
    const msgs = await Message.find({ $or: [{from: me, to: friend}, {from: friend, to: me}] }).sort({data: 1});
    let chatHtml = msgs.map(m => `<div style="text-align: ${m.from === me ? 'right' : 'left'}; margin: 10px;"><span style="background: ${m.from === me ? '#38bdf8' : '#334155'}; padding: 8px 15px; border-radius: 15px; display: inline-block;">${m.text}</span></div>`).join('');
    res.send(`<html><body style="background:#0f172a;color:white;padding:20px;font-family:sans-serif;"><h2 style="text-align:center;">Chat cu ${friend}</h2><div style="max-width:500px; margin:0 auto; background:#1e293b; height:400px; overflow-y:auto; padding:20px; border-radius:10px;">${chatHtml}</div><form action="/send-msg" method="POST" style="max-width:500px; margin:20px auto; display:flex; gap:10px;"><input type="hidden" name="to" value="${friend}"><input name="text" placeholder="Mesaj..." style="flex:1; padding:10px;" required><button type="submit">Trimite</button></form><center><a href="/prieteni" style="color:white;">Inapoi</a></center></body></html>`);
});

app.post('/send-msg', async (req, res) => {
    await new Message({ from: req.session.user, to: req.body.to, text: req.body.text }).save();
    res.redirect('/chat/' + req.body.to);
});

// --- 6. SUBMISII & SHARE ---
app.get('/submisii', async (req, res) => {
    const subs = await Submission.find().sort({ data: -1 }).limit(30);
    let rows = subs.map(s => `<tr style="border-bottom:1px solid #334155;text-align:center;"><td><a href="/submission/${s._id}" style="color:#38bdf8;">#${s._id.toString().slice(-5)}</a></td><td><b>${s.username}</b></td><td>${s.problemaTitlu}</td><td style="color:#4ade80;">${s.scor}p</td><td>${s.timp}ms</td></tr>`).join('');
    res.send(`<html><body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;"><h1>Submisii</h1><table style="width:100%;max-width:800px;background:#1e293b;"><thead><tr><th>ID</th><th>User</th><th>Prob</th><th>Scor</th><th>Timp</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
});

app.get('/submission/:id', async (req, res) => {
    const sub = await Submission.findById(req.params.id);
    res.send(`<html><body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;"><h2>Solutie ${sub.username}</h2><button onclick="navigator.clipboard.writeText(window.location.href);alert('Link copiat!')">Share Cod</button><pre style="background:#1e293b;padding:20px;">${sub.codSursa}</pre></body></html>`);
});

// --- 7. ADMIN, CAPITOLE & EVALUATOR ---
app.get('/admin-secret', async (req, res) => {
    const caps = await Capitol.find();
    res.send(`<html><body style="background:#0f172a;color:white;padding:50px;"><h1>Admin</h1><form action="/admin/adauga-capitol" method="POST"><input name="numeCapitol" placeholder="Capitol Nou"><button>Adauga</button></form><hr><form action="/adauga-problema" method="POST"><input name="parola" type="password" placeholder="Parola"><input name="titlu" placeholder="Titlu"><select name="categorie">${caps.map(c => `<option value="${c.nume}">${c.nume}</option>`).join('')}</select><textarea name="cerinta"></textarea><input name="teste_raw" placeholder="in|out,in|out"><button>Pune Prob</button></form></body></html>`);
});

app.post('/admin/adauga-capitol', async (req, res) => {
    await new Capitol({ nume: req.body.numeCapitol }).save();
    res.redirect('/admin-secret');
});

app.post('/adauga-problema', async (req, res) => {
    if (req.body.parola !== "admin123") return res.send("Acces interzis!");
    const count = await Problema.countDocuments();
    let teste = req.body.teste_raw.split(',').map(t => { let p = t.split('|'); return { in: p[0].trim(), out: p[1].trim() }; });
    await new Problema({ nr: count + 1, titlu: req.body.titlu, categorie: req.body.categorie, cerinta: req.body.cerinta, teste }).save();
    res.redirect('/admin-secret');
});

app.post('/submit/:id', async (req, res) => {
    if (!req.session.user) return res.send("Logheaza-te!");
    const p = await Problema.findById(req.params.id);
    // Evaluare Judge0 simplificata
    const r = await axios.post('https://ce.judge0.com/submissions?base64_encoded=false&wait=true', {
        source_code: req.body.cod, language_id: 54, stdin: p.teste[0].in, expected_output: p.teste[0].out
    });
    let scor = r.data.status.description === "Accepted" ? 100 : 0;
    await new Submission({ username: req.session.user, problemaId: p._id, problemaTitlu: p.titlu, scor: scor, timp: r.data.time, memorie: r.data.memory, codSursa: req.body.cod }).save();
    if (scor === 100) await User.updateOne({ username: req.session.user }, { $inc: { score: 10 } });
    res.redirect('/submisii');
});

// --- 8. PRIETENI, CLASE & CLASAMENT ---
app.get('/prieteni', async (req, res) => {
    const u = await User.findOne({ username: req.session.user });
    const lista = await User.find({ username: { $in: u.friends } });
    let html = lista.map(f => {
        const isOn = (new Date() - f.lastActive) < 300000;
        return `<p>${f.username} - <span style="color:${isOn?'#4ade80':'#f87171'}">${isOn?'Online':'Offline'}</span> - <a href="/chat/${f.username}">Chat</a></p>`;
    }).join('');
    res.send(`<html><body style="background:#0f172a;color:white;padding:50px;"><h1>Prieteni</h1>${html}</body></html>`);
});

app.post('/add-friend', async (req, res) => {
    await User.updateOne({ username: req.session.user }, { $addToSet: { friends: req.body.friendName } });
    res.redirect('/prieteni');
});

app.get('/clasament', async (req, res) => {
    const users = await User.find().sort({ score: -1 });
    let rows = users.map((u, i) => `<tr><td>${i+1}</td><td>${u.username}</td><td>${u.score}p</td></tr>`).join('');
    res.send(`<html><body style="background:#0f172a;color:white;padding:50px;"><h1>Clasament</h1><table border="1">${rows}</table></body></html>`);
});

app.get('/probleme', async (req, res) => {
    const lista = await Problema.find();
    const caps = await Capitol.find();
    let html = caps.map(c => `<h3>${c.nume}</h3>` + lista.filter(p => p.categorie === c.nume).map(p => `<p>#${p.nr} ${p.titlu} <a href="/problema/${p._id}">Rezolva</a></p>`).join('')).join('');
    res.send(`<html><body style="background:#0f172a;color:white;padding:50px;"><h1>Arhiva</h1>${html}</body></html>`);
});

app.get('/problema/:id', async (req, res) => {
    const p = await Problema.findById(req.params.id);
    res.send(`<html><body style="background:#0f172a;color:white;padding:50px;"><h2>${p.titlu}</h2><p>${p.cerinta}</p><form action="/submit/${p._id}" method="POST"><textarea name="cod" style="width:100%;height:300px;"></textarea><br><button>Trimite</button></form></body></html>`);
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server on port ${PORT}`));
