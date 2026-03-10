const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URL);

mongoose.connection.on("connected", () => {
  console.log("MongoDB bağlandı");
});

const User = mongoose.model("User", {

  userId: String,

  falHak: {
    type: Number,
    default: 1
  },

  lastReset: String,

  premium: {
    type: Boolean,
    default: false
  },

adWatchCount:{
  type:Number,
  default:0
},

  falGecmisi: [
    {
      fortune: String,
      date: String
    }
  ]

});

mongoose.connection.on("error", (err) => {
  console.log("MongoDB hata:", err);
});

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
app.use(express.static(__dirname));
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

async function checkFalHak(userId){

let user = await User.findOne({userId:userId});

const todayDate = today();

if(!user){

user = new User({
userId:userId,
falHak:1,
lastReset:todayDate
});

await user.save();

return user;

}

if(user.lastReset !== todayDate){

user.falHak = 1;
user.lastReset = todayDate;
user.adWatchCount = 0;

await user.save();

}

return user;

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
res.sendFile(__dirname + "/index.html");
});

app.get("/health",(req,res)=>{
res.json({status:"ok"});
});

/* ---------------- FAL ANALİZ ---------------- */

app.post("/fal", async(req,res)=>{

try{

const image=req.body.image;
const userId = req.body.user || "guest";

const user = await checkFalHak(userId);

if(!image){
return res.json({fortune:"Resim bulunamadı"});
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

if(!user.premium && user.falHak <= 0){
return res.json({error:"FAL_HAKKI_BITTI"});
}

try{

const ai = await openai.responses.create({

model:"gpt-4o-mini",

max_output_tokens:200,

temperature:0.9,

input:[{
role:"user",
content:[
{
type:"input_text",
text:`
Bu kahve fincanındaki telve şekillerini incele.

Kullanıcıya özel bir Türk kahvesi falı yaz.

Gerçek bir falcı gibi konuş.

Fal yorumunu gizemli ve merak uyandırıcı yap.

Kullanıcıya doğrudan hitap et.

Falcı dili kullan.

Yorumları aşağıdaki başlıklarla yaz:

### Aşk
Aşk hayatı hakkında yorum yap.

### Para
Para ve iş hayatı hakkında yorum yap.

### Yol
Yakın zamanda yol veya değişim olup olmadığını anlat.

### Haber
Yakında gelecek bir haberden bahset.

### Genel Yorum
Genel enerji ve gelecek hakkında yorum yap.

Falın uzun, akıcı ve detaylı olsun.
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
[userId,fortune,hash,new Date().toISOString()]
);

// MongoDB'ye fal kaydet

let userDoc = await User.findOne({userId:userId});

if(!userDoc){

userDoc = new User({
userId:userId,
falGecmisi:[]
});

}

userDoc.falGecmisi.unshift({
fortune: fortune,
date: new Date().toISOString()
});

await userDoc.save();

if(!user.premium){
user.falHak--;
await user.save();
}

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

app.get("/history", async (req,res)=>{

const user = req.query.user;

const userDoc = await User.findOne({userId:user});

if(!userDoc){

return res.json([]);

}

res.json(userDoc.falGecmisi.slice(0,20));

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

app.post("/reward-ad",async(req,res)=>{

const userId = req.body.user;

let user = await User.findOne({userId:userId});

if(!user){
return res.json({error:"USER_NOT_FOUND"});
}

if(user.adWatchCount >= 6){
return res.json({error:"REKLAM_LIMIT"});
}

user.falHak++;
user.adWatchCount++;

await user.save();

res.json({success:true});

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