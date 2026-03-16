function showTab(tab){
document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"))
document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"))

document.getElementById(tab).classList.add("active")
event.target.classList.add("active")
}

function count(id,val){
let el=document.getElementById(id)
let num=parseInt(el.innerText)
num+=val
if(num<0)num=0
el.innerText=num
}

const juzList=document.getElementById("juzList")

for(let i=1;i<=30;i++){
let div=document.createElement("div")
div.className="juz"

div.innerHTML=`
<span>Juz ${i}</span>
<button onclick="this.innerText='Claimed'">Claim</button>
`

juzList.appendChild(div)
}
