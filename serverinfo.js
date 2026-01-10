const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const app = express();

// Setari Server
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'secret-info-fotoliu',
    resave: false,
    saveUninitialized: true
}));

const PATH_PROBLEME = path.join(__dirname, 'probleme.json');
const PATH_USERS = path.join(__dirname, 'utilizatori.json');

// Functie citire DB (curata caractere invizibile BOM)
const readDB = (p) => {
    if (!fs.existsSync(p)) return [];
    try {
        let content = fs.readFileSync(p, 'utf8');
        content = content.replace(/^\uFEFF/, '').trim(); 
        return JSON.parse(content || '[]');
    } catch (e) { return []; }
};

const writeDB = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));

// --- RUTE NAVIGARE ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'indexrizz.html')));
app.get('/admin-secret', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// --- AUTENTIFICARE ---
app.post('/auth/register', (req, res) => {
    const { username, password } = req.body;
    let users = readDB(PATH_USERS);
    if (users.find(u => u.username === username)) return res.send("Nume ocupat!");
    // Adaugam obiectul 'rezolvate' pentru a tine evidenta scorurilor per problema
    users.push({ username, password, score: 0, rezolvate: {} });
    writeDB(PATH_USERS, users);
    res.redirect('/login.html');
});

app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    const users = readDB(PATH_USERS);
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        req.session.user = user.username;
        res.redirect('/');
    } else { res.send("Date gresite! <a href='/login.html'>Inapoi</a>"); }
});

// --- AFISARE PROBLEME ---
app.get('/probleme', (req, res) => {
    const lista = readDB(PATH_PROBLEME);
    let html = `<html><head><link rel="stylesheet" href="style.css"></head><body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;">`;
    html += `<h1>Arhiva Probleme</h1><a href="/" style="color:#38bdf8;text-decoration:none;"><- Acasa</a><br><br>`;
    lista.forEach((p, i) => {
        html += `<div style="background:#1e293b;padding:20px;border-radius:10px;margin-bottom:10px;border:1px solid #333;">
            <h3>${p.titlu} (${p.dificultate})</h3>
            <a href="/problema/${i}"><button class="btn-primary">Rezolva</button></a>
        </div>`;
    });
    res.send(html + "</body></html>");
});

app.get('/problema/:id', (req, res) => {
    if (!req.session.user) return res.send("Trebuie sa fii logat! <a href='/login.html'>Login</a>");
    const p = readDB(PATH_PROBLEME)[req.params.id];
    if (!p) return res.send("Problema nu exista.");
    res.send(`<html><head><link rel="stylesheet" href="/style.css"></head><body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;">
        <h1>${p.titlu}</h1>
        <div style="background:#1e293b;padding:20px;border-radius:10px;line-height:1.6;">${p.cerinta}</div>
        <form action="/submit/${req.params.id}" method="POST">
            <textarea name="cod" rows="15" style="width:100%;background:#011627;color:white;padding:15px;margin-top:20px;font-family:monospace;" placeholder="Scrie codul C++ aici..."></textarea>
            <button type="submit" class="btn-primary" style="width:100%;margin-top:10px;cursor:pointer;">Trimite Solutia</button>
        </form>
        <br><a href="/probleme" style="color:#38bdf8">Inapoi la lista</a></body></html>`);
});

// --- EVALUATOR SI PUNCTAJ (ANTI-CHEAT) ---
app.post('/submit/:id', async (req, res) => {
    if (!req.session.user) return res.send("Sesiune expirata.");
    const pId = req.params.id;
    const p = readDB(PATH_PROBLEME)[pId];
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

            if (r.data.status.description === "Accepted" || outReal === outAsteptat) {
                punctajDobandit += (100 / p.teste.length);
                feedback += `<p style="color:#4ade80">Test ${i+1}: Corect ?</p>`;
            } else {
                feedback += `<p style="color:#f87171">Test ${i+1}: ${r.data.status.description} ?</p>`;
            }
        }

        let scorFinal = Math.round(punctajDobandit);
        let users = readDB(PATH_USERS);
        let uIdx = users.findIndex(u => u.username === req.session.user);

        if (uIdx !== -1) {
            if (!users[uIdx].rezolvate) users[uIdx].rezolvate = {};
            let scorVechi = users[uIdx].rezolvate[pId] || 0;

            if (scorFinal > scorVechi) {
                users[uIdx].score += (scorFinal - scorVechi);
                users[uIdx].rezolvate[pId] = scorFinal;
                writeDB(PATH_USERS, users);
                feedback += `<h2 style="color:#38bdf8">Bravo! Scorul tau a crescut!</h2>`;
            } else {
                feedback += `<h2 style="color:#94a3b8">Ai mai rezolvat-o. Nu s-au adaugat puncte noi.</h2>`;
            }
        }
        res.send(`<body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;"><h1>Scor: ${scorFinal}p</h1>${feedback}<br><a href="/probleme" style="color:#38bdf8">Inapoi</a></body>`);
    } catch (e) { res.send("Eroare la evaluator."); }
});

// --- CLASAMENT ---
app.get('/clasament', (req, res) => {
    let users = readDB(PATH_USERS).sort((a,b) => b.score - a.score);
    let rows = users.map((u, i) => `<tr><td style="padding:10px;border:1px solid #333;">${i+1}</td><td style="padding:10px;border:1px solid #333;">${u.username}</td><td style="padding:10px;border:1px solid #333;">${u.score}p</td></tr>`).join('');
    res.send(`<html><head><link rel="stylesheet" href="style.css"></head><body style="background:#0f172a;color:white;padding:50px;font-family:sans-serif;">
        <h1 style="text-align:center">Top Programatori</h1>
        <table style="width:100%;background:#1e293b;border-collapse:collapse;text-align:center;">
            <tr style="background:#334155"><th>Loc</th><th>Nume</th><th>Punctaj Total</th></tr>
            ${rows}
        </table><br><center><a href="/" style="color:#38bdf8">Acasa</a></center></body></html>`);
});

// --- ADMIN (ADAUGARE SI STERGERE) ---
app.post('/adauga-problema', (req, res) => {
    const { parola, titlu, dificultate, cerinta, teste_raw } = req.body;
    if (parola !== "admin123") return res.send("Parola incorecta!");
    let teste = teste_raw.split(',').map(p => { 
        let parts = p.split('|'); 
        return { in: parts[0].trim(), out: parts[1].trim() }; 
    });
    let probs = readDB(PATH_PROBLEME);
    probs.push({ titlu, dificultate, cerinta, teste });
    writeDB(PATH_PROBLEME, probs);
    res.send("Problema adaugata! <a href='/admin-secret'>Inapoi</a>");
});

app.post('/sterge-problema', (req, res) => {
    const { parola, titlu } = req.body;
    if (parola !== "admin123") return res.send("Parola incorecta!");
    let probs = readDB(PATH_PROBLEME);
    let listaNoua = probs.filter(p => p.titlu !== titlu);
    writeDB(PATH_PROBLEME, listaNoua);
    res.send("Sters cu succes! <a href='/admin-secret'>Inapoi</a>");
});

app.listen(3000, () => console.log("?? Server pornit pe http://localhost:3000"));