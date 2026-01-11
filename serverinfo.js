const express = require('express');
const axios = require('axios');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

const PORT = process.env.PORT || 10000;

// --- 1. CONECTARE BAZĂ DE DATE (MONGODB) ---
const MONGO_URI = "mongodb+srv://gheorghitadavid_db_user:P)a1s2s2@cluster0.dun9hav.mongodb.net/?appName=Cluster0";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Conectat la MongoDB Atlas"))
    .catch(err => console.error("❌ Eroare conexiune DB:", err));

// --- 2. SCHEME DE DATE (MODELE) ---
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: { type: String },
    score: { type: Number, default: 0 },
    avatar: { type: String, default: "https://i.imgur.com/6VBx3io.png" },
    rezolvate: { type: Map, of: Number, default: {} }, // ID Problema -> Scor
    friends: [String],
    claseInrolate: [String], // Codurile claselor
    lastActive: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const CapitolSchema = new mongoose.Schema({ nume: { type: String, unique: true } });
const Capitol = mongoose.model('Capitol', CapitolSchema);

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
    codSursa: String, 
    data: { type: Date, default: Date.now }
});
const Submission = mongoose.model('Submission', SubmissionSchema);

const MessageSchema = new mongoose.Schema({
    from: String, to: String, text: String, data: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// --- 3. CONFIGURĂRI SERVER ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'rizz-god-mode', resave: false, saveUninitialized: true, cookie: { secure: false } }));

// Middleware: Actualizează statusul "Online" la fiecare click
app.use(async (req, res, next) => {
    if (req.session.user) { 
        await User.updateOne({ username: req.session.user }, { lastActive: new Date() }); 
    }
    next();
});

// --- HELPER PENTRU DESIGN HTML (HEADER + FOOTER) ---
const renderPage = (title, content, user) => `
<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | Info Rizz</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/theme/nord.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/clike/clike.min.js"></script>
</head>
<body>
    <header>
        <div class="logo-text">INFO<span style="color:#38bdf8">RIZZ</span></div>
        <nav>
            <a href="/probleme"><i class="fas fa-code"></i> Probleme</a>
            <a href="/submisii"><i class="fas fa-list"></i> Submisii</a>
            <a href="/clase"><i class="fas fa-chalkboard-teacher"></i> Clase</a>
            <a href="/prieteni"><i class="fas fa-user-friends"></i> Prieteni</a>
            <a href="/clasament"><i class="fas fa-trophy"></i> Clasament</a>
            ${user ? `<a href="/profil" class="btn-nav profile-btn"><i class="fas fa-user"></i> ${user}</a>` : `<a href="/login.html" class="btn-nav">Login</a>`}
        </nav>
    </header>
    <div class="main-container">
        ${content}
    </div>
    <footer>
        <div class="contact-box">
            📢 Pentru sugestii contactați adresa de email: <br>
            <a href="mailto:gheorghita.david@ichb.ro" class="email-link">gheorghita.david@ichb.ro</a>
        </div>
    </footer>
</body>
</html>`;

// --- 4. RUTE PAGINI PRINCIPALE ---

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'indexrizz.html')));

// --- RUTE AUTH ---
app.post('/auth/register', async (req, res) => {
    try { await new User({ username: req.body.username, password: req.body.password }).save(); res.redirect('/login.html'); }
    catch (e) { res.send("Nume ocupat!"); }
});

app.post('/auth/login', async (req, res) => {
    const user = await User.findOne({ username: req.body.username, password: req.body.password });
    if (user) { req.session.user = user.username; res.redirect('/'); }
    else res.send("Date gresite! <a href='/login.html'>Inapoi</a>");
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- RUTE ARHIVĂ PROBLEME (CU CAPITOLE & SEARCH) ---
app.get('/probleme', async (req, res) => {
    const lista = await Problema.find().sort({ nr: 1 });
    const caps = await Capitol.find();
    
    let htmlContent = `
    <h1 class="page-title">📚 Arhivă Probleme</h1>
    <div class="search-bar">
        <input type="text" id="searchIn" onkeyup="filterProbs()" placeholder="Caută o problemă...">
        <select id="catIn" onchange="filterProbs()">
            <option value="">Toate Capitolele</option>
            ${caps.map(c => `<option value="${c.nume}">${c.nume}</option>`).join('')}
        </select>
    </div>
    <script>
        function filterProbs() {
            let t = document.getElementById('searchIn').value.toLowerCase();
            let c = document.getElementById('catIn').value;
            for (let el of document.getElementsByClassName('prob-card')) {
                let title = el.getAttribute('data-t').toLowerCase();
                let cat = el.getAttribute('data-c');
                el.style.display = (title.includes(t) && (c === "" || cat === c)) ? "flex" : "none";
            }
        }
    </script>
    <div id="prob-list">
        ${lista.map(p => {
            let color = p.dificultate.toLowerCase().includes('concurs') ? '#38bdf8' : 
                        (p.dificultate.toLowerCase().includes('ușor') ? '#4ade80' : '#f87171');
            return `
            <div class="prob-card" data-t="${p.titlu}" data-c="${p.categorie}">
                <div class="prob-info">
                    <span class="prob-nr">#${p.nr}</span>
                    <h3>${p.titlu}</h3>
                    <span class="badge" style="border-color:${color}; color:${color}">${p.dificultate}</span>
                    <span class="cat-tag">${p.categorie}</span>
                </div>
                <a href="/problema/${p._id}" class="btn-action">Rezolvă</a>
            </div>`;
        }).join('')}
    </div>`;
    
    res.send(renderPage("Probleme", htmlContent, req.session.user));
});

// --- RUTE SUBMISII (PUBLIC + SHARE) ---
app.get('/submisii', async (req, res) => {
    const subs = await Submission.find().sort({ data: -1 }).limit(40);
    let rows = subs.map(s => {
        let scoreColor = s.scor === 100 ? '#4ade80' : '#f87171';
        return `<tr>
            <td><a href="/submission/${s._id}" class="share-link">#${s._id.toString().slice(-6)}</a></td>
            <td><b>${s.username}</b></td>
            <td>${s.problemaTitlu}</td>
            <td style="color:${scoreColor}; font-weight:bold;">${s.scor}p</td>
            <td>${s.timp}ms / ${s.memorie}KB</td>
            <td style="font-size:0.8rem; color:#94a3b8;">${s.data.toLocaleString('ro-RO')}</td>
        </tr>`;
    }).join('');
    
    res.send(renderPage("Submisii", `
        <h1 class="page-title">📊 Submisii Recente</h1>
        <div class="table-container">
            <table><thead><tr><th>ID (Share)</th><th>User</th><th>Problemă</th><th>Scor</th><th>Resurse</th><th>Dată</th></tr></thead><tbody>${rows}</tbody></table>
        </div>
    `, req.session.user));
});

app.get('/submission/:id', async (req, res) => {
    try {
        const sub = await Submission.findById(req.params.id);
        res.send(renderPage("Vizualizare Cod", `
            <div class="card centered-card">
                <h2>Soluția lui ${sub.username} <button class="btn-copy" onclick="copyLink()">🔗 Share</button></h2>
                <p>Problemă: ${sub.problemaTitlu} | Scor: ${sub.scor}p</p>
                <textarea id="codeView">${sub.codSursa}</textarea>
            </div>
            <script>
                CodeMirror.fromTextArea(document.getElementById("codeView"), {lineNumbers:true, mode:"text/x-c++src", theme:"nord", readOnly:true}).setSize("100%","500px");
                function copyLink() { navigator.clipboard.writeText(window.location.href); alert("Link copiat!"); }
            </script>
        `, req.session.user));
    } catch(e) { res.send("Nu există."); }
});

// --- RUTE CLASE (PROFESOR & ELEV) ---
app.get('/clase', async (req, res) => {
    if (!req.session.user) return res.redirect('/login.html');
    const u = await User.findOne({ username: req.session.user });
    const cIn = await Clasa.find({ cod: { $in: u.claseInrolate } });
    const cMine = await Clasa.find({ creator: req.session.user });

    let html = `
    <h1 class="page-title">🏫 Clase & Teme</h1>
    <div class="grid-2">
        <div class="card">
            <h2 style="color:#fbbf24">👩‍🏫 Profesor (Creează)</h2>
            <form action="/creeaza-clasa" method="POST">
                <input name="nume" placeholder="Nume Clasă" required>
                <input name="cod" placeholder="Cod Unic" required>
                <input name="parolaClasa" placeholder="Parolă Acces" required>
                <button class="btn-action full-width">Creează Clasă</button>
            </form>
            <hr>
            <h3>Clasele tale:</h3>
            ${cMine.map(c => `<div class="mini-item"><a href="/clasa/${c.cod}">${c.nume}</a> <small>(Cod: ${c.cod})</small></div>`).join('')}
        </div>
        <div class="card">
            <h2 style="color:#4ade80">👨‍🎓 Elev (Înscrie-te)</h2>
            <form action="/inscrie-clasa" method="POST">
                <input name="cod" placeholder="Codul Clasei" required>
                <input name="parolaClasa" placeholder="Parola Clasei" required>
                <button class="btn-action full-width" style="background:#4ade80">Înscrie-te</button>
            </form>
            <hr>
            <h3>Clasele tale:</h3>
            ${cIn.map(c => `<div class="mini-item"><a href="/clasa/${c.cod}">${c.nume}</a></div>`).join('')}
        </div>
    </div>`;
    res.send(renderPage("Clase", html, req.session.user));
});

app.post('/creeaza-clasa', async (req, res) => {
    await new Clasa({ ...req.body, creator: req.session.user }).save();
    res.redirect('/clase');
});
app.post('/inscrie-clasa', async (req, res) => {
    const c = await Clasa.findOne({ cod: req.body.cod, parolaClasa: req.body.parolaClasa });
    if (c) await User.updateOne({ username: req.session.user }, { $addToSet: { claseInrolate: req.body.cod } });
    res.redirect('/clase');
});

app.get('/clasa/:cod', async (req, res) => {
    const c = await Clasa.findOne({ cod: req.params.cod });
    const isProf = c.creator === req.session.user;
    let html = `<h1>Clasa: ${c.nume}</h1>
    <div class="grid-2">
        <div><h3>📚 Materiale</h3>${c.materiale.map(m => `<div class="item-card"><b>${m.titlu}</b><p>${m.continut}</p></div>`).join('')}</div>
        <div><h3>📝 Teme</h3>${c.teme.map(t => `<div class="item-card"><b>${t.titlu}</b><br><a href="/problema/${t.problemaId}" class="link-btn">Rezolvă</a></div>`).join('')}</div>
    </div>`;
    
    if (isProf) {
        html += `<hr><div class="card"><h3>Admin Clasă</h3>
        <form action="/clasa/${c.cod}/material" method="POST"><input name="titlu" placeholder="Titlu"><textarea name="continut" placeholder="Conținut"></textarea><button class="btn-action">Adaugă Material</button></form>
        <form action="/clasa/${c.cod}/tema" method="POST" style="margin-top:10px;"><input name="titlu" placeholder="Titlu Temă"><input name="probId" placeholder="ID Problemă (din DB)"><button class="btn-action">Adaugă Temă</button></form></div>`;
    }
    res.send(renderPage(c.nume, html, req.session.user));
});

app.post('/clasa/:cod/material', async (req, res) => {
    await Clasa.updateOne({ cod: req.params.cod }, { $push: { materiale: req.body } });
    res.redirect('/clasa/' + req.params.cod);
});
app.post('/clasa/:cod/tema', async (req, res) => {
    await Clasa.updateOne({ cod: req.params.cod }, { $push: { teme: { titlu: req.body.titlu, problemaId: req.body.probId } } });
    res.redirect('/clasa/' + req.params.cod);
});

// --- RUTE PRIETENI & CHAT ---
app.get('/prieteni', async (req, res) => {
    if (!req.session.user) return res.redirect('/login.html');
    const u = await User.findOne({ username: req.session.user });
    const list = await User.find({ username: { $in: u.friends } });
    let html = `<h1>👥 Prieteni</h1>
    <form action="/add-friend" method="POST" style="margin-bottom:20px;display:flex;gap:10px;"><input name="friendName" placeholder="Username..."><button class="btn-action">Adaugă</button></form>
    <div class="friends-list">
        ${list.map(f => {
            const online = (new Date() - f.lastActive) < 300000;
            return `<div class="friend-card" style="border-left:5px solid ${online?'#4ade80':'#f87171'}">
                <img src="${f.avatar}" class="avatar-small"> <b>${f.username}</b>
                <div class="actions"><span class="${online?'status-on':'status-off'}">● ${online?'Online':'Offline'}</span> <a href="/chat/${f.username}" class="btn-chat">Chat</a></div>
            </div>`;
        }).join('')}
    </div>`;
    res.send(renderPage("Prieteni", html, req.session.user));
});

app.post('/add-friend', async (req, res) => {
    await User.updateOne({ username: req.session.user }, { $addToSet: { friends: req.body.friendName } });
    res.redirect('/prieteni');
});

app.get('/chat/:friend', async (req, res) => {
    if (!req.session.user) return res.redirect('/login.html');
    const { user } = req.session;
    const { friend } = req.params;
    const msgs = await Message.find({ $or: [{from: user, to: friend}, {from: friend, to: user}] }).sort({data: 1});
    let html = `<h2 style="text-align:center">Chat cu ${friend}</h2>
    <div id="chat-box" style="height:400px;overflow-y:auto;background:#1e293b;padding:15px;border-radius:10px;margin-bottom:15px;">
        ${msgs.map(m => `<div style="text-align:${m.from===user?'right':'left'};margin:5px;"><span style="background:${m.from===user?'#38bdf8':'#334155'};padding:5px 10px;border-radius:10px;display:inline-block;">${m.text}</span></div>`).join('')}
    </div>
    <form action="/send-msg" method="POST" style="display:flex;gap:10px;"><input type="hidden" name="to" value="${friend}"><input name="text" placeholder="Mesaj..." required><button class="btn-action">Trimite</button></form>
    <script>document.getElementById('chat-box').scrollTop = document.getElementById('chat-box').scrollHeight;</script>`;
    res.send(renderPage("Chat", html, user));
});

app.post('/send-msg', async (req, res) => {
    await new Message({ from: req.session.user, to: req.body.to, text: req.body.text }).save();
    res.redirect('/chat/' + req.body.to);
});

// --- RUTE EVALUATOR & PROFIL ---
app.get('/problema/:id', async (req, res) => {
    if (!req.session.user) return res.send("Trebuie să fii logat!");
    try {
        const p = await Problema.findById(req.params.id);
        res.send(renderPage(p.titlu, `
            <h1>#${p.nr} ${p.titlu}</h1>
            <div class="problem-req">${p.cerinta}</div>
            <form action="/submit/${p._id}" method="POST">
                <h3>Cod C++:</h3>
                <textarea id="editor" name="cod"></textarea>
                <button class="btn-action full-width" style="margin-top:10px;">Trimite Soluția</button>
            </form>
            <script>CodeMirror.fromTextArea(document.getElementById("editor"), {lineNumbers:true, mode:"text/x-c++src", theme:"nord"}).setSize("100%","400px");</script>
        `, req.session.user));
    } catch(e) { res.send("Eroare ID"); }
});

app.post('/submit/:id', async (req, res) => {
    if (!req.session.user) return res.send("Sesiune expirată");
    const p = await Problema.findById(req.params.id);
    let score = 0, maxT = 0, maxM = 0;
    try {
        for (let t of p.teste) {
            const r = await axios.post('https://ce.judge0.com/submissions?base64_encoded=false&wait=true', {
                source_code: req.body.cod, language_id: 54, stdin: t.in, expected_output: t.out
            });
            if (r.data.status?.description === "Accepted") score += (100 / p.teste.length);
            maxT = Math.max(maxT, parseFloat(r.data.time||0)); maxM = Math.max(maxM, parseFloat(r.data.memory||0));
        }
        let final = Math.round(score);
        await new Submission({ username: req.session.user, problemaId: p._id, problemaTitlu: p.titlu, scor: final, timp: (maxT*1000).toFixed(0), memorie: maxM.toFixed(0), codSursa: req.body.cod, codDimensiune: Buffer.byteLength(req.body.cod) }).save();
        
        const u = await User.findOne({ username: req.session.user });
        let v = u.rezolvate.get(p._id.toString()) || 0;
        if(final > v) { u.score += (final-v); u.rezolvate.set(p._id.toString(), final); await u.save(); }
        res.redirect('/submisii');
    } catch(e) { res.send("Eroare Judge0"); }
});

app.get('/profil', async (req, res) => {
    if (!req.session.user) return res.redirect('/login.html');
    const u = await User.findOne({ username: req.session.user });
    res.send(renderPage("Profil", `
        <div class="card centered">
            <img src="${u.avatar}" class="profile-pic">
            <h1>${u.username}</h1>
            <h2 style="color:#4ade80">${u.score} puncte</h2>
            <form action="/update-avatar" method="POST" style="margin-top:20px;">
                <input name="avatarUrl" placeholder="URL Imagine...">
                <button class="btn-action">Schimbă Avatar</button>
            </form>
        </div>
    `, u.username));
});
app.post('/update-avatar', async (req, res) => {
    await User.updateOne({ username: req.session.user }, { avatar: req.body.avatarUrl });
    res.redirect('/profil');
});

// --- CLASAMENT & ADMIN ---
app.get('/clasament', async (req, res) => {
    const users = await User.find().sort({ score: -1 });
    let rows = users.map((u, i) => `<tr><td>${i+1}</td><td><img src="${u.avatar}" class="avatar-tiny"> ${u.username}</td><td><b style="color:#4ade80">${u.score}p</b></td></tr>`).join('');
    res.send(renderPage("Clasament", `<h1>🏆 Top Elevi</h1><table><thead><tr><th>Loc</th><th>User</th><th>Scor</th></tr></thead><tbody>${rows}</tbody></table>`, req.session.user));
});

app.post('/adauga-problema', async (req, res) => {
    if (req.body.parola !== "admin123") return res.send("Gresit");
    const count = await Problema.countDocuments();
    let teste = req.body.teste_raw.split(',').map(t => { let p = t.split('|'); return { in: p[0].trim(), out: p[1].trim() }; });
    await new Problema({ nr: count+1, titlu: req.body.titlu, dificultate: req.body.dificultate, categorie: req.body.categorie, cerinta: req.body.cerinta, teste }).save();
    res.redirect('/admin-secret');
});

app.post('/admin/adauga-capitol', async (req, res) => {
    await new Capitol({ nume: req.body.numeCapitol }).save();
    res.redirect('/admin-secret');
});

app.get('/admin-secret', async (req, res) => {
    const caps = await Capitol.find();
    res.send(renderPage("Admin", `
        <h1>⚙️ Panou Admin</h1>
        <div class="grid-2">
            <div class="card">
                <h3>Adaugă Capitol</h3>
                <form action="/admin/adauga-capitol" method="POST"><input name="numeCapitol" placeholder="Nume"><button class="btn-action">Creează</button></form>
            </div>
            <div class="card">
                <h3>Adaugă Problemă</h3>
                <form action="/adauga-problema" method="POST">
                    <input name="parola" type="password" placeholder="Parola">
                    <input name="titlu" placeholder="Titlu">
                    <input name="dificultate" placeholder="Dificultate (ex: Concurs)">
                    <select name="categorie">${caps.map(c => `<option value="${c.nume}">${c.nume}</option>`).join('')}</select>
                    <textarea name="cerinta" placeholder="Cerința..."></textarea>
                    <input name="teste_raw" placeholder="in|out, in|out">
                    <button class="btn-action full-width">Publică</button>
                </form>
            </div>
        </div>
    `, "ADMIN"));
});

app.listen(PORT, '0.0.0.0', () => console.log("🚀 Server Ready!"));
