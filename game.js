// ============================================
// game.js — Ilha da Agonia - Escape Complex
// ============================================

const C=document.getElementById('c'),X=C.getContext('2d');
const T=32,MW=80,MH=60,GW=800,GH=600;
const keys={};
document.addEventListener('keydown',e=>{
    keys[e.code]=true;
    if(state==='menu') handleMenuInput(e.code);
    // Toggle Inventário com I
    if(state==='play' && e.code==='KeyI') { showInventory = !showInventory; playTone(200,'sine',0.1,0.05); }
    // Fechar nota com E ou Escape
    if(state==='play' && activeNote && (e.code==='KeyE' || e.code==='Escape')) { activeNote = null; }
    // Sistema QTE (Quick Time Event)
    if(state==='play' && playerState==='grabbed' && e.code==='Space') {
        qteProgress += 15;
        playTone(300, 'square', 0.05, 0.1);
        shake = 5;
    }
    e.preventDefault()
});
document.addEventListener('keyup',e=>{keys[e.code]=false});


let audioCtx;
function initAudio() { if(audioCtx) return; audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playTone(freq, type, dur, vol) {
    if(!audioCtx) return; const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq; gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + dur);
}


// Game state
let state='menu', victoryType='', difficulty='Normal', diffIdx = 1;
const diffs = ['Misericórdia', 'Agonia', 'Tormento'];
let animTick = 0, particles = [], shake = 0, loreMsg = '', loreT = 0, showInventory = false;


let playerState = 'normal'; // 'normal', 'grabbed'
let grabber = null;
let qteProgress = 0;
let victoryTimer = 0;


const Pal = {
    water: '#0a1018', ash: '#3a3a3a', deadGrass: '#222815', dirt: '#2a1a10',
    fleshForest: '#1a0505', ruinWall: '#1e1e22', rottenFloor: '#3a2d25',
    rust: '#4a2a1a', blood: '#7a0000', freshBlood: '#b30000',
    crepuscule: 'rgba(5, 5, 10, 0.60)', coldLight: '#d1e5ff',
    playerShirt: '#40a0ff', playerPants: '#2a3a4a', playerSkin: '#ffdbac'
};


const tileColors = [Pal.water, Pal.ash, Pal.deadGrass, Pal.dirt, Pal.fleshForest, Pal.ruinWall, Pal.rottenFloor, '#050508', Pal.rust, '#555', Pal.rust];


function genMap(){
  const m=[];
  for(let y=0;y<MH;y++){m[y]=[];for(let x=0;x<MW;x++){
    const dx=(x-40)/35,dy=(y-30)/28; const d=dx*dx+dy*dy+Math.sin(x*.5)*.05+Math.cos(y*.4)*.05;
    if(d<.85)m[y][x]=2;else if(d<.95)m[y][x]=1;else m[y][x]=0;
  }}
  for(let i=0; i<150; i++) {
      let rx=Math.floor(Math.random()*MW), ry=Math.floor(Math.random()*MH);
      if(m[ry][rx]===2) m[ry][rx]=5;
  }
  for(let y=5;y<55;y++){if(m[y][40]!==0) {m[y][40]=3;m[y][41]=3;}}
  for(let x=10;x<70;x++){if(m[30][x]!==0) {m[30][x]=3;m[31][x]=3;}}
  const blds=[ [15,15,8,6], [60,15,8,6], [15,40,8,6], [60,40,8,6], [38,10,6,5] ];
  blds.forEach(([bx,by,bw,bh])=>{
      for(let y=by;y<by+bh;y++)for(let x=bx;x<bx+bw;x++){
        if(x===bx||x===bx+bw-1||y===by||y===by+bh-1)m[y][x]=5;else m[y][x]=6;
      }; m[by+bh-1][bx+Math.floor(bw/2)]=6;
  });
  for(let y=12;y<28;y++)for(let x=45;x<58;x++)if(m[y][x]===2 || m[y][x]===5)m[y][x]=4;
  for(let x=50;x<75;x++){if(m[10])m[10][x]=8;if(m[11])m[11][x]=8;}
  for(let x=38;x<44;x++){if(m[55])m[55][x]=10;if(m[56])m[56][x]=10;if(m[57])m[57][x]=10;}
  return m;
}
const map=genMap();


let sysVars = { knowsCode: false, safeOpen: false, genOn: false, altarDone: false, fuseFixed: false, weaponBoxOpen: false };


const interactables = [
    { type: 'safe', x: 18, y: 17, icon: '🗄️', name: 'Cofre Trancado', action: () => {
          if(sysVars.safeOpen) return {msg: "O co cofre já está aberto."};
          if(sysVars.knowsCode) { sysVars.safeOpen = true; inventory.push('key'); return {msg: "Senha 1984 aceita! Chave Enferrujada coletada.", sfx: 400}; }
          else return {msg: "Trancado. Exige senha de 4 dígitos. Leia a nota próxima.", sfx: 100};
      }
    },
    { type: 'generator', x: 64, y: 42, icon: '⚙️', name: 'Gerador Quebrado', action: () => {
          if(sysVars.genOn) return {msg: "Gerador funcionando."};
          if(pstam < 30) return {msg: "Vitalidade baixa demais. Coma algo antes.", sfx: 100};
          pstam -= 30; sysVars.genOn = true; return {msg: "Gerador LIGADO! Energia na ilha restaurada.", sfx: 150};
      }
    },
    { type: 'fuel_lock', x: 40, y: 12, icon: '🔒', name: 'Trava Eletrônica', action: () => {
          if(inventory.includes('fuel')) return {msg: "Suporte já está vazio."};
          if(sysVars.genOn) { inventory.push('fuel'); return {msg: "Trava abriu! Galão de Óleo coletado.", sfx: 400}; }
          else return {msg: "Sem energia. Ligue o gerador na casa Sudeste.", sfx: 100};
      }
    },
    { type: 'corpse', x: 50, y: 18, icon: '🧟', name: 'Cadáver Mutante', action: () => {
          if(inventory.includes('machete')) return {msg: "O corpo está destroçado."};
          if(pstam < 50) return {msg: "Vitalidade insuficiente. Você precisa de 50 de fôlego.", sfx: 100};
          pstam -= 50; inventory.push('machete'); return {msg: "Você arrancou o Cutelo de Açougueiro!", sfx: 400};
      }
    },
    { type: 'flesh_vines', x: 18, y: 42, icon: '🕸️', name: 'Vinha de Carne', action: () => {
          if(inventory.includes('tools')) return {msg: "Você já pegou a caixa."};
          if(inventory.includes('machete')) { inventory.push('tools'); return {msg: "Vinha cortada! Caixa de Ferramentas coletada.", sfx: 400}; }
          else return {msg: "Muito resistente. Precisa de uma lâmina afiada.", sfx: 100};
      }
    },
    // NOVOS PUZZLES
    { type: 'altar', x: 30, y: 48, icon: '🗇', name: 'Altar de Ossos', action: () => {
          if(sysVars.altarDone) return {msg: "O altar já foi ativado."};
          if(!inventory.includes('food') && !inventory.includes('food2') && !inventory.includes('food3'))
              return {msg: "O altar exige um sacrifício de carne. Encontre carne no mapa.", sfx: 100};
          const idx = inventory.indexOf('food') !== -1 ? 'food' : inventory.indexOf('food2') !== -1 ? 'food2' : 'food3';
          inventory.splice(inventory.indexOf(idx), 1);
          sysVars.altarDone = true; inventory.push('radio');
          return {msg: "A carne foi consumida pelo altar. Você encontrou o Rádio Militar!", sfx: 400};
      }
    },
    { type: 'fuse_box', x: 55, y: 28, icon: '💱', name: 'Painel de Fusíveis', action: () => {
          if(sysVars.fuseFixed) return {msg: "Painel já reparado. A pista de pouso está iluminada."};
          if(!inventory.includes('tools')) return {msg: "O painel precisa de ferramentas para ser reparado.", sfx: 100};
          sysVars.fuseFixed = true;
          return {msg: "Painel reparado! As luzes da pista de pouso foram ligadas.", sfx: 400};
      }
    },
    { type: 'weapon_box', x: 70, y: 45, icon: '🔿', name: 'Caixa de Armas Trancada', action: () => {
          if(sysVars.weaponBoxOpen) return {msg: "Caixa já foi aberta."};
          if(!sysVars.altarDone) return {msg: "Trancada por rito. Ative o altar de ossos primeiro.", sfx: 100};
          sysVars.weaponBoxOpen = true; inventory.push('machete');
          return {msg: "A trava à antiga cedeu! Cutelo de Açougueiro coletado.", sfx: 400};
      }
    }
];


const items=[
  {id:'lantern',name:'Lanterna',icon:'🔦',x:40,y:51,got:false},
  {id:'food',name:'Carne Curativa',icon:'🥩',x:30,y:30,got:false},
  {id:'food2',name:'Carne Curativa',icon:'🥩',x:50,y:40,got:false},
  {id:'food3',name:'Carne Curativa',icon:'🥩',x:20,y:20,got:false},
  {id:'radio',name:'Rádio Militar',icon:'📻',x:64,y:17,got:false}
];


// Sistema de notas com tela de leitura
let activeNote = null; // { title, content, icon }
const notes=[
    { x:17, y:16, icon:'📜', title:'Nota Ensanguentada - Cofre',
      content: 'Escondi a única chave do barco no cofre do quarto norte.\n\nSenha: meu ano de nascimento. Sou de 1984.\n\n- Para abrir: vá até o cofre (eixo noroeste) e\n  pressione E com a senha descoberta.',
      action: () => { sysVars.knowsCode = true; } },
    { x:63, y:41, icon:'📜', title:'Manual do Gerador',
      content: 'GERADOR DE EMERGÊNCIA - INSTRUÇÕES:\n\n1. Verifique o nível de combustível\n2. Puxe a corda de partida com força\n   (requer 30 de vitalidade mínima)\n3. O painel eletrônico na casa\n   Noroeste será ativado automaticamente.',
      action: () => {} },
    { x:39, y:11, icon:'📜', title:'Aviso de Segurança',
      content: 'COMBUSTÍVEL TRANCADO - ACESSO RESTRITO\n\nA trava eletrônica só abre com energia.\n\nPasso 1: Ligue o gerador (casa Sudeste)\nPasso 2: Volte aqui e pressione E\nPasso 3: Retire o galão de óleo',
      action: () => {} },
    { x:49, y:17, icon:'📜', title:'Diário - Dia 12',
      content: 'Tentei retirar a faca do corpo do monstro\nnorte mas não tive força.\n\nPreciso estar descansado (50+ de vitalidade).\nCom o cutelo, posso cortar as vinhas\nna casa Sudoeste e pegar as ferramentas.\n\nSem as ferramentas, o barco não sai.',
      action: () => {} },
    { x:17, y:41, icon:'📜', title:'Nota presa na vinha',
      content: 'AS VINHAS SÃO VIVAS.\n\nElas consomem tudo que toca.\nMinha faca se part... só uma lâmina\nresistente e AFIADA vai cortar.\n\n>> Precisa do Cutelo do monstro ao norte <<\n\nAs ferramentas estão lá dentro.\nSem elas, o barco e o avião não funcionam.',
      action: () => {} },
    { x:29, y:47, icon:'📜', title:'Ritual do Altar de Ossos',
      content: 'ALTAR DA VELHA ILHA\n\nEste altar consome o que é de carne.\nOferenda = carne crua ou processada.\n\nEm troca, ele revela o que está escondido.\nHoje revelou um rádio militar enterrado.\n\n>> Leve carne até o altar e pressione E <<',
      action: () => {} },
    { x:54, y:27, icon:'📜', title:'Manual Técnico - Painel Elétrico',
      content: 'PAINEL DE FUSÍVEIS - PISTA DE POUSO\n\nO painel queimou durante a tempestade.\nSem ele, as luzes da pista ficam apagadas\ne o avião não consegue decolar com segura.\n\nNecessita: Caixa de Ferramentas\nNecessita: Conhecimento técnico\n\n>> Use as ferramentas no painel ao lado <<',
      action: () => {} },
    { x:69, y:44, icon:'📜', title:'Aviso da Caixa de Armas',
      content: 'CAIXA RITUAL TRANCADA\n\nEsta caixa foi selada com um rito antigo.\nA fechadura só pode ser quebrada\nquando o altar de ossos for ativado.\n\nPasso 1: Encontre carne crua no mapa\nPasso 2: Ative o altar de ossos (Sudoeste)\nPasso 3: Volte aqui e abra a caixa',
      action: () => {} },
    { x:40, y:30, icon:'📜', title:'Diário de Sobrevivência - Dia 3',
      content: 'Não consigo dormir.\nOs olhos dele aparecem no escuro.\n\nTentei gritar quando os lacaios me pegaram.\nEles me levaram direto para AQUELA coisa.\n\nSe você ler isso: se um capanga\nte pegar, ESMAGUE ESPAÇO repetidamente!\nÉ a única forma de escapar.',
      action: () => {} },
    { x:25, y:10, icon:'📜', title:'Bilhete rasgado',
      content: 'Existem 3 formas de sair desta ilha:\n\n1. BARCO (cais sul)\n   Precisa: Chave + Óleo + Ferramentas\n\n2. AVIÃO (pista norte)\n   Precisa: Óleo + Ferramentas + Cutelo\n   * O painel da pista precisa ser reparado!\n\n3. RÁDIO (casa Nordeste)\n   Precisa: apenas o Rádio Militar\n   (mais fácil, mas demora o resgate)',
      action: () => {} },
    { x:60, y:55, icon:'📜', title:'Última mensagem',
      content: 'Não há saída.\n\nEle sente o calor do medo.\nQuanto mais você corre,\nmais rápido ele vem.\n\nEsconda-se. Respire.\nNão deixe a energia acabar.\n\nA LANTERNA está no cais.\nEla é sua única luz nessa escuridão.',
      action: () => {} },
    { x:72, y:22, icon:'📜', title:'Relatório de Expedição',
      content: 'EXPEDIÇÃO CIENTÍFICA - DIA 1\n\nA ilha apresenta comportamento biológico\nanormal. As plan... estão VIVAS.\n\nA criatura central parece controlar tudo.\nSeus lacaios são humanos transformados.\n\nSe perder vitalidade, coma a carne\nencontrada pelo mapa. Ela regenera.',
      action: () => {} }
];


// Armários de esconderijo - com posição e estado visual
const wardrobes = [
    {x:17, y:19, open:false, label:'Armário Empoeirado'},
    {x:22, y:19, open:false, label:'Armário de Carvalho'},
    {x:61, y:19, open:false, label:'Armário Metálico'},
    {x:67, y:19, open:false, label:'Armário Enferrujado'},
    {x:16, y:43, open:false, label:'Guarda-roupa'},
    {x:22, y:43, open:false, label:'Armário Podre'},
    {x:61, y:43, open:false, label:'Armário de Ferro'},
    {x:67, y:43, open:false, label:'Armário Escuro'},
    {x:39, y:13, open:false, label:'Roupeiro'},
    {x:43, y:13, open:false, label:'Armário de Aço'},
];


let px=40*T+16,py=53*T+16,pdir=0,pstam=100,prun=false,phide=false, pmoving=false, hideCD=0;
let vx=40*T+16,vy=20*T+16,vdir=0,vstate='patrol',vpi=0,vsearchT=0,vlkx=0,vlky=0,vDashT=0;
const vpath=[{x:40,y:25},{x:25,y:25},{x:25,y:15},{x:50,y:15},{x:60,y:25},{x:60,y:40},{x:40,y:40}];
let camX=0,camY=0;


// Capangas (Minions) - 7 no total
const minions = [
    {x: 60*T, y: 30*T, state: 'patrol', pi: 0, stunTimer: 0, path: [{x:60,y:30}, {x:70,y:30}, {x:70,y:45}, {x:60,y:45}]},
    {x: 20*T, y: 25*T, state: 'patrol', pi: 0, stunTimer: 0, path: [{x:20,y:25}, {x:35,y:25}, {x:35,y:15}, {x:20,y:15}]},
    {x: 20*T, y: 50*T, state: 'patrol', pi: 0, stunTimer: 0, path: [{x:20,y:50}, {x:30,y:50}, {x:30,y:40}, {x:20,y:40}]},
    {x: 45*T, y: 35*T, state: 'patrol', pi: 0, stunTimer: 0, path: [{x:45,y:35}, {x:55,y:35}, {x:55,y:50}, {x:45,y:50}]},
    {x: 30*T, y: 12*T, state: 'patrol', pi: 0, stunTimer: 0, path: [{x:30,y:12}, {x:38,y:12}, {x:38,y:22}, {x:30,y:22}]},
    {x: 65*T, y: 18*T, state: 'patrol', pi: 0, stunTimer: 0, path: [{x:65,y:18}, {x:72,y:18}, {x:72,y:28}, {x:65,y:28}]},
    {x: 35*T, y: 45*T, state: 'patrol', pi: 0, stunTimer: 0, path: [{x:35,y:45}, {x:42,y:45}, {x:42,y:55}, {x:35,y:55}]}
];


const escapes={
  boat:{x:40,y:56,need:['key','fuel','tools'],name:'Barco'},
  plane:{x:60,y:10,need:['fuel','tools','machete'],name:'Avião'},
  radio:{x:16,y:40,need:['radio'],name:'Resgate (Sinal)'}
};


function spawnParticles(x, y, count, color) {
    for(let i=0; i<count; i++) { particles.push({ x: x, y: y, vx: (Math.random()-0.5)*150, vy: (Math.random()-0.5)*150, life: 1.0, color: color }); }
}
function updateParticles(dt) {
    for(let i=particles.length-1; i>=0; i--) {
        const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 2;
        if(p.life <= 0) particles.splice(i, 1);
    }
}


function solid(tx,ty){ if(tx<0||tx>=MW||ty<0||ty>=MH)return true; const t=map[ty][tx]; return t===0||t===5||t===9; }
function dist(ax,ay,bx,by){return Math.sqrt((ax-bx)**2+(ay-by)**2)}


function updatePlayer(dt){
  if(playerState === 'grabbed') {
      qteProgress = Math.max(0, qteProgress - 35 * dt); // QTE Decay
      if (qteProgress >= 100) {
          playerState = 'normal';
          grabber.state = 'stunned';
          grabber.stunTimer = 4;
          grabber = null;
          shake = 10;
          playTone(600, 'sine', 0.2, 0.2); // Escape sound
      }
      if (dist(px, py, vx, vy) < 30) {
          state = 'gameover'; // Villain got you
      }
      return; // Stop normal movement
  }


  // Cooldown após sair do esconderijo (evita re-entrar imediatamente)
  if(hideCD > 0) hideCD--;

  // Permitir sair do esconderijo mesmo estando escondido
  if(phide) {
    if(keys['KeyE'] && !keys._e) {
      keys._e = true;
      const hiddenIn = wardrobes.find(w=>w.open);
      if(hiddenIn) hiddenIn.open = false;
      phide = false; hideCD = 30; msg = 'Você saiu do esconderijo.'; msgT = 90;
      playTone(150, 'sine', 0.1, 0.05);
    }
    if(!keys['KeyE']) keys._e = false;
    return;
  }
  let mx=0,my=0;
  if(keys['ArrowLeft']||keys['KeyA'])mx=-1; if(keys['ArrowRight']||keys['KeyD'])mx=1;
  if(keys['ArrowUp']||keys['KeyW'])my=-1; if(keys['ArrowDown']||keys['KeyS'])my=1;
  pmoving = mx!==0 || my!==0; if(mx&&my){mx*=.707;my*=.707;}
  if(my<0)pdir=3;else if(my>0)pdir=0;else if(mx<0)pdir=1;else if(mx>0)pdir=2;
  prun=(keys['ShiftLeft']||keys['ShiftRight'])&&pstam>0&&pmoving;
  const spd=prun?175:100;
  const regen = difficulty==='Misericórdia'?12:difficulty==='Agonia'?7:4;
  if(prun) { pstam=Math.max(0,pstam-25*dt); if(animTick%15===0) playTone(100, 'sine', 0.1, 0.05); }
  else pstam=Math.min(100,pstam+regen*dt);
  const nx=px+mx*spd*dt,ny=py+my*spd*dt;
  if(!solid(Math.floor(nx/T),Math.floor(py/T)))px=nx; if(!solid(Math.floor(px/T),Math.floor(ny/T)))py=ny;
 
  if(keys['KeyE']&&!keys._e){
    keys._e=true;
    interactables.forEach(inter => {
        if(dist(px,py,inter.x*T+16,inter.y*T+16)<45) { const res = inter.action(); msg = res.msg; msgT = 180; if(res.sfx) playTone(res.sfx, 'sine', 0.1, 0.1); }
    });
    items.forEach(it=>{if(!it.got&&dist(px,py,it.x*T+16,it.y*T+16)<40){
      if(it.id.startsWith('food')){pstam=100;it.got=true; msg='Vitalidade máxima!'; msgT=120; playTone(150, 'square', 0.3, 0.1); return;}
      if(inventory.length<6){it.got=true;inventory.push(it.id);msg=it.name+' COLETADO.';msgT=120; playTone(400, 'sine', 0.1, 0.1);}
    }});
    notes.forEach(n=>{
        if(dist(px,py,n.x*T+16,n.y*T+16)<40){
            activeNote = n; n.action();
            playTone(300, 'sine', 0.2, 0.1);
        }
    });
    // Armários: entrar (apenas se não estiver em cooldown)
    const nearWardrobe = wardrobes.find(w => dist(px,py,w.x*T+16,w.y*T+16)<40);
    if(!phide && nearWardrobe && hideCD <= 0) {
        phide = true;
        nearWardrobe.open = true;
        px = nearWardrobe.x*T+16; py = nearWardrobe.y*T+16;
        msg = 'ESCONDIDO no ' + nearWardrobe.label + '. Pressione E para sair.';
        msgT = 180;
        playTone(180, 'sine', 0.15, 0.08);
    }
    Object.entries(escapes).forEach(([k,e])=>{
      if(dist(px,py,e.x*T+16,e.y*T+16)<48){
        if(e.need.every(n=>inventory.includes(n))){state='victory';victoryType=e.name;}
        else{msg='Faltam itens: '+e.need.join(', ');msgT=120;}
      }
    });
  }
  if(!keys['KeyE'])keys._e=false;
}


function updateVillain(dt){
  const vSpdMult = difficulty==='Misericórdia'?0.8:difficulty==='Agonia'?1.2:1.6;
  const d=dist(vx,vy,px,py);
  if(d < 350 && animTick % Math.floor(Math.max(10, d/4)) === 0) playTone(60, 'sine', 0.1, 0.2);
  const canSee=!phide&&d<(250*(difficulty==='Tormento'?1.5:1));
  if(vstate==='patrol'){
    if(canSee){vstate='chase'; playTone(50, 'sawtooth', 0.5, 0.2); shake = 15;}
    const wp=vpath[vpi];const a=Math.atan2(wp.y*T+16-vy,wp.x*T+16-vx);vx+=Math.cos(a)*60*vSpdMult*dt;vy+=Math.sin(a)*60*vSpdMult*dt;
    if(dist(vx,vy,wp.x*T+16,wp.y*T+16)<8)vpi=(vpi+1)%vpath.length;
  }else if(vstate==='chase'){
    if(phide && d > 120 && playerState !== 'grabbed'){vstate='patrol';return;}
    if(d < 120 && vDashT <= 0 && Math.random() > 0.98) vDashT = 0.5;
    const dashSpd = vDashT > 0 ? 2.5 : 1; vDashT -= dt;
    const a=Math.atan2(py-vy,px-vx);vx+=Math.cos(a)*220*vSpdMult*dashSpd*dt;vy+=Math.sin(a)*220*vSpdMult*dashSpd*dt;
    if(d<26){state='gameover'; playTone(40, 'sawtooth', 1, 0.3); spawnParticles(vx, vy, 50, Pal.freshBlood); shake = 30;}
  }
}


function updateMinions(dt) {
    minions.forEach(m => {
        if (m.state === 'stunned') {
            m.stunTimer -= dt;
            if(m.stunTimer <= 0) m.state = 'patrol';
            return;
        }
       
        if (playerState === 'grabbed' && grabber !== m) return;


        if (playerState === 'grabbed' && grabber === m) {
            // Carry player to villain
            const a = Math.atan2(vy - m.y, vx - m.x);
            m.x += Math.cos(a) * 75 * dt;
            m.y += Math.sin(a) * 75 * dt;
            px = m.x; py = m.y; // Lock player to minion
            return;
        }


        const d = dist(m.x, m.y, px, py);
        const canSee = !phide && d < 180;
       
        if (m.state === 'patrol') {
            if (canSee) m.state = 'chase';
            else {
                const wp = m.path[m.pi];
                const a = Math.atan2(wp.y*T+16 - m.y, wp.x*T+16 - m.x);
                m.x += Math.cos(a) * 50 * dt; m.y += Math.sin(a) * 50 * dt;
                if(dist(m.x, m.y, wp.x*T+16, wp.y*T+16) < 8) m.pi = (m.pi+1) % m.path.length;
            }
        } else if (m.state === 'chase') {
            if (phide && d > 120) m.state = 'patrol';
            else {
                const a = Math.atan2(py - m.y, px - m.x);
                m.x += Math.cos(a) * 115 * dt; m.y += Math.sin(a) * 115 * dt;
                if (d < 22 && playerState !== 'grabbed') {
                    // GRABBED!
                    playerState = 'grabbed'; grabber = m; qteProgress = 0; shake = 20;
                    playTone(100, 'sawtooth', 0.5, 0.3);
                }
            }
        }
    });
}


function drawDetailedEntity(x, y, dir, type, isMoving) {
    X.save(); const ex=x-camX, ey=y-camY; const bob = isMoving ? Math.sin(animTick * 0.25) * 3 : 0;
    if(type==='player') {
        X.translate(ex, ey + bob);
        X.fillStyle='rgba(0,0,0,0.5)'; X.beginPath(); X.ellipse(0, 12-bob, 14, 7, 0, 0, Math.PI*2); X.fill();
        X.fillStyle=Pal.playerPants; X.fillRect(-9, 6, 7, 10); X.fillRect(2, 6, 7, 10);
        X.fillStyle=Pal.playerShirt; X.fillRect(-11, -10, 22, 20);
        X.fillStyle='#3080e0'; X.fillRect(-11, -10, 7, 20); X.fillRect(4, -10, 7, 20);
        X.fillStyle='#5a4a3a'; X.fillRect(-8, -8, 16, 14);
        X.fillStyle=Pal.playerSkin; X.fillRect(-13, -2, 4, 10); X.fillRect(9, -2, 4, 10);
        X.fillRect(-9, -24, 18, 18);
        X.fillStyle='#3a2a1a'; X.fillRect(-10, -27, 20, 9);
        if(dir===0) { X.fillStyle='#000'; X.fillRect(-6, -18, 4, 4); X.fillRect(2, -18, 4, 4); }
    } else if(type==='villain') {
        X.translate(ex + Math.sin(animTick*0.5)*2, ey + bob);
        X.fillStyle='rgba(0,0,0,0.4)'; X.beginPath(); X.arc(0, 0, 40+Math.sin(animTick*0.2)*10, 0, Math.PI*2); X.fill();
        X.strokeStyle='#1a0000'; X.lineWidth = 4;
        for(let i=0; i<4; i++) {
            X.beginPath(); X.moveTo(0,0); X.quadraticCurveTo(Math.sin(animTick*0.1+i)*30, Math.cos(animTick*0.1+i)*30, Math.sin(animTick*0.1+i*2)*50, Math.cos(animTick*0.1+i*2)*50); X.stroke();
        }
        X.fillStyle='#050505'; X.fillRect(-14, -20, 28, 45); X.fillStyle='#500'; X.fillRect(-10, -15, 20, 25);
        X.fillStyle='#ccc'; for(let i=0; i<5; i++) X.fillRect(-8, -10 + i*6, 16, 2); X.fillStyle='#000'; X.fillRect(-12, -35, 24, 25);
        X.shadowBlur = 20; X.shadowColor = '#f00'; X.fillStyle='#ff0000';
        if(dir===0) { X.fillRect(-7, -28, 5, 5); X.fillRect(2, -28, 5, 5); }
        X.shadowBlur = 0; if(animTick%4===0) spawnParticles(0, 0, 2, Pal.freshBlood);
    } else if(type==='minion') {
        X.translate(ex, ey + bob);
        X.fillStyle='rgba(0,0,0,0.4)'; X.beginPath(); X.arc(0, 10-bob, 15, 0, Math.PI*2); X.fill();
        X.fillStyle='#2a352a'; X.fillRect(-8, -5, 16, 15); // Legs
        X.fillStyle='#1c251c'; X.fillRect(-10, -15, 20, 15); // Body
        if(isMoving) { X.fillStyle='#3a453a'; X.fillRect(-14, -10, 4, 15); X.fillRect(10, -10, 4, 15); } // Arms
        X.fillStyle='#4a554a'; X.fillRect(-6, -24, 12, 10); // Head
        X.fillStyle='#ffaa00'; X.fillRect(-3, -20, 2, 2); X.fillRect(1, -20, 2, 2); // Yellow eyes
    }
    X.restore();
}


function draw() {
  animTick++; if(shake > 0) shake *= 0.9;
  const sx2 = (Math.random()-0.5)*shake, sy2 = (Math.random()-0.5)*shake;
  X.save(); X.translate(sx2, sy2);
  X.fillStyle=Pal.water; X.fillRect(-50,-50,GW+100,GH+100);
  camX=px-GW/2;camY=py-GH/2; camX=Math.max(0,Math.min(MW*T-GW,camX)); camY=Math.max(0,Math.min(MH*T-GH,camY));
 
  for(let y=Math.floor(camY/T); y<Math.ceil((camY+GH)/T); y++) {
      for(let x=Math.floor(camX/T); x<Math.ceil((camX+GW)/T); x++) {
          if(map[y]&&map[y][x]!==undefined) {
              const t = map[y][x]; const tx = x*T-camX, ty = y*T-camY;
              X.fillStyle=tileColors[t]; X.fillRect(tx, ty, T, T);
              X.save(); X.translate(tx, ty);
              if(t === 0) {
                  // ÁGUA - ondas com profundidade e espuma nas bordas
                  const w1 = Math.sin(animTick*0.05+x*0.8+y*0.4)*4, w2=Math.sin(animTick*0.07+x*0.4-y*0.6)*3;
                  X.fillStyle='#1a2d3e'; X.fillRect(0,0,T,T);
                  X.fillStyle='rgba(30,80,130,0.5)'; X.fillRect(0,6+w1,T,5);
                  X.fillStyle='rgba(50,110,160,0.35)'; X.fillRect(2,16+w2,T-4,3);
                  X.fillStyle='rgba(255,255,255,0.07)'; X.fillRect(0,24+w1,T,2);
                  if(map[y]&&map[y][x-1]&&map[y][x-1]!==0){X.fillStyle='rgba(200,230,255,0.18)';X.fillRect(0,0,3,T);}
                  if(map[y]&&map[y][x+1]&&map[y][x+1]!==0){X.fillStyle='rgba(200,230,255,0.18)';X.fillRect(T-3,0,3,T);}
              } else if(t === 1) {
                  // AREIA / BORDA - grãos e sombra de borda
                  X.fillStyle='#5a4a30'; X.fillRect(0,0,T,T);
                  X.fillStyle='#4a3a22';
                  if((x*7+y*3)%5===0){X.fillRect(6,4,3,2);} if((x*3+y*11)%7===0){X.fillRect(18,14,4,2);}
                  if((x*11+y*5)%9===0){X.fillRect(10,22,3,3);} X.fillStyle='#6a5a40';
                  if((x*5+y*7)%6===0){X.fillRect(20,6,2,2);} if((x*9+y*2)%8===0){X.fillRect(4,20,3,2);}
              } else if(t === 2) {
                  // GRAMA MORTA - tufos com vento, pedras, árvores secas e sangue
                  const n=(x*13+y*7)%16, sway=Math.sin(animTick*0.04+x*1.3+y*0.8)*2;
                  X.fillStyle=n<8?'#252f15':'#1e2810'; X.fillRect(0,0,T,T);
                  // Tufos de grama
                  X.fillStyle='#1a2208';
                  X.fillRect(4+sway,14,3,8); X.fillRect(12+sway,10,2,10); X.fillRect(20+sway*0.8,16,3,7); X.fillRect(26+sway,12,2,9);
                  X.fillStyle='#2a3510'; X.fillRect(7+sway,16,2,5); X.fillRect(23+sway,18,2,4);
                  // Pedra
                  if(n%4===0){X.fillStyle='#3a3830';X.fillRect(14,18,8,6);X.fillStyle='#4a4840';X.fillRect(14,18,8,2);}
                  // Árvore seca
                  if((x*3+y*7)%11===0){X.fillStyle='#120e06';X.fillRect(13,-18,5,28);X.fillStyle='#0e0b04';X.fillRect(5,-8,9,3);X.fillRect(18,-12,8,3);}
                  // Sangue no chão
                  if((x*5+y*9)%13===0){X.fillStyle='rgba(120,0,0,0.65)';X.fillRect(6,20,12,5);X.fillRect(10,24,7,4);}
              } else if(t === 3) {
                  // CAMINHO DE TERRA - sulcos, pedriscos e marcas de pisadas
                  X.fillStyle='#2e1f12'; X.fillRect(0,0,T,T);
                  X.fillStyle='#1f0e07'; X.fillRect(0,9,T,4); X.fillRect(0,21,T,3);
                  X.fillStyle='#3a2a1a';
                  if((x+y*3)%5===0){X.fillRect(6,14,4,3);} if((x*3+y)%7===0){X.fillRect(20,8,3,3);}
                  if((x*2+y*5)%9===0){X.fillRect(14,24,5,3);}
                  if((x*7+y*11)%17===0){X.fillStyle='#1a0f08';X.fillRect(7,5,6,4);X.fillRect(17,17,5,4);}
              } else if(t === 4) {
                  // FLORESTA DE CARNE - veias pulsantes, massa orgânica e sangue escorrendo
                  const pulse=Math.sin(animTick*0.1+x*0.7+y*0.5)*3, pulse2=Math.sin(animTick*0.07+x+y*0.3)*2;
                  X.fillStyle='#1a0505'; X.fillRect(0,0,T,T);
                  X.fillStyle=`rgba(150,${15+pulse*4},${15+pulse*4},0.85)`;
                  X.fillRect(3,7-pulse/2,7+pulse,4+pulse/2); X.fillRect(17,15+pulse2/2,9+pulse2,3);
                  X.fillRect(6,23-pulse,12+pulse,3);
                  X.fillStyle=`rgb(${95+pulse*5},${12+pulse},${12+pulse})`;
                  X.fillRect(9-pulse/2,9-pulse/2,14+pulse,14+pulse);
                  X.fillStyle=`rgb(${65+pulse*3},8,8)`; X.fillRect(12,12,8,8);
                  if((x+y)%3===0){X.fillStyle='rgba(180,0,0,0.6)';X.fillRect(15,20,3,T);}
                  if((x*3+y)%5===0){X.fillStyle='rgba(200,0,0,0.3)';X.fillRect(3,3,5,5);}
              } else if(t === 5) {
                  // PAREDE DE PEDRA - alvenaria 3D com erosão, rachaduras e musgo
                  X.fillStyle='#1a1a1e'; X.fillRect(0,0,T,T);
                  // Grade de tijolos alternados
                  X.fillStyle='#111115';
                  X.fillRect(0,10,T,2); X.fillRect(0,22,T,2); // horizontais
                  X.fillRect(8,0,2,10); X.fillRect(24,0,2,10); // verticais linha 1
                  X.fillRect(0,12,2,10); X.fillRect(16,12,2,10); // verticais linha 2
                  X.fillRect(8,24,2,T); X.fillRect(24,24,2,T); // verticais linha 3
                  // Topo iluminado (profundidade 3D)
                  X.fillStyle='#30303a'; X.fillRect(0,0,T,4);
                  // Rachaduras
                  X.fillStyle='#0a0a0d';
                  if((x*5+y*3)%7===0){X.fillRect(11,5,1,6);X.fillRect(11,5,3,1);}
                  if((x*3+y*7)%11===0){X.fillRect(21,14,1,6);}
                  if((x*9+y*5)%13===0){X.fillRect(4,25,1,5);X.fillRect(4,28,4,1);}
                  // Musgo
                  if((x*7+y*5)%9===0){X.fillStyle='rgba(15,45,10,0.75)';X.fillRect(0,T-7,T,7);}
                  if((x*4+y*8)%11===0){X.fillStyle='rgba(15,45,10,0.5)';X.fillRect(0,0,5,T);}
              } else if(t === 6) {
                  // PISO DE MADEIRA - tábuas detalhadas com nós, manchas e sombras
                  X.fillStyle='#1c1208'; X.fillRect(0,0,T,T);
                  // Tábuas com cores distintas
                  X.fillStyle='#160d06'; X.fillRect(8,0,2,T); X.fillRect(16,0,2,T); X.fillRect(24,0,2,T);
                  X.fillStyle='#201408'; X.fillRect(9,0,7,T);
                  X.fillStyle='#181005'; X.fillRect(17,0,7,T);
                  // Nós na madeira
                  if((x*5+y*3)%9===0){X.fillStyle='#100a03';X.beginPath();X.arc(6,16,3,0,Math.PI*2);X.fill();X.fillStyle='#180d05';X.beginPath();X.arc(6,16,1.5,0,Math.PI*2);X.fill();}
                  if((x*7+y*5)%11===0){X.fillStyle='#100a03';X.beginPath();X.arc(22,10,2,0,Math.PI*2);X.fill();}
                  // Juntas das tábuas
                  X.fillStyle='#100a03'; X.fillRect(0,0,8,1); X.fillRect(18,T/2,6,1);
                  // Sombra de parede
                  if(map[y-1]&&map[y-1][x]===5){X.fillStyle='rgba(0,0,0,0.7)';X.fillRect(0,0,T,16);}
                  // Mancha de umidade
                  if((x*9+y*7)%13===0){X.fillStyle='rgba(0,0,0,0.35)';X.fillRect(8,14,10,8);}
              } else if(t === 7) {
                  // BUNKER / INTERIOR ESCURO
                  X.fillStyle='#050508'; X.fillRect(0,0,T,T);
                  if((x+y)%2===0){X.fillStyle='#090912';X.fillRect(0,0,T/2,T/2);X.fillRect(T/2,T/2,T/2,T/2);}
              } else if(t === 8) {
                  // PISTA DE POUSO - asfalto com marcas amarelas e rachaduras
                  X.fillStyle='#181818'; X.fillRect(0,0,T,T);
                  if((x+y)%2===0){X.fillStyle='#141414';X.fillRect(0,0,T,T);}
                  if(x%3!==0){X.fillStyle='#4a3800';X.fillRect(13,0,6,T);} // marcação central
                  X.fillStyle='#282828'; X.fillRect(0,0,2,T); X.fillRect(T-2,0,2,T); // bordas
                  if((x*7+y*3)%9===0){X.fillStyle='#101010';X.fillRect(5,13,14,1);} // rachados
                  if((x*5+y*11)%15===0){X.fillStyle='rgba(60,0,0,0.4)';X.fillRect(8,8,8,8);}
              } else if(t === 9) {
                  // PORTA - moldura com profundidade e batente
                  X.fillStyle='#080608'; X.fillRect(0,0,T,T);
                  X.fillStyle='#1a1a1e'; X.fillRect(0,0,6,T); X.fillRect(T-6,0,6,T);
                  X.fillStyle='#050406'; X.fillRect(6,0,T-12,T);
                  X.fillStyle='#262218'; X.fillRect(6,T-6,T-12,6);
                  if(map[y-1]&&map[y-1][x]===5){X.fillStyle='rgba(0,0,0,0.92)';X.fillRect(0,0,T,16);}
              } else if(t === 10) {
                  // CAIS / DOCA - tábuas molhadas com reflexo de água
                  X.fillStyle='#181008'; X.fillRect(0,0,T,T);
                  X.fillStyle='#120e06'; X.fillRect(8,0,2,T); X.fillRect(16,0,2,T); X.fillRect(24,0,2,T);
                  X.fillStyle='rgba(25,55,80,0.4)'; X.fillRect(0,0,T,T);
                  const shine=Math.sin(animTick*0.06+x+y)*3;
                  X.fillStyle='rgba(80,150,190,0.12)'; X.fillRect(0,12+shine,T,3);
                  X.fillStyle='#0a0806';
                  if((x+y)%2===0){X.fillRect(4,4,2,2);X.fillRect(26,26,2,2);}else{X.fillRect(4,26,2,2);X.fillRect(26,4,2,2);}
              }
              X.restore();
          }
      }
  }


  for(let y=Math.floor(camY/T); y<Math.ceil((camY+GH)/T); y++) {
      for(let x=Math.floor(camX/T); x<Math.ceil((camX+GW)/T); x++) {
          if(map[y]&&map[y][x]===5 && map[y+1] && [2,3,4].includes(map[y+1][x])) { X.fillStyle='rgba(0,0,0,0.4)'; X.fillRect(x*T-camX, (y+1)*T-camY, T, 10); }
      }
  }


  interactables.forEach(inter => {
      const ix = inter.x*T-camX+16, iy = inter.y*T-camY+24;
      X.font='28px serif'; X.textAlign='center'; X.fillText(inter.icon, ix, iy);
      if(dist(px,py,inter.x*T+16,inter.y*T+16)<45 && !phide) { X.fillStyle='#ffaa00'; X.font='bold 14px monospace'; X.fillText('[E] ' + inter.name, ix, iy - 25); }
      X.textAlign='left';
  });


  notes.forEach(n=>{
      // Papel ensanguentado no chão
      X.fillStyle='#e8d8a0'; X.fillRect(n.x*T-camX+6, n.y*T-camY+6, 20, 20);
      X.fillStyle='rgba(140,0,0,0.5)'; X.fillRect(n.x*T-camX+8, n.y*T-camY+8, 12, 3); X.fillRect(n.x*T-camX+10, n.y*T-camY+14, 8, 2); X.fillRect(n.x*T-camX+9, n.y*T-camY+18, 10, 2);
      X.strokeStyle='rgba(100,70,20,0.6)'; X.lineWidth=1; X.strokeRect(n.x*T-camX+6, n.y*T-camY+6, 20, 20);
      if(dist(px,py,n.x*T+16,n.y*T+16)<40 && !phide) { X.fillStyle='#ffe080'; X.font='bold 12px monospace'; X.textAlign='center'; X.fillText('[E] Ler nota', n.x*T-camX+16, n.y*T-camY-6); X.textAlign='left'; }
  });


  // Armários (desenho pixel art)
  drawWardrobes();


  items.forEach(it=>{if(!it.got){
      const ix = it.x*T-camX+16, iy = it.y*T-camY+24; const float = Math.sin(animTick*0.1 + it.x)*4;
      X.font='28px serif'; X.textAlign='center'; X.fillText(it.icon, ix, iy + float);
      if(dist(px,py,it.x*T+16,it.y*T+16)<40 && !phide) { X.fillStyle='#fff'; X.font='14px monospace'; X.fillText('[E]', ix, iy + float - 25); }
      X.textAlign='left';
  }});


  const boatX = 40*T-camX, boatY = 56*T-camY;
  X.fillStyle='#3a2a1a'; X.fillRect(boatX-24, boatY, 48, 18); X.fillStyle='#2a1a0a'; X.fillRect(boatX-24, boatY+14, 48, 4); X.fillStyle='#555'; X.fillRect(boatX+16, boatY-4, 8, 8);
  const planeX = 60*T+16-camX, planeY = 10*T+16-camY;
  X.fillStyle='#444'; X.fillRect(planeX-40, planeY-10, 80, 22); X.fillStyle='#333'; X.fillRect(planeX+20, planeY-12, 12, 26); X.fillStyle='#555'; X.fillRect(planeX-10, planeY-40, 20, 80);


  particles.forEach(p => { X.globalAlpha = p.life; X.fillStyle = p.color; X.fillRect(p.x-camX, p.y-camY, 4, 4); }); X.globalAlpha = 1.0;


  // Iluminação (Corrigido: agora não apaga mais o mapa por baixo!)
  const hasLantern = inventory.includes('lantern');
  X.save();
  
  const flicker = Math.random() * 3;
  const rad = hasLantern ? 280 + flicker : 130 + flicker;
  const inRad = hasLantern ? 90 : 25;
  
  // Se tem a lanterna, a escuridão geral do mapa fica mais suave
  const baseDark = hasLantern ? 'rgba(15, 15, 20, 0.45)' : Pal.crepuscule;
  const isChase = vstate==='chase' && animTick%20<10;
  const outerColor = isChase ? 'rgba(80,0,0,0.65)' : baseDark;
  const innerColor = isChase ? 'rgba(80,0,0,0)' : 'rgba(0,0,0,0)';
  const midColor = isChase ? 'rgba(80,0,0,0.15)' : 'rgba(0,0,0,0.15)';
  
  // Gradiente radial da escuridão: transparente no meio e escuro nas bordas
  const grd = X.createRadialGradient(px-camX, py-camY, inRad, px-camX, py-camY, rad);
  grd.addColorStop(0, innerColor);
  grd.addColorStop(0.6, midColor);
  grd.addColorStop(1, outerColor);
  
  X.fillStyle = grd;
  X.fillRect(0,0,GW,GH);
  
  // Se tem a lanterna, adiciona um leve brilho amarelado por cima (sem embaçar)
  if (hasLantern) {
      X.globalCompositeOperation = 'overlay';
      const glowGrd = X.createRadialGradient(px-camX, py-camY, 40, px-camX, py-camY, rad);
      glowGrd.addColorStop(0, 'rgba(255,240,180,0.35)');
      glowGrd.addColorStop(1, 'rgba(255,240,180,0)');
      X.fillStyle = glowGrd;
      X.beginPath(); X.arc(px-camX, py-camY, rad, 0, Math.PI*2); X.fill();
  }
  
  X.restore();


  // Nevoeiro
  X.save(); X.globalAlpha = 0.12; X.fillStyle='#99a';
  for(let i=0; i<4; i++) {
      const fx = (animTick*1.5 + i*250) % (GW+500) - 250; const fy = Math.sin(animTick*0.02 + i)*20;
      X.beginPath(); X.ellipse(fx, 150+i*120 + fy, 250, 80, 0, 0, Math.PI*2); X.fill();
  }
  X.restore();


  if(!phide && playerState !== 'grabbed') drawDetailedEntity(px, py, pdir, 'player', pmoving);
  drawDetailedEntity(vx, vy, vdir, 'villain', true);
 
  // Draw Minions
  minions.forEach(m => {
      drawDetailedEntity(m.x, m.y, 0, 'minion', m.state!=='stunned');
      if (playerState === 'grabbed' && grabber === m) {
          // Animação de ser carregado (personagem se debatendo)
          const struggleX = Math.sin(animTick)*5;
          drawDetailedEntity(m.x + struggleX, m.y - 12, pdir, 'player', true);
      }
  });


  // HUD & QTE
  if(playerState === 'grabbed') {
      X.fillStyle='rgba(50,0,0,0.6)'; X.fillRect(0,0,GW,GH); // Fundo sangrento
      X.fillStyle='#fff'; X.font='bold 36px serif'; X.textAlign='center';
      X.fillText('VOCÊ FOI CAPTURADO!', GW/2, GH/2 - 60);
      X.fillStyle = Math.sin(animTick*0.3)>0 ? '#f00' : '#fff';
      X.fillText('ESMAGUE [ESPAÇO] PARA FUGIR!', GW/2, GH/2);
     
      // Barra de progresso do QTE
      X.fillStyle='#222'; X.fillRect(GW/2 - 150, GH/2 + 30, 300, 30);
      X.fillStyle='#0f0'; X.fillRect(GW/2 - 150, GH/2 + 30, qteProgress * 3, 30);
      X.strokeStyle='#fff'; X.lineWidth=3; X.strokeRect(GW/2 - 150, GH/2 + 30, 300, 30);
      X.textAlign='left';
  } else {
      const barW = 380, barX = GW/2 - barW/2, barY = GH - 80;
      X.fillStyle='rgba(25,15,10,0.95)'; X.fillRect(barX, barY, barW, 56); X.strokeStyle=Pal.rust; X.lineWidth=3; X.strokeRect(barX, barY, barW, 56);
      for(let i=0; i<6; i++) {
          const slotX = barX + 16 + i * 60; X.fillStyle='rgba(0,0,0,0.8)'; X.fillRect(slotX, barY + 8, 40, 40); X.strokeStyle='#4a3a2a'; X.lineWidth=2; X.strokeRect(slotX, barY + 8, 40, 40);
          if(inventory[i]) { const it = items.find(t=>t.id===inventory[i]) || {icon: '✔️'}; X.font='26px serif'; X.textAlign='center'; X.fillText(it.icon, slotX + 20, barY + 36); }
      }
      X.textAlign='left';
      X.fillStyle='rgba(20,10,10,0.9)'; X.fillRect(20,20,220,50); X.strokeStyle=Pal.rust; X.lineWidth=2; X.strokeRect(20,20,220,50);
      X.fillStyle='#300'; X.fillRect(30,42,200,12); X.fillStyle='#c00'; X.fillRect(30,42,pstam*2,12); X.fillStyle='#fff'; X.font='bold 12px monospace'; X.fillText('VITALIDADE / FOLEGO', 30, 36);
      if(msgT>0){ msgT--; X.fillStyle='#fff'; X.textAlign='center'; X.font='bold 16px monospace'; X.fillText(msg, GW/2, GH-100); }
      if(loreT>0){ loreT--; X.fillStyle='rgba(0,0,0,0.7)'; X.fillRect(GW/2-300, 60, 600, 60); X.fillStyle='#f00'; X.font='bold 16px Courier New'; X.textAlign='center'; X.fillText(loreMsg, GW/2, 95); }
  }


  // --- MINIMAP ---
  drawMinimap();


  // --- INVENTÁRIO EXPANDIDO ---
  if(showInventory) drawInventoryScreen();


  // --- TELA DE LEITURA DE NOTA ---
  if(activeNote) drawNoteScreen(activeNote);


  X.restore();
}


function drawNoteScreen(note) {
  // Escurecer fundo
  X.fillStyle='rgba(0,0,0,0.75)'; X.fillRect(0,0,GW,GH);


  // Papel amarelado levemente rotacionado
  const pw=520, ph=420, px2=GW/2-pw/2, py2=GH/2-ph/2;
  X.save();
  X.translate(GW/2, GH/2);
  X.rotate(Math.sin(animTick*0.02)*0.008); // leve trêmulo
  X.translate(-GW/2, -GH/2);


  // Sombra do papel
  X.shadowBlur=40; X.shadowColor='rgba(0,0,0,0.8)';
  X.fillStyle='#c8b88a'; X.fillRect(px2,py2,pw,ph);
  X.shadowBlur=0;


  // Textura de papel (manchas e dobras)
  X.fillStyle='rgba(0,0,0,0.06)'; X.fillRect(px2,py2,pw,8); // borda topo
  X.fillStyle='rgba(0,0,0,0.04)';
  for(let li=0;li<8;li++) X.fillRect(px2,py2+li*54,pw,1); // linhas de dobra
  // Manchas de sangue
  X.fillStyle='rgba(120,0,0,0.18)'; X.fillRect(px2+pw-80,py2,80,60);
  X.fillStyle='rgba(100,0,0,0.12)'; X.fillRect(px2+10,py2+ph-50,60,50);
  X.fillStyle='rgba(150,0,0,0.08)';
  X.beginPath(); X.arc(px2+pw-40,py2+30,25,0,Math.PI*2); X.fill();


  // Borda rasgada (efeito pixel art)
  X.strokeStyle='rgba(100,80,50,0.5)'; X.lineWidth=3;
  X.strokeRect(px2+4,py2+4,pw-8,ph-8);
  X.strokeStyle='rgba(80,60,30,0.3)'; X.lineWidth=1;
  X.strokeRect(px2+8,py2+8,pw-16,ph-16);


  // Ícone e Título
  X.font='22px serif'; X.textAlign='left'; X.fillStyle='#3a1a0a';
  X.fillText(note.icon||'📜', px2+22, py2+40);
  X.fillStyle='#8a0000'; X.font='bold 18px "Courier New"';
  X.fillText(note.title||'', px2+52, py2+40);


  // Linha divisória ornamentada
  X.strokeStyle='rgba(100,60,20,0.6)'; X.lineWidth=2;
  X.beginPath(); X.moveTo(px2+20,py2+56); X.lineTo(px2+pw-20,py2+56); X.stroke();
  X.fillStyle='#7a3010'; X.font='12px serif'; X.textAlign='center';
  X.fillText('✦', GW/2, py2+52);


  // Conteúdo com quebra de linha automática
  X.fillStyle='#2a1505'; X.font='14px "Courier New"'; X.textAlign='left';
  const lines = (note.content||'').split('\n');
  let lineY = py2 + 80;
  lines.forEach(rawLine => {
    // Quebrar linha se muito longa
    const words = rawLine.split(' '); let cLine = '';
    if(rawLine === '') { lineY += 6; return; }
    words.forEach(word => {
      const test = cLine + (cLine?` ${word}`:word);
      if(X.measureText(test).width > pw - 60) {
        X.fillText(cLine, px2+24, lineY);
        cLine = word; lineY += 19;
      } else cLine = test;
    });
    if(cLine) { X.fillText(cLine, px2+24, lineY); lineY += 19; }
  });


  // Instrução fechar (piscante)
  const blink = Math.sin(animTick*0.1)>0;
  X.fillStyle=blink?'rgba(120,30,0,0.9)':'rgba(80,20,0,0.6)';
  X.font='bold 12px monospace'; X.textAlign='center';
  X.fillText('[ E ] ou [ ESC ] — fechar', GW/2, py2+ph-14);


  X.restore();
}


function drawMinimap() {
  const MM = 160; // tamanho
  const MX = GW - MM - 10, MY = 10;
  // Fundo
  X.fillStyle='rgba(0,0,0,0.75)'; X.fillRect(MX-2, MY-2, MM+4, MM+4);
  X.strokeStyle=Pal.rust; X.lineWidth=2; X.strokeRect(MX-2, MY-2, MM+4, MM+4);
  // Título
  X.fillStyle='#aaa'; X.font='bold 9px monospace'; X.textAlign='left';
  X.fillText('MINIMAPA  [I]=inventário', MX, MY-4);
  // Tiles
  const scale = MM / (MW * T);
  for(let ty=0; ty<MH; ty++) {
    for(let tx2=0; tx2<MW; tx2++) {
      const t=map[ty][tx2];
      if(t===0) continue;
      const mmColors={1:'#5a4a30',2:'#252f15',3:'#3a2a1a',4:'#500',5:'#2a2a2e',6:'#3a2d25',7:'#050508',8:'#333',9:'#222',10:'#2a1a10'};
      X.fillStyle=mmColors[t]||'#252f15';
      X.fillRect(MX+tx2*MM/MW, MY+ty*MM/MH, Math.ceil(MM/MW)+0.5, Math.ceil(MM/MH)+0.5);
    }
  }
  // Itens não coletados
  items.forEach(it=>{ if(!it.got){ X.fillStyle='#ff0'; X.fillRect(MX+it.x*MM/MW-1, MY+it.y*MM/MH-1, 3,3); } });
  // Vilão
  X.fillStyle='#f00'; X.beginPath(); X.arc(MX+vx/T*MM/MW, MY+vy/T*MM/MH, 3, 0, Math.PI*2); X.fill();
  // Capangas
  minions.forEach(m=>{ X.fillStyle='#fa0'; X.fillRect(MX+m.x/T*MM/MW-1, MY+m.y/T*MM/MH-1, 2, 2); });
  // Jogador
  X.fillStyle='#4af'; X.beginPath(); X.arc(MX+px/T*MM/MW, MY+py/T*MM/MH, 3, 0, Math.PI*2); X.fill();
  // Legenda
  X.font='8px monospace'; X.textAlign='left';
  X.fillStyle='#4af'; X.fillText('● Você', MX, MY+MM+10);
  X.fillStyle='#f00'; X.fillText('● Vilão', MX+40, MY+MM+10);
  X.fillStyle='#fa0'; X.fillText('● Capanga', MX+80, MY+MM+10);
  X.fillStyle='#ff0'; X.fillText('★ Item', MX+130, MY+MM+10);
}


function drawWardrobes() {
  wardrobes.forEach(w => {
    const wx = w.x*T - camX, wy = w.y*T - camY;
    const isOccupied = w.open;
    const isNear = !phide && dist(px,py,w.x*T+16,w.y*T+16) < 40;


    // Sombra do armário
    X.fillStyle='rgba(0,0,0,0.45)';
    X.fillRect(wx+4, wy+T-4, T-4, 6);


    // Corpo principal (madeira escura)
    const woodColor = w.label.includes('Metálico')||w.label.includes('Ferro')||w.label.includes('Aço') ? '#3a3a40' : '#2a1a10';
    const woodLight = w.label.includes('Metálico')||w.label.includes('Ferro')||w.label.includes('Aço') ? '#4a4a52' : '#3a2218';
    X.fillStyle=woodColor; X.fillRect(wx+2, wy+2, T-4, T-2);


    // Topo iluminado (efeito 3D)
    X.fillStyle=woodLight; X.fillRect(wx+2, wy+2, T-4, 5);


    // Divisor central (2 portas)
    X.fillStyle='rgba(0,0,0,0.5)'; X.fillRect(wx+T/2-1, wy+4, 2, T-6);


    // Painel interno das portas (rebaixado)
    X.fillStyle='rgba(0,0,0,0.25)';
    X.fillRect(wx+4, wy+7, T/2-7, T-12);
    X.fillRect(wx+T/2+3, wy+7, T/2-7, T-12);


    // Puxadores dourados
    X.fillStyle=isOccupied ? '#888' : '#c8a030';
    X.fillRect(wx+T/2-5, wy+T/2-2, 4, 4);
    X.fillRect(wx+T/2+1, wy+T/2-2, 4, 4);


    // Se a porta está aberta: mostrar fresta escura animada
    if(isOccupied) {
      const doorAnim = Math.abs(Math.sin(animTick*0.08))*6;
      X.fillStyle='rgba(0,0,0,0.9)';
      X.fillRect(wx+2, wy+2, doorAnim, T-2); // fresta esquerda abrindo
      X.fillRect(wx+T-2-doorAnim, wy+2, doorAnim, T-2); // fresta direita
      // Silhueta do jogador escondido
      X.fillStyle='rgba(0,0,0,0.6)';
      X.fillRect(wx+T/2-4, wy+T-20, 8, 16);
      X.fillRect(wx+T/2-3, wy+T-30, 6, 10);
    }


    // Borda do armário
    X.strokeStyle= isOccupied ? '#c00' : (isNear ? '#ffcc00' : 'rgba(0,0,0,0.4)');
    X.lineWidth = isNear ? 2 : 1;
    X.strokeRect(wx+2, wy+2, T-4, T-2);


    // Rachados e textura de madeira
    X.fillStyle='rgba(0,0,0,0.15)';
    if((w.x*3+w.y*7)%5===0) X.fillRect(wx+6, wy+10, 1, 15);
    if((w.x*5+w.y*3)%7===0) X.fillRect(wx+T-9, wy+14, 1, 12);


    // Prompt [E]
    if(isNear) {
      X.fillStyle='rgba(0,0,0,0.7)'; X.fillRect(wx-10, wy-26, 52, 18);
      X.fillStyle='#ffe080'; X.font='bold 11px monospace'; X.textAlign='center';
      X.fillText('[E] ' + (phide ? 'Sair' : 'Esconder'), wx+T/2, wy-12);
      X.textAlign='left';
    }


    // Indicação de estado quando escondido
    if(isOccupied) {
      const pulse = Math.sin(animTick*0.12)*0.3+0.7;
      X.fillStyle=`rgba(200,0,0,${pulse*0.5})`;
      X.fillRect(wx, wy-6, T, 4); // barra vermelha no topo indicando ocupado
      X.fillStyle=`rgba(255,80,80,${pulse})`; X.font='bold 9px monospace'; X.textAlign='center';
      X.fillText('ESCONDIDO', wx+T/2, wy-1);
      X.textAlign='left';
    }
  });
}


function drawInventoryScreen() {
  // Overlay
  X.fillStyle='rgba(0,0,0,0.85)'; X.fillRect(0,0,GW,GH);
  X.fillStyle='rgba(30,15,10,0.98)'; X.fillRect(100,50,600,500);
  X.strokeStyle=Pal.rust; X.lineWidth=3; X.strokeRect(100,50,600,500);
  X.strokeStyle='#2a1a10'; X.lineWidth=1;
  X.strokeRect(104,54,592,492);
  // Título
  X.fillStyle='#c00'; X.font='bold 24px serif'; X.textAlign='center';
  X.fillText('⚔ INVENTÁRIO DE SOBREVIVENTE ⚔', GW/2, 88);
  X.fillStyle='#4a2a1a'; X.fillRect(110,94,580,2);
  // Itens coletados
  const allItems = [
    {id:'key',name:'Chave Enferrujada',icon:'🗝️',desc:'Abre a corrente do barco.',req:'Cofre (senha 1984)'},
    {id:'fuel',name:'Galão de Óleo',icon:'⛽',desc:'Combustível para o barco ou avião.',req:'Trava Eletrônica (ligue o gerador)'},
    {id:'tools',name:'Ferramentas',icon:'🧰',desc:'Repara o motor do barco ou avião.',req:'Vinha de Carne (precisa do cutelo)'},
    {id:'machete',name:'Cutelo de Açougueiro',icon:'🔪',desc:'Corta as vinhas. Útil em combate.',req:'Cadáver Mutante (50 de stamina)'},
    {id:'radio',name:'Rádio Militar',icon:'📻',desc:'Chama resgate. Fuga alternativa.',req:'Casa Nordeste'},
    {id:'lantern',name:'Lanterna Pesada',icon:'🔦',desc:'Ilumina um raio muito maior à noite.',req:'Próximo ao cais'}
  ];
  const puzzleItems = [
    {name:'Cofre Trancado',icon:'🗄️',done:sysVars.safeOpen,hint:sysVars.knowsCode?'Senha descoberta':'Precisa da nota com senha'},
    {name:'Gerador',icon:'⚙️',done:sysVars.genOn,hint:'Casa Sudeste - 30 de stamina'},
    {name:'Trava Eletrônica',icon:'🔒',done:inventory.includes('fuel'),hint:'Ligue o gerador primeiro'},
    {name:'Vinha de Carne',icon:'🕸️',done:inventory.includes('tools'),hint:'Precisa do cutelo'},
    {name:'Cadáver Mutante',icon:'🧟',done:inventory.includes('machete'),hint:'50 de stamina'},
  ];
  X.textAlign='left';
  X.fillStyle='#aaa'; X.font='bold 12px monospace'; X.fillText('ITENS COLETADOS:', 120, 118);
  allItems.forEach((it,i)=>{
    const col=i%3, row=Math.floor(i/3);
    const ix=120+col*195, iy=130+row*110;
    const have=inventory.includes(it.id);
    X.fillStyle=have?'rgba(0,60,0,0.5)':'rgba(0,0,0,0.5)';
    X.fillRect(ix,iy,185,100);
    X.strokeStyle=have?'#2a6a2a':'#3a2a1a'; X.lineWidth=2; X.strokeRect(ix,iy,185,100);
    X.font='32px serif'; X.textAlign='center'; X.fillText(it.icon,ix+92,iy+40);
    X.fillStyle=have?'#8f8':'#666'; X.font='bold 11px monospace';
    X.fillText(it.name,ix+92,iy+58);
    X.fillStyle='#999'; X.font='9px monospace';
    X.fillText(it.desc,ix+92,iy+72);
    X.fillStyle=have?'#4f4':'#555'; X.font='bold 10px monospace';
    X.fillText(have?'✔ COLETADO':'✗ '+it.req,ix+92,iy+88);
  });
  // Status dos Puzzles
  X.fillStyle='#4a2a1a'; X.fillRect(110,360,580,2);
  X.fillStyle='#aaa'; X.font='bold 12px monospace'; X.textAlign='left'; X.fillText('STATUS DOS PUZZLES:', 120, 378);
  puzzleItems.forEach((p,i)=>{
    const px2=120+i*115, py2=388;
    X.fillStyle=p.done?'rgba(0,50,0,0.6)':'rgba(40,0,0,0.5)';
    X.fillRect(px2,py2,108,80);
    X.strokeStyle=p.done?'#2a5a2a':'#5a1a1a'; X.lineWidth=1; X.strokeRect(px2,py2,108,80);
    X.font='22px serif'; X.textAlign='center'; X.fillText(p.icon,px2+54,py2+28);
    X.fillStyle=p.done?'#4f4':'#f66'; X.font='bold 9px monospace';
    X.fillText(p.done?'✔ FEITO':'✗ PENDENTE',px2+54,py2+44);
    X.fillStyle='#777'; X.font='8px monospace';
    // Wrap text
    const words=p.hint.split(' '); let line='',lineY=py2+57;
    words.forEach(w=>{ if((line+w).length>14){X.fillText(line,px2+54,lineY);line=w+' ';lineY+=11;}else line+=w+' '; });
    X.fillText(line,px2+54,lineY);
  });
  // Fechar
  X.fillStyle='#888'; X.font='bold 13px monospace'; X.textAlign='center';
  X.fillText('[ I ] — FECHAR INVENTÁRIO', GW/2, 530);
}


function handleMenuInput(code) {
    if(code==='ArrowUp' || code==='KeyW') diffIdx = (diffIdx + 2) % 3;
    if(code==='ArrowDown' || code==='KeyS') diffIdx = (diffIdx + 1) % 3;
    difficulty = diffs[diffIdx];
    if(code==='Enter' || code==='NumpadEnter') { initAudio(); state='play'; resetGame(); }
}


function drawMenu(){
  X.fillStyle='#060609'; X.fillRect(0,0,GW,GH);


  // Fundo animado: neblina pulsante em camadas
  const t0 = animTick;
  for(let i=0;i<6;i++){
      const bx=(Math.sin(t0*0.008+i*1.2)*400+GW/2), by=(Math.cos(t0*0.006+i)*200+GH/2);
      const gr=X.createRadialGradient(bx,by,0,bx,by,220+i*30);
      gr.addColorStop(0,`rgba(${80+i*10},0,0,0.08)`);
      gr.addColorStop(1,'rgba(0,0,0,0)');
      X.fillStyle=gr; X.fillRect(0,0,GW,GH);
  }


  // Partículas de sangue caindo
  X.fillStyle='rgba(150,0,0,0.7)';
  for(let i=0;i<30;i++){
      const bpx=(i*137+animTick*0.4*(i%3===0?1.5:1))%(GW+40)-20;
      const bpy=(animTick*0.6*(1+i*0.03)+i*80)%(GH+20)-10;
      X.fillRect(bpx,bpy,2,6+i%5);
  }


  // Sombra título
  X.textAlign='center';
  X.shadowBlur=40; X.shadowColor=`rgba(255,0,0,${0.5+Math.sin(t0*0.05)*0.3})`;
  X.fillStyle='#7a0000'; X.font='bold 78px serif';
  X.fillText('ILHA DA AGONIA', GW/2+3, 173);
  // Título principal com glow pulsante
  const glow = 0.7+Math.sin(t0*0.04)*0.3;
  X.shadowBlur=30*glow; X.shadowColor=`rgba(220,0,0,${glow})`;
  X.fillStyle=`rgb(${180+Math.sin(t0*0.04)*40},0,0)`;
  X.font='bold 76px serif'; X.fillText('ILHA DA AGONIA', GW/2, 170);
  X.shadowBlur=0;


  // Subtítulo
  X.fillStyle='rgba(180,60,60,0.8)'; X.font='italic 16px serif';
  X.fillText('— Nenhum sobrevivente voltou para contar —', GW/2, 202);


  // Linha decorativa
  X.strokeStyle='#4a1010'; X.lineWidth=1;
  X.beginPath(); X.moveTo(80,220); X.lineTo(GW-80,220); X.stroke();
  X.fillStyle='#8a0000'; X.font='14px serif';
  X.fillText('✦', GW/2, 224);


  // Seleção de Dificuldade
  X.fillStyle='rgba(180,80,80,0.9)'; X.font='bold 14px monospace';
  X.fillText('◈  ESCOLHA SUA CONDENAÇÃO  ◈', GW/2, 265);
  const diffColors=['#44aa44','#cc8800','#dd0000'];
  const diffDesc=['Inimigos lentos. Regeneração alta.','Desafio padrão. Sem piedade.','Inimigos letais. Sem misericórdia.'];
  diffs.forEach((d, i)=>{
      const isSel = i === diffIdx;
      const by2 = 305 + i*62;
      if(isSel){
          X.fillStyle='rgba(80,0,0,0.6)'; X.fillRect(GW/2-170,by2-28,340,54);
          X.strokeStyle=diffColors[i]; X.lineWidth=2; X.strokeRect(GW/2-170,by2-28,340,54);
      }
      X.fillStyle=isSel?diffColors[i]:'#444';
      X.font=isSel?'bold 26px monospace':'20px monospace';
      X.fillText((isSel?'▶ ':'  ')+d.toUpperCase(), GW/2, by2);
      if(isSel){ X.fillStyle='rgba(180,100,100,0.8)'; X.font='11px monospace'; X.fillText(diffDesc[i], GW/2, by2+18); }
  });


  // Painel de controles estilizado
  X.fillStyle='rgba(20,10,8,0.9)'; X.fillRect(GW/2-210,500,420,72);
  X.strokeStyle='#3a1a0a'; X.lineWidth=2; X.strokeRect(GW/2-210,500,420,72);
  X.fillStyle='#6a3a2a'; X.font='bold 11px monospace'; X.fillText('— CONTROLES —', GW/2, 520);
  X.fillStyle='#aaa'; X.font='11px monospace';
  X.fillText('WASD · Mover       SHIFT · Correr       E · Interagir', GW/2, 540);
  X.fillText('I · Inventário     ESPAÇO · Fugir (QTE)    ENTER · Iniciar', GW/2, 558);


  // Pulso ENTER
  const pulse2 = Math.sin(t0*0.08);
  X.fillStyle=`rgba(255,${100+pulse2*80},${100+pulse2*80},${0.8+pulse2*0.2})`;
  X.font=`bold 18px monospace`;
  X.fillText('[ ENTER ] — COMEÇAR', GW/2, 590);
  X.textAlign='left';
}


function drawGameOver(){
  // Fundo escuro com gradiente
  X.fillStyle='#000'; X.fillRect(0,0,GW,GH);
  const gr2=X.createRadialGradient(GW/2,GH/2,0,GW/2,GH/2,450);
  gr2.addColorStop(0,'rgba(80,0,0,0.6)'); gr2.addColorStop(1,'rgba(0,0,0,0)');
  X.fillStyle=gr2; X.fillRect(0,0,GW,GH);


  // Chuva de sangue
  X.fillStyle='rgba(160,0,0,0.75)';
  for(let i=0;i<50;i++){
      const rx=(i*97+animTick*1.2*(1+i%3*0.3))%(GW+40)-20;
      const ry=(animTick*1.5*(0.8+i%4*0.2)+i*60)%(GH+30);
      X.fillRect(rx,ry,2,12+i%8);
  }


  // Pares de olhos fantasmagóricos no fundo
  const eyeData=[[150,150],[600,200],[80,400],[680,350],[300,500],[520,480]];
  eyeData.forEach(([ex,ey],ei)=>{
      const eblink=Math.sin(animTick*0.06+ei*1.3);
      if(eblink>-0.9){
          X.shadowBlur=15; X.shadowColor='#f00';
          X.fillStyle=`rgba(200,0,0,${0.3+eblink*0.2})`;
          X.beginPath(); X.ellipse(ex,ey,8,4*(0.5+eblink*0.5),0,0,Math.PI*2); X.fill();
          X.fillStyle='rgba(255,80,0,0.8)'; X.beginPath(); X.arc(ex,ey,2,0,Math.PI*2); X.fill();
          X.shadowBlur=0;
      }
  });


  // Título tremendo
  const tshake=Math.sin(animTick*0.3)*3;
  X.textAlign='center'; X.shadowBlur=30; X.shadowColor='#f00';
  X.fillStyle='#300'; X.font='bold 66px serif';
  X.fillText('VOCÊ MORREU', GW/2+tshake+3, 213);
  X.fillStyle='#cc0000'; X.font='bold 64px serif';
  X.fillText('VOCÊ MORREU', GW/2+tshake, 210);
  X.shadowBlur=0;


  // Mensagem sombria (rotativa)
  const msgs2=['A ilha absorveu sua alma.','O Espreitador venceu.','Ninguém ouviu seu grito.','Você foi o próximo esquecido.'];
  const mi=Math.floor(animTick/120)%msgs2.length;
  X.fillStyle='rgba(180,60,60,0.9)'; X.font='italic 18px serif';
  X.fillText(msgs2[mi], GW/2, 260);


  // Divisor de ossos
  X.strokeStyle='#4a0000'; X.lineWidth=1;
  X.beginPath(); X.moveTo(GW/2-200,285); X.lineTo(GW/2-10,285); X.stroke();
  X.beginPath(); X.moveTo(GW/2+10,285); X.lineTo(GW/2+200,285); X.stroke();
  X.fillStyle='#600'; X.font='20px serif'; X.fillText('✦', GW/2, 290);


  // Estatísticas
  X.fillStyle='rgba(20,5,5,0.85)'; X.fillRect(GW/2-200,310,400,130);
  X.strokeStyle='#5a1010'; X.lineWidth=2; X.strokeRect(GW/2-200,310,400,130);
  X.fillStyle='#993333'; X.font='bold 13px monospace'; X.fillText('— RELATÓRIO FINAL —', GW/2, 333);
  X.fillStyle='#bbb'; X.font='12px monospace';
  X.fillText(`Itens coletados: ${inventory.length} / 6`, GW/2, 358);
  X.fillText(`Puzzles resolvidos: ${[sysVars.safeOpen,sysVars.genOn,inventory.includes('fuel'),inventory.includes('tools'),inventory.includes('machete')].filter(Boolean).length} / 5`, GW/2, 378);
  X.fillText(`Dificuldade: ${difficulty}`, GW/2, 398);
  X.fillStyle='#666'; X.font='11px monospace';
  X.fillText('Progresso perdido. A ilha nunca esquece.', GW/2, 422);


  // Botão pulsante
  const p3=0.7+Math.sin(animTick*0.07)*0.3;
  X.fillStyle=`rgba(${Math.floor(180*p3)},0,0,${p3})`;
  X.font='bold 20px monospace'; X.fillText('[ ENTER ] — RENASCER DAS CINZAS', GW/2, 480);
  X.textAlign='left';
  if(keys['Enter']||keys['NumpadEnter']){state='play'; resetGame();}
}


function drawVictory(){
  if(!victoryTimer) victoryTimer=0; victoryTimer++;
  const vt=victoryTimer;


  // Fundo: Oceano ao amanhecer
  const sky=X.createLinearGradient(0,0,0,GH);
  sky.addColorStop(0,'#0a0a1e'); sky.addColorStop(0.4,'#1a1030'); sky.addColorStop(0.7,'#4a1a10'); sky.addColorStop(1,'#0a1520');
  X.fillStyle=sky; X.fillRect(0,0,GW,GH);


  // Ondas do oceano animadas
  for(let wi=0;wi<8;wi++){
      const wy=GH-80+wi*15;
      const wamp=10-wi;
      X.fillStyle=`rgba(20,${50+wi*8},${80+wi*10},${0.3+wi*0.08})`;
      X.beginPath(); X.moveTo(0,wy);
      for(let wx=0;wx<GW;wx+=10){
          X.lineTo(wx, wy+Math.sin((wx*0.02)+(vt*0.04)+wi)*wamp);
      }
      X.lineTo(GW,GH); X.lineTo(0,GH); X.closePath(); X.fill();
  }


  // Reflexo da lua no mar
  const moonY=80; X.fillStyle='rgba(255,255,200,0.9)';
  X.beginPath(); X.arc(GW/2,moonY,28,0,Math.PI*2); X.fill();
  X.fillStyle='rgba(255,255,150,0.15)';
  for(let ri=1;ri<6;ri++){X.beginPath();X.arc(GW/2,moonY,28+ri*15,0,Math.PI*2);X.fill();}
  // Reflexo no mar
  X.fillStyle='rgba(255,255,180,0.1)';
  X.fillRect(GW/2-15, GH-150, 30, 120);


  // Animação do barco/avião fugindo
  const escapeX = Math.min(GW+100, 100 + vt*2.5);
  // Barco
  if(victoryType==='Barco' || !victoryType){
      const boatY=GH-95+Math.sin(vt*0.05)*4;
      X.fillStyle='#3a2a1a'; X.fillRect(escapeX-30,boatY,60,18);
      X.fillStyle='#2a1a0a'; X.fillRect(escapeX-30,boatY+14,60,4);
      X.fillStyle='#ccc'; X.fillRect(escapeX-2,boatY-30,4,30); // mastro
      X.fillStyle='rgba(200,180,150,0.9)'; X.beginPath();
      X.moveTo(escapeX+2,boatY-30); X.lineTo(escapeX+24,boatY-14); X.lineTo(escapeX+2,boatY-2); X.closePath(); X.fill();
      // Jogador no barco
      X.fillStyle='#ffdbac'; X.fillRect(escapeX-4,boatY-18,8,8);
      X.fillStyle='#40a0ff'; X.fillRect(escapeX-5,boatY-10,10,10);
      X.fillStyle='#3a2a1a'; X.fillRect(escapeX-6,boatY-21,12,5);
      // Esteira de ondas
      for(let si=0;si<6;si++){
          X.fillStyle=`rgba(100,160,200,${0.3-si*0.05})`;
          X.fillRect(escapeX-30-si*14,boatY+10,10,2+si);
      }
  }
  // Avião
  if(victoryType==='Avião'){
      const plY=200+Math.sin(vt*0.03)*8;
      X.fillStyle='#555'; X.fillRect(escapeX-50,plY-10,100,20);
      X.fillStyle='#444'; X.fillRect(escapeX+24,plY-12,14,24);
      X.fillStyle='#666'; X.fillRect(escapeX-12,plY-40,24,80);
      // Rastro de fumaça
      for(let si=0;si<10;si++){
          X.fillStyle=`rgba(200,200,200,${0.15-si*0.01})`;
          X.beginPath(); X.arc(escapeX-50-si*18,plY,6+si,0,Math.PI*2); X.fill();
      }
  }


  // Fogos de artifício!
  if(vt%30<2){
      particles.push(...[...Array(20)].map(()=>({
          x:Math.random()*GW, y:GH/2,
          vx:(Math.random()-0.5)*200, vy:-Math.random()*150-50,
          life:1.0, color:`hsl(${Math.random()*60+30},100%,70%)`
      })));
  }
  particles.forEach(p=>{ X.globalAlpha=p.life; X.fillStyle=p.color; X.fillRect(p.x,p.y,4,4); });
  X.globalAlpha=1;


  // Estrelas
  X.fillStyle='#fff';
  for(let si=0;si<40;si++){
      const sbr=Math.sin(vt*0.05+si)*0.5+0.5;
      X.globalAlpha=sbr*0.8;
      X.fillRect((si*137)%GW,(si*79)%200,1+(si%3===0?1:0),1+(si%3===0?1:0));
  }
  X.globalAlpha=1;


  // Textos que aparecem gradualmente
  X.textAlign='center';
  if(vt>30){
      const a1=Math.min(1,(vt-30)/40);
      X.globalAlpha=a1; X.shadowBlur=20; X.shadowColor='#ffaa00';
      X.fillStyle='#ffe080'; X.font='bold 56px serif';
      X.fillText('VOCÊ ESCAPOU!', GW/2, 320);
      X.shadowBlur=0;
  }
  if(vt>80){
      const a2=Math.min(1,(vt-80)/40);
      X.globalAlpha=a2;
      X.fillStyle='rgba(200,180,120,0.9)'; X.font='italic 20px serif';
      X.fillText(`Fuga via: ${victoryType||'Desconhecida'}`, GW/2, 360);
  }
  if(vt>130){
      const a3=Math.min(1,(vt-130)/40);
      X.globalAlpha=a3;
      X.fillStyle='rgba(150,200,150,0.9)'; X.font='14px monospace';
      X.fillText(`Itens: ${inventory.length}/6   Puzzles: ${[sysVars.safeOpen,sysVars.genOn,inventory.includes('fuel'),inventory.includes('tools'),inventory.includes('machete')].filter(Boolean).length}/5   Dificuldade: ${difficulty}`, GW/2, 400);
  }
  if(vt>200){
      const a4=0.6+Math.sin(vt*0.08)*0.4;
      X.globalAlpha=a4; X.fillStyle='#aaa'; X.font='bold 16px monospace';
      X.fillText('[ ENTER ] — VOLTAR AO MENU', GW/2, 450);
  }
  X.globalAlpha=1; X.textAlign='left';
  if(vt>200&&(keys['Enter']||keys['NumpadEnter'])){state='menu'; victoryTimer=0;}
}


function resetGame(){
  px=40*T+16;py=53*T+16;pdir=0;pstam=100;prun=false;phide=false;hideCD=0;
  vx=40*T+16;vy=20*T+16;vstate='patrol';vpi=0;vsearchT=0;vDashT=0;
  inventory=[]; items.forEach(i=>i.got=false); msg='';msgT=0; particles=[]; shake=0; loreT=0;
  sysVars = { knowsCode: false, safeOpen: false, genOn: false, altarDone: false, fuseFixed: false, weaponBoxOpen: false };
  playerState = 'normal'; grabber = null; qteProgress = 0; activeNote = null; showInventory = false; victoryTimer = 0;
  wardrobes.forEach(w => w.open = false);
  minions.forEach(m => { m.x = m.path[0].x * T + 16; m.y = m.path[0].y * T + 16; m.state = 'patrol'; m.pi = 0; });
}


let lastT=0;
function loop(t){
  const dt=Math.min((t-lastT)/1000,.05);lastT=t;
  if(state==='play'){updatePlayer(dt);updateMinions(dt);updateVillain(dt);updateParticles(dt);}
  if(state==='menu')drawMenu(); else if(state==='play')draw(); else if(state==='gameover')drawGameOver(); else if(state==='victory')drawVictory();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
