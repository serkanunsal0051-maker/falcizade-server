/* ----------------------- */
/* GÜNLÜK SİSTEM */
/* ----------------------- */

const today = new Date().toDateString();

let userId = localStorage.getItem("userId") || null;

/* ANDROID USER_ID GELENE KADAR BEKLE */

function syncAndroidUser(){

if(window.USER_ID){

userId = window.USER_ID;

localStorage.setItem("userId",userId);

console.log("Android USER_ID synced:",userId);

}else{

setTimeout(syncAndroidUser,200);

}

}

syncAndroidUser();
function checkDailyFal(){

let lastDate = localStorage.getItem("falDate");

if(lastDate !== today){

localStorage.setItem("falDate",today);
localStorage.setItem("falHak",1);

}

}

function updateFalHakUI(){

let falHak = parseInt(localStorage.getItem("falHak")) || 0;

const el = document.getElementById("falHak");

if(el) el.innerText = falHak;

}

/* ----------------------- */
/* REKLAM SAYACI */
/* ----------------------- */

function getAdData(){

let adData = JSON.parse(localStorage.getItem("adData"));

if(!adData){

adData = {date:today,count:0};

}

if(adData.date !== today){

adData.date = today;
adData.count = 0;

}

localStorage.setItem("adData",JSON.stringify(adData));

return adData;

}

/* ----------------------- */
/* PAYLAŞIM SAYACI */
/* ----------------------- */

function getShareData(){

let share = JSON.parse(localStorage.getItem("shareData"));

if(!share){

share = {date:today,count:0};

}

if(share.date !== today){

share.date = today;
share.count = 0;

}

localStorage.setItem("shareData",JSON.stringify(share));

return share;

}

/* ----------------------- */
/* GLOBAL */
/* ----------------------- */

let base64Image="";
let falRunning=false;
let currentSlide=0;

/* ----------------------- */
/* SAYFA YÜKLENİNCE */
/* ----------------------- */

document.addEventListener("DOMContentLoaded",function(){

/* ANDROID USER_ID SENKRON */

if(window.USER_ID){

userId = window.USER_ID;

localStorage.setItem("userId",userId);

console.log("Android USER_ID synced:",userId);

}

checkDailyFal();
updateFalHakUI();

/* OTOMATİK GİRİŞ */

const user = JSON.parse(localStorage.getItem("user"));

if(user){

let userName = user.name ? user.name : user.email;

document.getElementById("userNameText").innerText=userName;

if(user.picture){
document.getElementById("userAvatar").src = user.picture;
document.getElementById("userAvatar").style.display="inline-block";
}

document.getElementById("logoutBtn").style.display="inline-block";

}

});

/* ----------------------- */
/* FOTOĞRAF YÜKLE */
/* ----------------------- */

const input=document.getElementById("imageInput");

if(input){

input.addEventListener("change",function(){

const file=this.files[0];

if(!file) return;

const reader=new FileReader();

reader.onload=function(e){

base64Image=e.target.result;

const preview=document.getElementById("preview");

if(preview) preview.src=base64Image;

};

reader.readAsDataURL(file);

});

}

/* ----------------------- */
/* FAL BAK */
/* ----------------------- */

window.falBak=function(){

if(falRunning) return;

let falHak=parseInt(localStorage.getItem("falHak"))||0;

if(falHak<=0){

alert("Fal hakkın bitti. Reklam izle 🎬");

return;

}

if(!base64Image){

alert("Önce fincan fotoğrafı yükle");

return;

}

if(typeof Android !== "undefined"){

Android.showAd();

}else{

startFal();

}

};

/* ----------------------- */
/* REKLAM */
/* ----------------------- */


/* ----------------------- */
/* FAL API */
/* ----------------------- */

async function startFal(){

falRunning=true;

const loading=document.getElementById("loading");

if(loading) loading.style.display="flex";

try{

const res = await fetch("https://falcizade-server-production.up.railway.app/fal",{

method:"POST",

headers:{"Content-Type":"application/json"},

body:JSON.stringify({

image:base64Image,
user:userId

})

});

const data = await res.json();

if(loading) loading.style.display="none";

// fal hakkı bittiyse
if(data.error === "FAL_HAKKI_BITTI"){
    alert("Fal hakkın bitti. Reklam izle 🎬");
    return;
}

const fortune = data.fortune || "Fal alınamadı";

let falHak=parseInt(localStorage.getItem("falHak"))||0;

falHak=Math.max(0,falHak-1);

localStorage.setItem("falHak",falHak);

updateFalHakUI();

/* GEÇMİŞ */

let history=JSON.parse(localStorage.getItem("falHistory"))||[];

history.unshift({

date:new Date().toLocaleString(),
fortune:fortune

});

if(history.length>50) history.pop();

localStorage.setItem("falHistory",JSON.stringify(history));

renderFortune(fortune);

let totalFal = parseInt(localStorage.getItem("totalFal")) || 0;

totalFal++;

localStorage.setItem("totalFal", totalFal);

}catch(err){

alert("Fal hatası");

}

falRunning=false;

}

/* ----------------------- */
/* FAL GÖSTER */
/* ----------------------- */

function renderFortune(fortune){

const ask=fortune.split("### Aşk")[1]?.split("###")[0]||"";
const para=fortune.split("### Para")[1]?.split("###")[0]||"";
const yol=fortune.split("### Yol")[1]?.split("###")[0]||"";
const haber=fortune.split("### Haber")[1]?.split("###")[0]||"";
const genel=fortune.split("### Genel Yorum")[1]||fortune;

const result=document.getElementById("result");

result.innerHTML=`

<button onclick="closeFal()">✖</button>

<div class="fortuneViewer">

<div id="storyCounter">1 / 5</div>

<div class="fortuneSlide active"><h3>💖 Aşk</h3><p>${ask}</p></div>
<div class="fortuneSlide"><h3>💰 Para</h3><p>${para}</p></div>
<div class="fortuneSlide"><h3>🛣️ Yol</h3><p>${yol}</p></div>
<div class="fortuneSlide"><h3>📩 Haber</h3><p>${haber}</p></div>
<div class="fortuneSlide"><h3>🔮 Genel</h3><p>${genel}</p></div>

<div class="fortuneControls">
<button onclick="prevFortune()">◀</button>
<button onclick="nextFortune()">▶</button>
</div>

</div>

`;

currentSlide=0;

showSlide(0);

}

/* ----------------------- */
/* SLIDER */
/* ----------------------- */

function showSlide(index){

const slides=document.querySelectorAll(".fortuneSlide");

slides.forEach(s=>s.classList.remove("active"));

if(slides[index]) slides[index].classList.add("active");

const counter=document.getElementById("storyCounter");

if(counter) counter.innerText=(index+1)+" / "+slides.length;

}

window.nextFortune=function(){

const slides=document.querySelectorAll(".fortuneSlide");

if(currentSlide>=slides.length-1) return;

currentSlide++;

showSlide(currentSlide);

}

window.prevFortune=function(){

if(currentSlide<=0) return;

currentSlide--;

showSlide(currentSlide);

}

/* ----------------------- */
/* FAL GEÇMİŞİ */
/* ----------------------- */

window.toggleHistory=function(){

const container=document.getElementById("historyContainer");

if(container.style.display==="none"){

container.style.display="block";

renderHistory();

}else{

container.style.display="none";

}

}

function renderHistory(){

const container=document.getElementById("historyContainer");

container.innerHTML=`<button onclick="closeHistory()">✖</button>`;

let history=JSON.parse(localStorage.getItem("falHistory"))||[];

history.forEach(f=>{

const btn=document.createElement("button");

btn.innerText = "🕒 " + f.date;
btn.className = "historyItem";

btn.onclick=function(){

renderFortune(f.fortune);

container.style.display="none";

};

container.appendChild(btn);

});

}

window.closeHistory=function(){

document.getElementById("historyContainer").style.display="none";

}

/* ----------------------- */
/* FAL KAPAT */
/* ----------------------- */

window.closeFal=function(){

document.getElementById("result").innerHTML="";

}

/* ----------------------- */
/* REKLAM İZLE */
/* ----------------------- */

window.watchAd=function(){

if (typeof Android !== "undefined") {

    Android.showAd();

} else {

    alert("Bu özellik sadece mobil uygulamada çalışır.");

}

}

/* ----------------------- */
/* PAYLAŞIM ÖDÜLÜ */
/* ----------------------- */

function giveShareReward(){

let share=getShareData();

if(share.count>=3){

alert("Bugün max 3 paylaşım ödülü");

return;

}

share.count++;

localStorage.setItem("shareData",JSON.stringify(share));

let falHak=parseInt(localStorage.getItem("falHak"))||0;

falHak++;

localStorage.setItem("falHak",falHak);

updateFalHakUI();

alert("+1 Fal Kazandın 🎉");

}

/* ----------------------- */
/* PAYLAŞ */
/* ----------------------- */

window.shareReward=function(){

giveShareReward();

}

window.shareWhatsApp=function(){

const url=window.location.href;

window.open("https://wa.me/?text="+encodeURIComponent(url));

giveShareReward();

}

window.shareInstagram=function(){

navigator.clipboard.writeText(window.location.href);

alert("Link kopyalandı");

giveShareReward();

}

window.shareTikTok=function(){

navigator.clipboard.writeText(window.location.href);

window.open("https://tiktok.com");

giveShareReward();

}

/* ----------------------- */
/* STORY */
/* ----------------------- */

window.shareFalStory=function(){

const story=document.getElementById("storyExport");
const storyContent=document.getElementById("storyContent");

const activeSlide=document.querySelector(".fortuneSlide.active");

if(!activeSlide){

alert("Önce falına bak");

return;

}

storyContent.innerText=activeSlide.innerText;

story.style.display="flex";

html2canvas(story).then(canvas=>{

const link=document.createElement("a");

link.download="falcizade-story.png";

link.href=canvas.toDataURL();

link.click();

story.style.display="none";

});

}

/* PAYLAŞ POPUP AÇ */

window.openSharePopup = function(){

document.getElementById("sharePopup").style.display="flex";

}

/* PAYLAŞ POPUP KAPAT */

window.closeSharePopup = function(){

document.getElementById("sharePopup").style.display="none";

}

window.shareFacebook=function(){

const url=window.location.href;

window.open(
"https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(url)
);

giveShareReward();

}

window.shareTwitter=function(){

const url=window.location.href;

window.open(
"https://twitter.com/intent/tweet?text="+encodeURIComponent("Falcızade "+url)
);

giveShareReward();

}

window.copyFal=function(){

navigator.clipboard.writeText(window.location.href);

alert("Link kopyalandı 📋");

giveShareReward();

}

/* ----------------------- */
/* GOOGLE LOGIN */
/* ----------------------- */

function handleGoogleLogin(response){

const data = parseJwt(response.credential);

const user = {
email: data.email,
name: data.name,
picture: data.picture
};

localStorage.setItem("user", JSON.stringify(user));

document.getElementById("userNameText").innerText=data.name;

alert("Google ile giriş başarılı");

closeAuth();

}

function parseJwt(token){

var base64Url = token.split('.')[1];
var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

var jsonPayload = decodeURIComponent(
atob(base64)
.split('')
.map(function(c){
return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
})
.join('')
);

return JSON.parse(jsonPayload);

}

/* ----------------------- */
/* KULLANICI GİRİŞ */
/* ----------------------- */

function openAuth(){
document.getElementById("authPopup").style.display="flex";
}

function closeAuth(){
document.getElementById("authPopup").style.display="none";
}

function registerUser(){

if(document.getElementById("loginName").style.display==="none"){
alert("Önce Üye Ol butonuna basarak kayıt ekranını aç");
return;
}

const name=document.getElementById("loginName").value;
const email=document.getElementById("loginEmail").value;
const pass=document.getElementById("loginPass").value;

if(!name || !email || !pass){
alert("Lütfen tüm alanları doldurun");
return;
}

const user={
name:name,
email:email,
password:pass
};

localStorage.setItem("user",JSON.stringify(user));

document.getElementById("userPanelTop").innerText=name;

alert("Üyelik oluşturuldu");

closeAuth();

}

function loginUser(){

const email=document.getElementById("loginEmail").value;
const pass=document.getElementById("loginPass").value;

const user=JSON.parse(localStorage.getItem("user"));

if(user && user.email===email && user.password===pass){

document.getElementById("userNameText").innerText=user.email;

alert("Giriş başarılı");

closeAuth();

}else{

alert("Bilgiler yanlış");

}

}

function forgotPassword(){

const email = prompt("Kayıtlı e-postanı gir");

const user = JSON.parse(localStorage.getItem("user"));

if(user && user.email === email){

alert("Şifren: " + user.password);

}else{

alert("Bu e-posta ile kullanıcı bulunamadı");

}

}

/* ----------------------- */
/* LOGOUT */
/* ----------------------- */

function logoutUser(){

localStorage.removeItem("user");

document.getElementById("userNameText").innerText="Giriş";
document.getElementById("logoutBtn").style.display="none";

alert("Çıkış yapıldı");

location.reload();

}

function showRegister(){

document.getElementById("loginName").style.display="block";

}

function toggleUserMenu(){

const menu=document.getElementById("userMenu");

if(menu.style.display==="none"){
menu.style.display="flex";
}else{
menu.style.display="none";
}

}

function openProfile(){

const user = JSON.parse(localStorage.getItem("user"));

if(user){

document.getElementById("profileName").innerText = user.name || "Kullanıcı";

document.getElementById("profileEmail").innerText = user.email;

}

let totalFal = parseInt(localStorage.getItem("totalFal")) || 0;

document.getElementById("profileFalCount").innerText = totalFal;

let premium = localStorage.getItem("premium");

if(premium){

document.getElementById("profilePremium").innerText="Aktif";

}else{

document.getElementById("profilePremium").innerText="Yok";

}

document.getElementById("profilePopup").style.display="flex";

}

function handleUserPanelClick(){

const user = JSON.parse(localStorage.getItem("user"));

if(user){

toggleUserMenu();

}else{

openAuth();

}

}

document.addEventListener("click", function(e){

const panel = document.getElementById("userPanelTop");
const menu = document.getElementById("userMenu");

if(!panel.contains(e.target) && !menu.contains(e.target)){
menu.style.display="none";
}

});

function closeProfile(){

document.getElementById("profilePopup").style.display="none";

}

/* ----------------------- */
/* ANDROID REKLAM ÖDÜLÜ */
/* ----------------------- */

async function onAdReward(){

let falHak = parseInt(localStorage.getItem("falHak")) || 0;

falHak++;

localStorage.setItem("falHak", falHak);

updateFalHakUI();

falRunning = false;

/* SERVERA BİLDİR */

await fetch(
"https://falcizade-server-production.up.railway.app/reward-ad",
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
user:userId
})
});

/* SERVER HAK SENKRON */

try{

const res = await fetch(
"https://falcizade-server-production.up.railway.app/hak?user="+userId
);

const data = await res.json();

if(data.falHak !== undefined){

localStorage.setItem("falHak", data.falHak);

updateFalHakUI();

}

}catch(e){
console.log("hak sync error",e);
}

/* REKLAMDAN SONRA FALI BAŞLAT */

}