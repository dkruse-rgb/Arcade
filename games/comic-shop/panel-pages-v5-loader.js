(async()=>{
  try{
    let html=await fetch('./panel-pages-v3.html?v='+Date.now(),{cache:'no-store'}).then(r=>r.text());
    html=html.replace("<button id='btnReg'>🧾 Register</button>","<button id='btnReg'>💰 Sales</button>");

    const patch='('+function(){
      fixedEnts=function(){
        var sw=shopW(), doorX=Math.floor((sw-1)/2);
        return [
          {id:'computer',name:'Computer',kind:'computer',x:1,y:2,w:1,h:1,solid:true},
          {id:'sign',name:'Open / Closed Sign',kind:'sign',x:Math.min(sw-2,doorX+1),y:1,w:1,h:1,solid:false},
          {id:'door',name:'Front Door',kind:'door',x:doorX,y:0,w:1,h:1,solid:false}
        ];
      };

      function exitTarget(){return{x:Math.floor((shopW()-1)/2)+0.5,y:0.45};}
      function leave(n){n.state='leaving';n.exiting=false;setNpcTarget(n,exitTarget());}
      function sellToCustomer(n){
        var item=pickComicForSale();
        if(!item||!(S.floor[item]>0)){leave(n);return;}
        var price=salePrice(item);
        S.floor[item]--;S.cash+=price;S.revenue+=price;S.sales++;xp('sales',5);
        n.item=item;n.spend=price;n.float=2.2;
        if(Math.random()<0.65)addLog('A customer bought '+COMICS[item].name+' for $'+price+'.');
        save();
        leave(n);
      }

      updateCustomers=function(dt){
        if(S.shopOpen&&rackCount()>0&&totalFloor()>0){
          npcSpawnClock+=dt;
          var max=customerTargetCount(), interval=4.2-(hasUpgrade('sign')?1.1:0);
          if(NPCS.length<max&&npcSpawnClock>=interval){npcSpawnClock=0;NPCS.push(makeNpc());}
        }

        for(var i=NPCS.length-1;i>=0;i--){
          var n=NPCS[i];
          if(n.float>0)n.float-=dt;

          if((!S.shopOpen||totalFloor()<=0)&&n.state!=='leaving')leave(n);

          if(n.state==='leaving'){
            var ex=exitTarget();
            if(n.exiting){
              n.y-=dt*1.8;
              if(n.y<-0.35)NPCS.splice(i,1);
              continue;
            }
            if(Math.hypot(ex.x-n.x,ex.y-n.y)<0.18){
              n.exiting=true;
              continue;
            }
            moveNpc(n,dt);
            continue;
          }

          var arrived=moveNpc(n,dt);
          if(n.state==='entering'&&arrived){
            n.state='browsing';
            n.timer=0.75+Math.random()*1.15;
            setNpcTarget(n,pickBrowseSpot());
          }else if(n.state==='browsing'&&arrived){
            n.timer-=dt;
            if(n.timer<=0){
              if(S.shopOpen&&totalFloor()>0&&Math.random()<0.72){
                sellToCustomer(n);
              }else if(S.shopOpen&&totalFloor()>0&&n.browseCount<3){
                n.browseCount++;
                n.timer=0.7+Math.random()*1.2;
                setNpcTarget(n,pickBrowseSpot());
              }else{
                leave(n);
              }
            }
          }
        }
      };

      doInteract=function(e){
        if(!e)return;
        if(e.kind==='computer'){computerPanel();return;}
        if(e.kind==='sign'){
          S.shopOpen=!S.shopOpen;
          addLog('Shop sign flipped to '+(S.shopOpen?'OPEN':'CLOSED')+'. '+(S.shopOpen?'Customers may enter again.':'New shoppers will stay out.'));
          save();
          modal('🚪 Store Sign','<div class="card"><b>Status:</b> '+(S.shopOpen?'OPEN':'CLOSED')+'<div class="sm" style="margin-top:.4rem">When CLOSED, no new customers enter. Current shoppers finish or leave.</div><br><button onclick="closeModal()">OK</button></div>');
          return;
        }
        if(e.kind==='rack'){
          modal('🗄 '+e.name,'<div class="card"><button onclick="stockPanel()">Stock this rack</button><br><br><button onclick="startMoving('+e.rackIdx+');closeModal()">Move this rack</button></div>');
          return;
        }
        if(e.kind==='npc'){
          var msg=e.spend?'Just spent $'+e.spend:(e.state==='leaving'?'Leaving the shop':'Browsing the racks');
          modal('Customer','<div class="card"><b>Shopper status</b><div class="sm">'+msg+'</div></div>');
          return;
        }
      };

      customersPanel=function(){
        modal('👥 Customers','<div class="card"><b>Walk-in traffic</b><div class="sm">Sign: '+(S.shopOpen?'OPEN':'CLOSED')+'</div><div class="sm">Shoppers in store: '+NPCS.length+'</div><div class="sm">Customers self-checkout: they browse racks, buy automatically, flash the amount overhead, and the money goes straight to cash.</div></div>');
      };

      var reg=document.getElementById('btnReg');
      if(reg){reg.textContent='💰 Sales';reg.onclick=registerPanel;}
    }.toString()+')();';

    html=html.replace('</body>','<script>'+patch+'</scr'+'ipt></body>');
    document.open();
    document.write(html);
    document.close();
  }catch(e){
    document.body.innerHTML='<pre style="white-space:pre-wrap;color:#f5c842">Panel & Pages v5 failed to load:\n'+String(e)+'</pre>';
  }
})();
