'use strict';
// 既存ページをキャッシュしない。更新後もApps Scriptを通常どおり読み込む。
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.stopImmediatePropagation();
  const target = new URL('./', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async function(clients) {
    const existing=clients.find(function(c){return c.url.startsWith(target);});
    if(existing){await existing.focus();existing.postMessage({type:'DP71_OPEN_INBOX'});return;}
    return self.clients.openWindow(target+'?deliveryMessage=1');
  }));
});
importScripts('./delivery-push-config.js');
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');
firebase.initializeApp(MORI_PUSH_CONFIG.firebase);
firebase.messaging().onBackgroundMessage(function(payload) {
  const d=payload.data||{};
  if(d.kind!=='dm71' || d.date!==new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date()).replace(/-/g,'/'))return;
  // 本文・得意先・氏名はロック画面に表示しない。
  return self.registration.showNotification('営業所から連絡があります',{
    body:'停車中にアプリを開き、連絡内容を確認してください。',
    icon:new URL('./icon-192.png',self.registration.scope).href,
    badge:new URL('./icon-192.png',self.registration.scope).href,
    tag:'dm71-'+d.messageId,renotify:false,data:{kind:'dm71'}
  });
});
