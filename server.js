const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./falcizade.db");

const express = require("express");
const cors = require("cors");
require("dotenv").config();
const OpenAI = require("openai");
const crypto = require("crypto");

process.on("uncaughtException", err => {
console.error("UNCAUGHT ERROR:", err);
});

process.on("unhandledRejection", err => {
console.error("PROMISE ERROR:", err);
});

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static(__dirname));

/* ANA SAYFA */

app.get("/", (req, res) => {
res.send("Falcızade AI Server Çalışıyor");
});

/* SERVER HEALTH */

app.get("/health",(req,res)=>{
res.json({status:"ok"});
});

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY
});


/* STORY PARÇALAMA */

function splitFalStory(text){

const parts = text.split(". ");

let stories = [];
let temp = "";

for(let i=0;i<parts.length;i++){

temp += parts[i] + ". ";

if(temp.length > 120){
stories.push(temp);
temp="";
}

}

if(temp.length>0){
stories.push(temp);
}

return stories;

}


/* DATABASE */

db.serialize(()=>{

db.run(`
CREATE TABLE IF NOT EXISTS users(
id INTEGER PRIMARY KEY AUTOINCREMENT,
email TEXT UNIQUE,
password TEXT,
gender TEXT,
premium INTEGER DEFAULT 0,
daily_fal INTEGER DEFAULT 0,
reward_fal INTEGER DEFAULT 0,
last_fal_date TEXT
)
`);

try{
db.run(`ALTER TABLE users ADD COLUMN premium_plan TEXT`);
}catch(e){}

try{
db.run(`ALTER TABLE users ADD COLUMN premium_expire INTEGER`);
}catch(e){}

db.run(`
CREATE TABLE IF NOT EXISTS fortunes(
id INTEGER PRIMARY KEY AUTOINCREMENT,
user TEXT,
fortune TEXT,
image_hash TEXT,
date TEXT
)
`);

});

/* FAL ANALİZ */

app.post("/fal", async(req,res)=>{

try{

const image=req.body.image;
const user=req.body.user || "guest";

if(!image){
return res.json({
fortune:"Resim bulunamadı"
});
}

db.get(
"SELECT premium_expire FROM users WHERE email=?",
[user],
async (err,row)=>{

let isPremium=false;

if(row && row.premium_expire > Date.now()){
isPremium=true;
}

if(isPremium){
console.log("Premium kullanıcı - reklam yok");
}else{
console.log("Normal kullanıcı - reklam var");
}

/* HASH */

const hash = crypto
.createHash("md5")
.update(image)
.digest("hex");

/* CACHE */

db.get(
"SELECT fortune FROM fortunes WHERE image_hash=?",
[hash],
async (err,row)=>{

if(row){

return res.json({
fortune:row.fortune,
cached:true
});

}

try{

const response = await openai.responses.create({

model:"gpt-4o-mini",

input:[{
role:"user",
content:[
{
type:"input_text",
text:`
Bu kahve fincanındaki telve şekillerini incele.

Gerçek bir Türk kahvesi falcısı gibi yorum yap.

### Aşk
...

### Para
...

### Yol
...

### Haber
...

### Genel Yorum
...
`
},
{
type:"input_image",
image_url:image
}
]
}]

});

let fortuneText="Fal oluşturulamadı.";

if(response.output && response.output[0] && response.output[0].content){
fortuneText=response.output[0].content[0].text;
}

const date=new Date().toISOString();

db.run(
"INSERT INTO fortunes (user,fortune,image_hash,date) VALUES (?,?,?,?)",
[user,fortuneText,hash,date]
);

const stories = splitFalStory(fortuneText);

res.json({
fortune:fortuneText,
stories:stories,
cached:false
});

}

catch(e){

console.log("AI ERROR:",e);

res.json({
fortune:"Fal analiz edilirken hata oluştu"
});

}

});

});

/* FAL GEÇMİŞİ */

app.get("/history",(req,res)=>{

const email = req.query.email || "guest";

db.all(
"SELECT * FROM fortunes WHERE user=? ORDER BY id DESC LIMIT 20",
[email],
(err,rows)=>{

if(err){
return res.json([]);
}

res.json(rows);

});

});


/* LOGIN */

app.post("/login",(req,res)=>{

const {email,password}=req.body;

db.get(
"SELECT * FROM users WHERE email=? AND password=?",
[email,password],
(err,user)=>{

if(!user){
return res.json({success:false});
}

res.json({
success:true,
user:{
email:user.email,
gender:user.gender,
premium:user.premium
}
});

});

});


/* REGISTER */

app.post("/register",(req,res)=>{

const {email,password,gender}=req.body;

db.run(
"INSERT INTO users(email,password,gender) VALUES(?,?,?)",
[email,password,gender],
function(err){

if(err){
return res.json({success:false});
}

res.json({success:true});

});

});


/* PREMIUM */

/* SERVER */

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
console.log("Server running on port " + PORT);
});

app.post("/buy-premium",(req,res)=>{

const {email,plan}=req.body;

let days=0;

if(plan==="weekly") days=7;
if(plan==="monthly") days=30;
if(plan==="yearly") days=365;

const expire = Date.now() + days*24*60*60*1000;

db.run(
"UPDATE users SET premium_plan=?, premium_expire=? WHERE email=?",
[plan,expire,email]
);

res.json({status:"premium activated"});

});