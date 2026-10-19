(function(){
  'use strict';
  const endpoint=new URL(window.MORI_GAS72);
  let app=null,connected=false,connectionTimer=null;
  const state=document.getElementById('appStatus72');
  function allowed(url){
    try {const u=new URL(url);return u.origin===endpoint.origin && u.pathname===endpoint.pathname && !u.hash && !u.username && !u.password;}catch(e){return false;}
  }
  function fromApp(event){
    if(!app || app.closed)return false;
    try {
      const u=new URL(event.origin);
      if(u.protocol!=='https:' || !(u.hostname==='script.google.com'||u.hostname.endsWith('.googleusercontent.com')))return false;
      let w=event.source;
      for(let i=0;w&&i<8;i++){
        if(w===app)return true;
        if(w.parent===w)break;
        w=w.parent;
      }
    }catch(e){}
    return false;
  }
  function open(){
    if(app&&!app.closed){app.focus();return;}
    // Keep an opener relationship: notification RPC must reach the GAS sandbox.
    app=window.open(endpoint.href+'?page=login','mori-delivery-'+crypto.randomUUID());
    if(!app){state.textContent='別タブを開けませんでした。このサイトのポップアップを許可して、もう一度押してください。';return;}
    window.dispatchEvent(new Event('mori-app72-reset'));
    connected=false;clearTimeout(connectionTimer);
    connectionTimer=setTimeout(function(){
      if(!connected)state.textContent='通知ページとの接続をまだ確認できません。別タブでアプリが開いているか確認してください。アプリを閉じて開き直しても接続されない環境では、通知の新規設定は完了できません。';
    },15000);
    state.textContent='別タブを開きました。ログインして運行設定を選んでください。';
  }
  window.MORI_APP72={open,fromApp,get window(){return app;}};
  document.getElementById('openApp72').addEventListener('click',open);
  window.addEventListener('message',function(event){
    if(!fromApp(event))return;
    const d=event.data||{};
    if(d.type==='MORI_PWA_CHILD_READY'||d.type==='DP71_HELLO'){
      connected=true;clearTimeout(connectionTimer);
      event.source.postMessage({type:'MORI_PWA_HOST_READY'},event.origin);
      state.textContent='アプリとの接続を確認しました。運行設定後はこのページで連絡通知を設定できます。';
    }
    if(d.type!=='MORI_APP_NAVIGATE_REQUEST')return;
    if(typeof d.navId!=='string'||d.navId.length>150||!allowed(d.url))return;
    try{
      // Navigate only our own auxiliary window, never the notification host.
      if(d.replace)app.location.replace(d.url);else app.location.href=d.url;
      event.source.postMessage({type:'MORI_APP_NAVIGATE_ACK',navId:d.navId},event.origin);
      window.dispatchEvent(new Event('mori-app72-reset'));
    }catch(e){
      state.textContent='画面を切り替えられませんでした。アプリ側の「画面を開く」を押してください。';
    }
  });
  // No iframe retries and no automatic popups. Give actionable feedback on return.
  window.addEventListener('focus',function(){
    if(app&&app.closed)state.textContent='アプリのタブを閉じました。もう一度「納品管理を開く」を押してください。';
  });
})();
