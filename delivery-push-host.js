(function(){
  'use strict';
  const frame=document.getElementById('appFrame'), STORE='mori-dp71-device-v1';
  let peer=null,peerOrigin='',peerNonce='',context=null,contextKey='',generation=0;
  let device=null,messaging=null,registration=null,sdkPromise=null;
  const waiting=new Map();
  let openInbox=new URL(location.href).searchParams.has('deliveryMessage');
  function random(bytes){return Array.from(crypto.getRandomValues(new Uint8Array(bytes)),function(b){return b.toString(16).padStart(2,'0');}).join('');}
  function persist(){localStorage.setItem(STORE,JSON.stringify(device));}
  try{
    device=JSON.parse(localStorage.getItem(STORE)||'null');
    if(!device || !/^[a-f0-9]{32}$/.test(device.deviceId) || !/^[a-f0-9]{64}$/.test(device.secret)){
      device={deviceId:random(16),secret:random(32),revision:0,opted:false};persist();
    }
  }catch(e){device=null;}
  function nextDevice(){device.revision=Math.max(Date.now(),Number(device.revision||0)+1);persist();return {
    deviceId:device.deviceId,secret:device.secret,revision:device.revision
  };}
  function fromApp(source){
    // GASはGoogleの外側フレーム内にさらにsandboxフレームを持つ。
    // originだけでなく、appFrameの子孫からの送信であることを確認する。
    try{for(let i=0;source&&i<8;i++){
      if(source===frame.contentWindow)return true;
      if(source.parent===source)break;source=source.parent;
    }}catch(e){}return false;
  }
  function trusted(event){
    try {const u=new URL(event.origin);return u.protocol==='https:' &&
      (u.hostname==='script.google.com'||u.hostname.endsWith('.googleusercontent.com'))&&fromApp(event.source);
    }catch(e){return false;}
  }
  const box=document.createElement('section');
  box.setAttribute('aria-label','連絡通知の設定');
  box.style.cssText='position:fixed;bottom:max(12px,env(safe-area-inset-bottom));left:12px;right:12px;max-width:430px;margin:auto;z-index:100000;background:white;color:#173b67;border:1px solid #b9cbdf;border-radius:12px;padding:12px;box-shadow:0 4px 22px #0003;font:14px/1.5 sans-serif;display:none;box-sizing:border-box';
  const caption=document.createElement('div'), note=document.createElement('div');note.setAttribute('role','status');
  const enable=document.createElement('button'),stop=document.createElement('button'),later=document.createElement('button');
  [enable,stop,later].forEach(function(b){b.type='button';b.style.cssText='min-height:44px;margin:8px 6px 0 0;padding:8px 12px;border-radius:8px;border:1px solid #b9cbdf;background:#fff;color:#173b67;font-size:14px';});
  enable.textContent='この端末で連絡通知を受け取る';enable.style.background='#173b67';enable.style.color='#fff';
  stop.textContent='この端末の通知を停止';later.textContent='閉じる';
  box.append(caption,note,enable,stop,later);document.body.append(box);
  const reopen=document.createElement('button');reopen.type='button';reopen.textContent='連絡通知設定';
  reopen.style.cssText='display:none;position:fixed;bottom:8px;left:8px;z-index:99997;min-height:36px;border:1px solid #b9cbdf;border-radius:8px;background:#fff;color:#173b67;font-size:12px';
  document.body.append(reopen);reopen.onclick=function(){box.style.display='block';};
  later.onclick=function(){box.style.display='none';};
  function say(text){note.textContent=text;}
  function rpc(action,data){
    const source=peer, origin=peerOrigin, nonce=peerNonce,id=random(12);
    return new Promise(function(resolve,reject){
      if(!source){reject(Error('運行画面を開いてください。'));return;}
      const timer=setTimeout(function(){waiting.delete(id);reject(Error('通信を確認して、もう一度お試しください。'));},30000);
      waiting.set(id,{source,nonce,resolve,reject,timer});
      source.postMessage({type:'DP71_ACTION',nonce,id,action,data},origin);
    });
  }
  function script(src){return new Promise(function(resolve,reject){
    const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=function(){reject(Error('通知ライブラリを読み込めませんでした。'));};document.head.append(s);
  });}
  function checkEnvironment(){
    if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw Error('この環境は通知に対応していません。iPhoneはSafariからホーム画面に追加して開いてください。');
    const isiOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    if(isiOS && !navigator.standalone && !matchMedia('(display-mode: standalone)').matches)throw Error('Safariの共有から「ホーム画面に追加」し、そのアイコンから開いてください。');
  }
  async function setup(){
    checkEnvironment();
    if(!sdkPromise)sdkPromise=(async function(){
      if(!window.firebase){await script('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');await script('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');}
      if(!(await firebase.messaging.isSupported()))throw Error('このブラウザは通知に対応していません。');
      firebase.initializeApp(MORI_PUSH_CONFIG.firebase);
      messaging=firebase.messaging();
      registration=await navigator.serviceWorker.register('./firebase-messaging-sw.js',{scope:'./',updateViaCache:'none'});
      if(!registration.active)await new Promise(function(resolve,reject){
        const w=registration.installing||registration.waiting;
        if(!w){reject(Error('通知の準備ができませんでした。'));return;}
        const t=setTimeout(function(){reject(Error('通知の準備がタイムアウトしました。'));},25000);
        w.addEventListener('statechange',function(){if(w.state==='activated'){clearTimeout(t);resolve();}else if(w.state==='redundant'){clearTimeout(t);reject(Error('通知の準備に失敗しました。'));}});
      });
      messaging.onMessage(function(payload){
        if(!payload.data||payload.data.kind!=='dm71')return;
        say('新しい連絡があります。アプリの「連絡を見る」を開いてください。');box.style.display='block';
        if(peer)peer.postMessage({type:'DP71_INCOMING',nonce:peerNonce},peerOrigin);
      });
    })().catch(function(e){sdkPromise=null;throw e;});
    return sdkPromise;
  }
  async function sync(ask){
    if(!device){say('端末の保存ができません。ブラウザの保存設定を確認してください。');return;}
    const gen=++generation,c=context;
    enable.disabled=true;stop.disabled=true;
    try{
      if(c&&c.driver&&c.route)checkEnvironment();
      // ユーザー操作中にpermission要求を開始する（SDKロードを先に待たない）。
      let permission='Notification'in window?Notification.permission:'unsupported';
      if(ask&&permission==='default')permission=await Notification.requestPermission();
      await rpc('stop',nextDevice());
      if(gen!==generation)return;
      if(!c||!c.driver||!c.route){say('ドライバーと便名を選ぶと通知を設定できます。');return;}
      if(permission!=='granted'){say(permission==='denied'?'通知がブロックされています。端末の設定で許可してください。':'通知の許可が必要です。');return;}
      await setup();if(gen!==generation)return;
      const fcmToken=await messaging.getToken({vapidKey:MORI_PUSH_CONFIG.vapidKey,serviceWorkerRegistration:registration});
      if(gen!==generation)return;
      const r=await rpc('register',Object.assign(nextDevice(),{fcmToken,driver:c.driver,route:c.route,contextKey:c.key}));
      if(gen!==generation)return;
      if(r.stale)throw Error('別の画面で通知設定が更新されました。もう一度有効にしてください。');
      say('本日の連絡通知：有効。アプリを閉じても受信します。翌日は運行画面を開いてください。');
    }catch(e){if(gen===generation)say(e.message||'通知設定を確認してください。');}
    finally{if(gen===generation){enable.disabled=false;stop.disabled=false;}}
  }
  enable.onclick=function(){if(device){device.opted=true;persist();stop.style.display='inline-block';}sync(true);};
  stop.onclick=async function(){
    ++generation;enable.disabled=false;stop.disabled=true;
    try{if(device){device.opted=false;persist();await rpc('stop',nextDevice());}say('この端末の連絡通知を停止しました。');}
    catch(e){say('停止を確認できませんでした。再度「通知を停止」を押してください。');}
    finally{stop.disabled=false;}
  };
  window.addEventListener('message',function(event){
    if(!trusted(event))return;
    const d=event.data||{};
    if(d.type==='DP71_HELLO'){
      if(typeof d.nonce!=='string'||!/^[a-f0-9]{32}$/.test(d.nonce))return;
      if(peer!==event.source||peerNonce!==d.nonce){peer=event.source;peerOrigin=event.origin;peerNonce=d.nonce;contextKey='';}
      const c=d.context||{},k=JSON.stringify([c.driver||'',c.route||'',c.date||'']);
      if(k!==contextKey){
        contextKey=k;context={driver:String(c.driver||''),route:String(c.route||''),key:c.key};
        caption.textContent=c.driver?c.driver+' ／ '+(c.route||'便名を選択してください')+' の連絡通知':'連絡通知';
        reopen.style.display=c.driver?'block':'none';box.style.display=c.driver?'block':'none';
        enable.style.display=c.driver?'inline-block':'none';stop.style.display=device&&device.opted?'inline-block':'none';
        say('この端末で本日の連絡を受信できます。');
        if(device&&device.opted)sync(false);
      }
      if(openInbox&&c.driver){peer.postMessage({type:'DP71_OPEN_INBOX',nonce:peerNonce},peerOrigin);openInbox=false;}
    }
    if(d.type==='DP71_RESULT'){
      const w=waiting.get(d.id);if(!w||w.source!==event.source||w.nonce!==d.nonce)return;
      waiting.delete(d.id);clearTimeout(w.timer);
      d.result&&d.result.success?w.resolve(d.result):w.reject(Error(d.result&&d.result.message||'通知設定に失敗しました。'));
    }
  });
  if(navigator.serviceWorker)navigator.serviceWorker.addEventListener('message',function(e){
    if(e.data&&e.data.type==='DP71_OPEN_INBOX'){
      if(peer&&context&&context.driver)peer.postMessage({type:'DP71_OPEN_INBOX',nonce:peerNonce},peerOrigin);else openInbox=true;
    }
  });
  frame.addEventListener('load',function(){peer=null;peerOrigin='';peerNonce='';contextKey='';++generation;enable.disabled=false;stop.disabled=false;});
})();
