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
    claseInrolate: [String]
});
const User = mongoose.model('User', UserSchema);

const ProblemaSchema = new mongoose.Schema({
    nr: Number,
    titlu: String,
    dificultate: String,
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
    problemaId: mongoose.Schema.Types.ObjectId,
    problemaTitlu: String,
    scor: Number,
    timp: String,
    memorie: String,
    codDimensiune: Number,
    codSursa: String, // Pentru a putea trimite submisia altora
    data: { type: Date, default: Date.now }
});
const Submission = mongoose.model('Submission', SubmissionSchema);

// --- 3. MIDDLEWARE ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'rizz-ultra-mega-key', resave: false, saveUninitialized: true }));

// --- 4. RUTE AUTENTIFICARE & PROFIL ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'indexrizz.html')));

app.post('/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        await new User({ username, password }).save();
        res.redirect('/login.html');
    } catch (e) { res.send("Nume ocupat!"); }
});

app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (user) { req.session.user = user.username; res.redirect('/'); }
    else { res.send("Date gresite!"); }
});

app.get('/profil', async (req, res) => {
    if (!req.session.user) return res.redirect('/login.html');
    const user = await User.findOne({ username: req.session.user });
    res.send(`
    <html><head><link rel="stylesheet" href="/style.css"></head>
    <body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;text-align:center;">
        <img src="${user.avatar}" style="width:120px;height:120px;border-radius:50%;border:3px solid #38bdf8;object-fit:cover;">
        <h1>Profil: ${user.username}</h1>
        <p>Scor Global: <b style="color:#4ade80">${user.score}p</b></p>
        <form action="/update-avatar" method="POST">
            <input type="text" name="avatarUrl" placeholder="Link poza noua..." style="padding:8px;border-radius:5px;">
            <button type="submit" style="background:#38bdf8;border:none;padding:8px;color:white;cursor:pointer;">Schimba Poza</button>
        </form>
        <div style="background:#1e293b;padding:20px;border-radius:10px;max-width:400px;margin:20px auto;text-align:left;">
            <h3>Prieteni (⭐):</h3>
            <form action="/add-friend" method="POST">
                <input type="text" name="friendName" placeholder="Username..." style="padding:5px;">
                <button type="submit">Adauga</button>
            </form>
            <p>${user.friends.join(', ') || "Fara prieteni."}</p>
        </div>
        <a href="/clase" style="color:#38bdf8;text-decoration:none;font-weight:bold;">Vezi Clasele Mele</a> | <a href="/" style="color:white;">Acasa</a>
    </body></html>`);
});

app.post('/update-avatar', async (req, res) => {
    await User.updateOne({ username: req.session.user }, { avatar: req.body.avatarUrl });
    res.redirect('/profil');
});

app.post('/add-friend', async (req, res) => {
    await User.updateOne({ username: req.session.user }, { $addToSet: { friends: req.body.friendName } });
    res.redirect('/profil');
});

// --- 5. RUTE CLASE (SISTEM MULTI-CLASA) ---
app.get('/clase', async (req, res) => {
    if (!req.session.user) return res.send("Logheaza-te!");
    const user = await User.findOne({ username: req.session.user });
    const claseIn = await Clasa.find({ cod: { $in: user.claseInrolate } });
    const claseCreate = await Clasa.find({ creator: req.session.user });

    res.send(`<html><body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;">
        <h1 style="color:#38bdf8;">🏫 Sistem Clase</h1>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
            <div style="background:#1e293b;padding:20px;border-radius:10px;">
                <h2>Sunt Profesor (Creeaza Clasa)</h2>
                <form action="/creeaza-clasa" method="POST">
                    <input type="text" name="nume" placeholder="Nume Clasa" style="width:100%;margin-bottom:10px;padding:8px;" required>
                    <input type="text" name="cod" placeholder="Cod Unic (ex: MATE10)" style="width:100%;margin-bottom:10px;padding:8px;" required>
                    <input type="password" name="parolaClasa" placeholder="Parola pentru Elevi" style="width:100%;margin-bottom:10px;padding:8px;" required>
                    <button type="submit" style="width:100%;background:#4ade80;color:white;border:none;padding:10px;cursor:pointer;">Creeaza</button>
                </form>
                <h3>Clasele administrate de mine:</h3>
                ${claseCreate.map(c => `<p>• <a href="/clasa/${c.cod}" style="color:#38bdf8;">${c.nume}</a></p>`).join('')}
            </div>
            <div style="background:#1e293b;padding:20px;border-radius:10px;">
                <h2>Sunt Elev (Inscrie-te)</h2>
                <form action="/inscrie-clasa" method="POST">
                    <input type="text" name="cod" placeholder="Cod Clasa" style="width:100%;margin-bottom:10px;padding:8px;" required>
                    <input type="password" name="parolaClasa" placeholder="Parola" style="width:100%;margin-bottom:10px;padding:8px;" required>
                    <button type="submit" style="width:100%;background:#38bdf8;color:white;border:none;padding:10px;cursor:pointer;">Inscrie-te</button>
                </form>
                <h3>Clasele in care sunt inscris:</h3>
                ${claseIn.map(c => `<p>• <a href="/clasa/${c.cod}" style="color:#38bdf8;">${c.nume}</a></p>`).join('')}
            </div>
        </div>
    </body></html>`);
});

app.post('/creeaza-clasa', async (req, res) => {
    const { nume, cod, parolaClasa } = req.body;
    await new Clasa({ nume, cod, parolaClasa, creator: req.session.user }).save();
    res.redirect('/clase');
});

app.post('/inscrie-clasa', async (req, res) => {
    const clasa = await Clasa.findOne({ cod: req.body.cod, parolaClasa: req.body.parolaClasa });
    if (clasa) {
        await User.updateOne({ username: req.session.user }, { $addToSet: { claseInrolate: req.body.cod } });
        res.redirect('/clase');
    } else res.send("Cod sau parola gresita!");
});

app.get('/clasa/:cod', async (req, res) => {
    const c = await Clasa.findOne({ cod: req.params.cod });
    const eProf = c.creator === req.session.user;
    res.send(`<html><body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;">
        <h1>Clasa: ${c.nume}</h1>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
            <div><h3>📚 Materiale</h3>${c.materiale.map(m => `<div style="background:#1e293b;padding:10px;margin-bottom:5px;"><b>${m.titlu}</b><p>${m.continut}</p></div>`).join('')}</div>
            <div><h3>📝 Teme</h3>${c.teme.map(t => `<div style="background:#1e293b;padding:10px;margin-bottom:5px;"><b>${t.titlu}</b><br><a href="/problema/${t.problemaId}" style="color:#38bdf8;">Rezolva Problema</a></div>`).join('')}</div>
        </div>
        ${eProf ? `<hr><h3>Panou Profesor</h3>
            <form action="/clasa/${c.cod}/material" method="POST"><input name="titlu" placeholder="Titlu"><textarea name="continut" placeholder="Teorie..."></textarea><button>Adauga Material</button></form>
            <form action="/clasa/${c.cod}/tema" method="POST"><input name="titlu" placeholder="Nume Tema"><input name="probId" placeholder="ID Problema (din baza date)"><button>Adauga Tema</button></form>` : ""}
        <br><a href="/clase" style="color:white;">Inapoi la Clase</a>
    </body></html>`);
});

app.post('/clasa/:cod/material', async (req, res) => {
    await Clasa.updateOne({ cod: req.params.cod }, { $push: { materiale: req.body } });
    res.redirect('/clasa/' + req.params.cod);
});

app.post('/clasa/:cod/tema', async (req, res) => {
    await Clasa.updateOne({ cod: req.params.cod }, { $push: { teme: req.body } });
    res.redirect('/clasa/' + req.params.cod);
});

// --- 6. ARHIVA & MONITORIZARE PUBLICA (SHAREABLE) ---
app.get('/probleme', async (req, res) => {
    const lista = await Problema.find().sort({ nr: 1 });
    const categorii = [...new Set(lista.map(p => p.categorie))];
    res.send(`<html><head><link rel="stylesheet" href="/style.css">
    <script>
        function filter() {
            let t = document.getElementById('s').value.toLowerCase();
            let c = document.getElementById('c').value.toLowerCase();
            for (let card of document.getElementsByClassName('pc')) {
                let titlu = card.getAttribute('data-t').toLowerCase();
                let cat = card.getAttribute('data-c').toLowerCase();
                card.style.display = (titlu.includes(t) && (c === "" || cat === c)) ? "" : "none";
            }
        }
    </script></head>
    <body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <h1>Arhiva Probleme</h1>
            <a href="/monitor" style="background:#38bdf8;padding:12px;color:white;text-decoration:none;border-radius:5px;font-weight:bold;">📊 Monitorizare Publica</a>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;margin-bottom:20px;">
            <input id="s" onkeyup="filter()" placeholder="Cauta titlu..." style="flex:2;padding:10px;border-radius:5px;">
            <select id="c" onchange="filter()" style="flex:1;border-radius:5px;">
                <option value="">Toate Categoriile</option>${categorii.map(ct => `<option value="${ct}">${ct}</option>`).join('')}
            </select>
        </div>
        ${lista.map(p => `
            <div class="pc" data-t="${p.titlu}" data-c="${p.categorie}" style="background:#1e293b;padding:20px;border-radius:10px;margin-bottom:10px;display:flex;justify-content:space-between;border:1px solid #334155;">
                <div><b style="color:#38bdf8;">#${p.nr}</b> ${p.titlu} <span style="font-size:12px;color:#94a3b8;margin-left:10px;">[${p.categorie}]</span></div>
                <a href="/problema/${p._id}"><button style="cursor:pointer;background:#38bdf8;color:white;border:none;padding:8px 15px;border-radius:5px;">Rezolva</button></a>
            </div>`).join('')}
    </body></html>`);
});

app.get('/monitor', async (req, res) => {
    const subs = await Submission.find().sort({ data: -1 }).limit(40);
    let rows = subs.map(s => {
        let scCol = s.scor === 100 ? '#4ade80' : '#f87171';
        return `<tr style="border-bottom:1px solid #334155;text-align:center;">
            <td style="padding:10px;"><a href="/submission/${s._id}" style="color:#94a3b8;font-size:12px;">#${s._id.toString().slice(-6)}</a></td>
            <td style="padding:10px;font-weight:bold;">${s.username}</td>
            <td style="padding:10px;color:#38bdf8;">${s.problemaTitlu}</td>
            <td style="padding:10px;font-weight:bold;color:${scCol};">${s.scor}p</td>
            <td style="padding:10px;font-size:12px;color:#94a3b8;">${s.timp}ms / ${s.memorie}KB</td>
            <td style="padding:10px;color:#64748b;font-size:11px;">${s.data.toLocaleTimeString('ro-RO')}</td>
        </tr>`}).join('');
    res.send(`<html><body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;">
        <h1 style="text-align:center;color:#38bdf8;">🖥️ Monitorizare Solutii (Public)</h1>
        <table style="width:100%;max-width:900px;margin:0 auto;background:#1e293b;border-collapse:collapse;border-radius:10px;overflow:hidden;">
            <thead style="background:#334155;"><tr><th>ID</th><th>Utilizator</th><th>Problema</th><th>Scor</th><th>Resurse</th><th>Ora</th></tr></thead>
            <tbody>${rows}</tbody>
        </table><br><center><a href="/probleme" style="color:#38bdf8;">Inapoi la Arhiva</a></center></body></html>`);
});

// --- 7. VIZUALIZARE SUBMISIE (SHARE) ---
app.get('/submission/:id', async (req, res) => {
    const sub = await Submission.findById(req.params.id);
    res.send(`<html><head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.css">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/theme/nord.min.css">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/clike/clike.min.js"></script>
    </head>
    <body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;">
        <h2>Submisia #${sub._id}</h2>
        <p>Utilizator: <b>${sub.username}</b> | Problema: <b>${sub.problemaTitlu}</b> | Scor: <b style="color:#4ade80">${sub.scor}p</b></p>
        <hr><textarea id="viewCode">${sub.codSursa}</textarea>
        <script>CodeMirror.fromTextArea(document.getElementById("viewCode"), {lineNumbers:true, mode:"text/x-c++src", theme:"nord", readOnly:true}).setSize("100%","500px");</script>
        <br><center><a href="/monitor" style="color:#38bdf8;">Inapoi la Monitorizare</a></center>
    </body></html>`);
});

// --- 8. EVALUATOR PRO ---
app.get('/problema/:id', async (req, res) => {
    const p = await Problema.findById(req.params.id);
    res.send(`<html><head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.css">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/clike/clike.min.js"></script>
    </head>
    <body style="background:#0f172a;color:white;padding:40px;font-family:sans-serif;">
        <h2 style="color:#38bdf8;">#${p.nr} ${p.titlu}</h2>
        <div style="background:#1e293b;padding:25px;border-radius:10px;border-left:5px solid #38bdf8;margin-bottom:20px;">${p.cerinta}</div>
        <form action="/submit/${p._id}" method="POST">
            <textarea id="editor" name="cod"></textarea>
            <button type="submit" style="width:100%;margin-top:20px;background:#38bdf8;padding:15px;border:none;color:white;font-weight:bold;border-radius:8px;cursor:pointer;">Trimite Solutia</button>
        </form>
        <script>CodeMirror.fromTextArea(document.getElementById("editor"), {lineNumbers:true, mode:"text/x-c++src"}).setSize("100%", "450px");</script>
    </body></html>`);
});

app.post('/submit/:id', async (req, res) => {
    if (!req.session.user) return res.send("Logheaza-te!");
    const p = await Problema.findById(req.params.id);
    let score = 0, maxT = 0, maxM = 0;
    try {
        for (let t of p.teste) {
            const r = await axios.post('https://ce.judge0.com/submissions?base64_encoded=false&wait=true', {
                source_code: req.body.cod, language_id: 54, stdin: t.in, expected_output: t.out
            });
            if (r.data.status?.description === "Accepted") score += (100 / p.teste.length);
            maxT = Math.max(maxT, parseFloat(r.data.time || 0));
            maxM = Math.max(maxM, parseFloat(r.data.memory || 0));
        }
        let final = Math.round(score);
        await new Submission({ 
            username: req.session.user, 
            problemaId: p._id, 
            problemaTitlu: p.titlu, 
            scor: final, 
            timp: (maxT * 1000).toFixed(0), 
            memorie: maxM.toFixed(0), 
            codDimensiune: Buffer.byteLength(req.body.cod),
            codSursa: req.body.cod 
        }).save();
        
        const u = await User.findOne({ username: req.session.user });
        let v = u.rezolvate.get(p._id.toString()) || 0;
        if(final > v) { u.score += (final-v); u.rezolvate.set(p._id.toString(), final); await u.save(); }
        res.redirect('/monitor');
    } catch(e) { res.send("Eroare evaluare."); }
});

// --- 9. ADMIN & CLASAMENT ---
app.post('/adauga-problema', async (req, res) => {
    if (req.body.parola !== "admin123") return res.send("Gresit!");
    const count = await Problema.countDocuments();
    const { titlu, dificultate, categorie, cerinta, teste_raw } = req.body;
    let teste = teste_raw.split(',').map(p => { let parts = p.split('|'); return { in: parts[0].trim(), out: parts[1].trim() }; });
    await new Problema({ nr: count + 1, titlu, dificultate, categorie, cerinta, teste }).save();
    res.redirect('/admin-secret');
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server on port ${PORT}`));
