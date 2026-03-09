const express = require("express");
const cors = require("cors");
require("dotenv").config();
const OpenAI = require("openai");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");
const multer = require("multer");
const fs = require("fs");
const cron = require("node-cron");

const app = express();

app.use(cors());
app.use(express.json({limit:"50mb"}));
app.use(express.urlencoded({limit:"50mb",extended:true}));

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY
});

const db = new sqlite3.Database("./falcizade.db");

const upload = multer({dest:"uploads/"});

/* ---------------- DATABASE ---------------- */

db.serialize(()=>{

db.run(`
CREATE TABLE IF NOT EXISTS users(
id INTEGER PRIMARY KEY AUTOINCREMENT,
email TEXT UNIQUE,
password TEXT,
gender TEXT,
premium INTEGER DEFAULT 0,
premium_plan TEXT,
premium_expire INTEGER
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS fortunes(
id INTEGER PRIMARY KEY AUTOINCREMENT,
user TEXT,
fortune TEXT,
image_hash TEXT,
date TEXT
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS fal_rights(
user_id TEXT,
date TEXT,
free_rights INTEGER DEFAULT 1,
ad_rights INTEGER DEFAULT 0,
PRIMARY KEY(user_id,date)
)
`);

});

/* ---------------- HELPER ---------------- */

function today(){
return new Date().toISOString().split("T")[0];
}

function checkFalRights(user){

return new Promise((resolve,reject)=>{

db.get(
"SELECT * FROM fal_rights WHERE user_id=? AND date=?",
[user,today()],
(err,row)=>{

if(err) return reject(err);

if(!row){

db.run(
"INSERT INTO fal_rights(user_id,date,free_rights,ad_rights) VALUES(?,?,1,0)",
[user,today()]
);

resolve({free:1,ad:0});

}else{

resolve({
free:row.free_rights,
ad:row.ad_rights
});

}

});

});

}

function useFalRight(user){

db.get(
"SELECT * FROM fal_rights WHERE user_id=? AND date=?",
[user,today()],
(err,row)=>{

if(!row) return;

if(row.free_rights>0){

db.run(
"UPDATE fal_rights SET free_rights=free_rights-1 WHERE user_id=? AND date=?",
[user,today()]
);

}else if(row.ad_rights>0){

db.run(
"UPDATE fal_rights SET ad_rights=ad_rights-1 WHERE user_id=? AND date=?",
[user,today()]
);

}

});

}

/* ---------------- ROOT ---------------- */

app.get("/",(req,res)=>{
res.send("Falcizade server running");
});

app.get("/health",(req,res)=>{
res.json({status:"ok"});
});

/* ---------------- FAL ANALİZ ---------------- */

app.post("/fal", async(req,res)=>{

try{

const image=req.body.image;
const user=req.body.user || "guest";

if(!image){
return res.json({fortune:"Resim bulunamadı"});
}

const rights = await checkFalRights(user);

if(rights.free + rights.ad <=0){

return res.json({
error:"FAL_HAKKI_BITTI"
});

}

const hash = crypto
.createHash("md5")
.update(image)
.digest("hex");

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

const ai = await openai.responses.create({

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
### Para
### Yol
### Haber
### Genel Yorum
`
},
{
type:"input_image",
image_url:image
}
]
}]
});

let fortune="Fal oluşturulamadı";

if(ai.output && ai.output[0].content){
fortune=ai.output[0].content[0].text;
}

db.run(
"INSERT INTO fortunes(user,fortune,image_hash,date) VALUES(?,?,?,?)",
[user,fortune,hash,new Date().toISOString()]
);

useFalRight(user);

res.json({
fortune:fortune,
cached:false
});

}catch(e){

console.log(e);

res.json({
fortune:"AI hata verdi"
});

}

});

}catch(err){

console.log(err);

res.json({
fortune:"Server hatası"
});

}

});

/* ---------------- FOTOĞRAF UPLOAD ---------------- */

app.post("/upload-fal",upload.single("photo"),async(req,res)=>{

try{

const buffer = fs.readFileSync(req.file.path);

const base64 =
"data:image/jpeg;base64,"+
buffer.toString("base64");

fs.unlinkSync(req.file.path);

res.json({image:base64});

}catch(err){

res.json({
error:"upload error"
});

}

});

/* ---------------- HISTORY ---------------- */

app.get("/history",(req,res)=>{

const email=req.query.email || "guest";

db.all(
"SELECT * FROM fortunes WHERE user=? ORDER BY id DESC LIMIT 20",
[email],
(err,rows)=>{

if(err) return res.json([]);

res.json(rows);

});

});

/* ---------------- LOGIN ---------------- */

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
user:user
});

});

});

/* ---------------- REGISTER ---------------- */

app.post("/register",(req,res)=>{

const {email,password,gender}=req.body;

db.run(
"INSERT INTO users(email,password,gender) VALUES(?,?,?)",
[email,password,gender],
function(err){

if(err) return res.json({success:false});

res.json({success:true});

});

});

/* ---------------- PREMIUM ---------------- */

app.post("/buy-premium",(req,res)=>{

const {email,plan}=req.body;

let days=0;

if(plan==="weekly") days=7;
if(plan==="monthly") days=30;
if(plan==="yearly") days=365;

const expire=Date.now()+days*86400000;

db.run(
"UPDATE users SET premium_plan=?,premium_expire=? WHERE email=?",
[plan,expire,email]
);

res.json({success:true});

});

/* ---------------- REWARD AD ---------------- */

app.post("/reward-ad",(req,res)=>{

const user=req.body.user;

db.get(
"SELECT * FROM fal_rights WHERE user_id=? AND date=?",
[user,today()],
(err,row)=>{

if(row && row.ad_rights>=6){
return res.json({error:"REKLAM_LIMIT"});
}

if(!row){

db.run(
"INSERT INTO fal_rights(user_id,date,free_rights,ad_rights) VALUES(?,?,0,1)",
[user,today()]
);

}else{

db.run(
"UPDATE fal_rights SET ad_rights=ad_rights+1 WHERE user_id=? AND date=?",
[user,today()]
);

}

res.json({success:true});

});

});

/* ---------------- NOTIFICATION ---------------- */

function sendNotificationToAll(title,body){
console.log("Notification disabled");
}

cron.schedule("0 12 * * *",()=>{

sendNotificationToAll(
"🔮 Falın seni bekliyor",
"Fincanını çevir"
);

},{timezone:"Europe/Istanbul"});

cron.schedule("0 20 * * *",()=>{

sendNotificationToAll(
"☕ Fal vakti",
"Falına bakmayı unutma"
);

},{timezone:"Europe/Istanbul"});

/* ---------------- SERVER ---------------- */

const PORT=process.env.PORT || 3000;

app.listen(PORT,"0.0.0.0",()=>{

console.log("Server running on port "+PORT);

});