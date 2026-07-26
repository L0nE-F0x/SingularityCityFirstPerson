/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR DC/FAB (v2.0.0 — Data Center & Chip Fab Interiors)
   Self-contained interior module for Compute District buildings.
   Full building structure: walls, windows, elevator, basement, themed props.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorDC = {
    avatars: [], bubbles: [], indoorLights: [], scene: null, layer: null, bld: null,
    skyContainer: null, starsLayer: null, celestialGfx: null,
    isDragging: false, _noYScroll: false, elevators: [], lifts: {},
    
    build(bld, layer) {
        this.bld = bld; this.layer = layer; this.layer.removeChildren();
        this.avatars = []; this.bubbles = []; this.indoorLights = []; this.elevators = [];
        
        this.skyContainer = new PIXI.Container(); this.layer.addChild(this.skyContainer);
        this.starsLayer = new PIXI.Container();
        for (let i = 0; i < 80; i++) { const s = new PIXI.Graphics(); s.beginFill(0xffffff); s.drawCircle(0,0,.5+Math.random()*1.2); s.endFill(); s.x = Math.random()*G.vpW; s.y = Math.random()*G.vpH*.5; s._phase = Math.random()*Math.PI*2; this.starsLayer.addChild(s); }
        this.celestialGfx = new PIXI.Graphics();
        this.skyContainer.addChild(this.starsLayer, this.celestialGfx);
        this.scene = new PIXI.Container(); this.layer.addChild(this.scene);
        
        const dc = bld.dcData || {};
        const isDc = bld.id.startsWith('dc_');
        const isConstruction = dc.status === 'construction';
        const opCol = (LABS[bld.lab]&&LABS[bld.lab].color)||(typeof DC_OPERATORS!=='undefined'&&DC_OPERATORS[bld.lab]&&DC_OPERATORS[bld.lab].color)||'#06b6d4';
        const colHex = parseInt(opCol.replace('#',''),16);
        const accentCol = isDc ? 0x06b6d4 : 0xfbbf24;
        
        const floorH = 80, numFloors = isConstruction ? 2 : 3, roofH = 80;
        const totalFloors = numFloors + 1; // above-ground + basement
        this.totalH = roofH + totalFloors * floorH;
        
        const startX = 60, shaftW = 60, shaftX = G.vpW - shaftW - 80;
        const usableW = shaftX - startX - 20;
        const windowX = startX + 50, windowW = usableW - 100;
        
        // ─── ROOF SIGN BOARD ───
        const rc = new PIXI.Container();
        const bW = 220, bH = 34, bX = startX + usableW/2 - bW/2 + 10, bY = roofH - bH - 10;
        const sg = new PIXI.Graphics();
        sg.beginFill(0x111111); sg.lineStyle(2, colHex, 0.8); sg.drawRect(bX, bY, bW, bH); sg.endFill(); sg.lineStyle(0);
        sg.beginFill(0x333333); sg.drawRect(bX+15, bY+bH, 6, 10); sg.drawRect(bX+bW-21, bY+bH, 6, 10); sg.endFill();
        rc.addChild(sg);
        const lt = new PIXI.Text(bld.name.toUpperCase(), { fontFamily:'JetBrains Mono', fontSize:14, fontWeight:'bold', fill:0xffffff, letterSpacing:2, dropShadow:true, dropShadowColor:colHex, dropShadowBlur:8, dropShadowDistance:0 });
        lt.anchor.set(0.5,0.5); lt.x = bX+bW/2; lt.y = bY+bH/2; if(lt.width>bW-8) lt.scale.set((bW-8)/lt.width);
        rc.addChild(lt);
        const bdg = new PIXI.Text(isDc?'🖥️ DATA CENTER':'🔧 CHIP FAB', { fontFamily:'JetBrains Mono', fontSize:8, fill:0x94a3b8, letterSpacing:2 });
        bdg.anchor.set(0.5,0.5); bdg.x = bX+bW/2; bdg.y = bY-8; rc.addChild(bdg);
        const rl = new PIXI.Graphics();
        rl.beginFill(colHex, 0.3); rl.drawRect(startX, roofH-4, usableW+shaftW+20, 4); rl.endFill();
        rl.beginFill(colHex, 0.1); rl.drawRect(startX, roofH-8, usableW+shaftW+20, 4); rl.endFill();
        rc.addChild(rl); this.scene.addChild(rc);
        
        // ─── FLOORS ───
        for (let f = -1; f < numFloors; f++) {
            const fy = roofH + (numFloors-1-f)*floorH;
            const isB = f===-1;
            
            // Room walls & background — with real window holes for above-ground floors
            const rg = new PIXI.Graphics();
            // Left wall
            rg.beginFill(isDc?0x1e293b:0xbcc0c6); rg.drawRect(startX-8, fy, 8, floorH); rg.endFill();
            // Right wall (before shaft)
            rg.beginFill(isDc?0x1e293b:0xbcc0c6); rg.drawRect(shaftX-2, fy, 8, floorH); rg.endFill();
            
            if (!isB) {
                // Above-ground: draw wall with window holes
                // Top strip (above windows)
                rg.beginFill(isDc?0x1e293b:0xd4d8dd); rg.drawRect(startX, fy, usableW, 22); rg.endFill();
                // Bottom strip (below windows)
                rg.beginFill(isDc?0x1e293b:0xd4d8dd); rg.drawRect(startX, fy+54, usableW, floorH-54); rg.endFill();
                // Wall segments BETWEEN windows
                let wx = windowX;
                rg.beginFill(isDc?0x1e293b:0xd4d8dd);
                rg.drawRect(startX, fy+22, windowX-startX, 32); // left of first window
                while(wx+40<=windowX+windowW) {
                    // Gap of 20px between windows is wall
                    wx += 40; // skip window
                    if (wx+20<=windowX+windowW) { rg.drawRect(wx, fy+22, 20, 32); }
                    wx += 20;
                }
                rg.drawRect(wx-20, fy+22, startX+usableW-wx+20, 32); // right of last window
                rg.endFill();
                
                // Window frames (just the frame lines, no fill — sky shows through)
                const wfr = new PIXI.Graphics();
                let cwx = windowX;
                while(cwx+40<=windowX+windowW) {
                    wfr.lineStyle(2, isDc?0x334155:0xa0a8b0);
                    wfr.drawRect(cwx, fy+22, 40, 32);
                    // Cross bars
                    wfr.moveTo(cwx+20, fy+22); wfr.lineTo(cwx+20, fy+54);
                    wfr.moveTo(cwx, fy+38); wfr.lineTo(cwx+40, fy+38);
                    wfr.lineStyle(0);
                    cwx+=60;
                }
                this.scene.addChild(wfr);
            } else {
                // Basement: solid wall, no windows
                rg.beginFill(isDc?0x1e293b:0xd4d8dd); rg.drawRect(startX, fy, usableW, floorH); rg.endFill();
            }
            
            // Floor surface
            rg.beginFill(isDc?0x060a10:0xc8ccd2); rg.drawRect(startX, fy+floorH-8, usableW, 8); rg.endFill();
            // Ceiling trim
            rg.beginFill(isDc?0x111822:0xc0c4ca); rg.drawRect(startX, fy, usableW, 4); rg.endFill();
            // Floor separator line
            rg.beginFill(0x2a2a42); rg.drawRect(startX-8, fy+floorH-4, usableW+shaftW+28, 4); rg.endFill();
            this.scene.addChild(rg);
            
            // Ceiling lights
            const lc = isB ? 0xef4444 : accentCol;
            for (let li=1; li<=4; li++) {
                const lx = startX + (li*usableW/5);
                const lg2 = new PIXI.Graphics(); lg2.beginFill(lc, 0.4); lg2.drawRect(lx-10, fy, 20, 2); lg2.endFill();
                const bm = new PIXI.Graphics(); bm.beginFill(lc, 0.04);
                bm.moveTo(lx-10,fy+2); bm.lineTo(lx+10,fy+2); bm.lineTo(lx+30,fy+floorH-8); bm.lineTo(lx-30,fy+floorH-8); bm.closePath(); bm.endFill();
                this.scene.addChild(lg2, bm);
                this.indoorLights.push({ g:bm, maxA:0.06, type:'screen' });
            }
            
            // (Windows are now part of the wall rendering above)
            
            // Elevator door
            const dr = new PIXI.Graphics();
            dr.beginFill(isDc?0x1a2030:0x94a3b8); dr.lineStyle(1, isDc?0x111822:0x808890);
            dr.drawRect(shaftX+15, fy+floorH-44, 30, 40);
            dr.moveTo(shaftX+30, fy+floorH-44); dr.lineTo(shaftX+30, fy+floorH-4); dr.endFill();
            dr.beginFill(isDc?0x111822:0x808890); dr.drawRect(shaftX+5, fy+floorH-25, 4, 8);
            dr.beginFill(isB?0xef4444:0x4ade80); dr.drawCircle(shaftX+7, fy+floorH-23, 1.5); dr.endFill();
            this.scene.addChild(dr);
            
            // Floor content
            const fc = new PIXI.Container(); fc.sortableChildren = true; this.scene.addChild(fc);
            const pY = fy+floorH-4;
            if (isB) { isDc ? this._drawDCBase(fc,startX,usableW,pY,fy,floorH,colHex) : this._drawFabBase(fc,startX,usableW,pY,fy,floorH,colHex); }
            else { isDc ? this._drawDCF(fc,f,numFloors,startX,usableW,pY,fy,floorH,colHex,isConstruction) : this._drawFabF(fc,f,numFloors,startX,usableW,pY,fy,floorH,colHex,isConstruction); }
        }
        
        // ─── UNDERGROUND EARTH around basement (shows it's below ground) ───
        const groundY = roofH + numFloors * floorH;
        const earth = new PIXI.Graphics();
        // Earth fill on LEFT side of basement (full height of basement floor)
        earth.beginFill(0x2a2218); earth.drawRect(0, groundY, startX - 8, floorH); earth.endFill();
        earth.beginFill(0x3a3020); earth.drawRect(0, groundY, startX - 8, 6); earth.endFill();
        // Earth fill on RIGHT side of basement (past the shaft)
        earth.beginFill(0x2a2218); earth.drawRect(shaftX + shaftW, groundY, G.vpW - shaftX - shaftW, floorH); earth.endFill();
        earth.beginFill(0x3a3020); earth.drawRect(shaftX + shaftW, groundY, G.vpW - shaftX - shaftW, 6); earth.endFill();
        // Ground surface line at top of underground section (outside building only)
        earth.beginFill(0x4a4a5a); earth.drawRect(0, groundY - 2, startX - 8, 6); earth.endFill();
        earth.beginFill(0x4a4a5a); earth.drawRect(shaftX + shaftW, groundY - 2, G.vpW - shaftX - shaftW, 6); earth.endFill();
        // Grass/surface strip
        earth.beginFill(0x2d5a3f); earth.drawRect(0, groundY - 4, startX - 8, 4); earth.endFill();
        earth.beginFill(0x2d5a3f); earth.drawRect(shaftX + shaftW, groundY - 4, G.vpW - shaftX - shaftW, 4); earth.endFill();
        this.scene.addChild(earth);
        
        // ─── ELEVATOR ───
        if (typeof CityElevator !== 'undefined') {
            const ec = new PIXI.Container(); ec.y = roofH+(numFloors-1)*floorH+floorH; this.scene.addChild(ec);
            if (this.lifts[bld.id]) this.lifts[bld.id].destroy();
            this.lifts[bld.id] = new CityElevator(ec, numFloors, floorH, shaftX+15);
        }
        
        // ─── BELOW-BASEMENT STACK (city profile) ───
        const basementBottom = roofH + (numFloors + 1) * floorH;
        const undergroundY = basementBottom + 6;
        const undergroundH = (typeof Underground !== 'undefined') ? Underground.FULL_STACK_DEPTH : 238;
        const vm = new PIXI.Graphics();
        vm.beginFill(0x1a1810); vm.drawRect(0, basementBottom - 4, G.vpW, 10); vm.endFill();
        vm.beginFill(0x050508); vm.drawRect(0, undergroundY + undergroundH, G.vpW, 3000); vm.endFill();
        this.scene.addChild(vm);
        if (typeof Underground !== 'undefined') {
            const ug = new PIXI.Graphics();
            Underground.drawBasementStack(ug, 0, undergroundY, G.vpW, undergroundH, 'city', (bld.x | 0));
            this.scene.addChild(ug);
            if (this._liveTrains) this._liveTrains.destroy();
            this._liveTrains = Underground.attachLiveTrains(
                this.scene, bld.x + bld.w / 2, 0,
                undergroundY + Underground.H_CABLE_TRAY, G.vpW, 1200);
        }

        // Position & scroll
        const bp = 56, initY = G.vpH-bp-this.totalH+floorH;
        this.scene.y = initY;
        this.minY = Math.min(initY - floorH * 3, G.vpH - bp - this.totalH - undergroundH - 6);
        this.maxY = Math.max(initY + floorH * 3, G.vpH - bp);
        this._noYScroll = false;
        
        this.layer.eventMode = 'static'; this.layer.cursor = 'grab';
        window.removeEventListener('pointermove', this._onMove); window.removeEventListener('pointerup', this._onUp);
        this.layer.on('pointerdown', (e) => { if(this._noYScroll) return; this.isDragging=true; this._startY=e.clientY; this._startSceneY=this.scene.y; this.layer.cursor='grabbing'; });
        this._onMove = (e) => { if(!InteriorDC.isDragging || !InteriorDC.scene || InteriorDC.scene.destroyed) return; let ny=InteriorDC._startSceneY+(e.clientY-InteriorDC._startY); ny=Math.max(InteriorDC.minY,Math.min(ny,InteriorDC.maxY)); InteriorDC.scene.y=ny; };
        this._onUp = () => { InteriorDC.isDragging=false; if(InteriorDC.layer) InteriorDC.layer.cursor='grab'; };
        window.addEventListener('pointermove', this._onMove); window.addEventListener('pointerup', this._onUp);
    },
    
    // ═══ DC FLOORS ═══
    _drawDCF(c,f,nf,sx,uw,pY,fy,fh,col,con) {
        if(con) { this._lbl(c,sx+uw/2,pY-fh+14,'UNDER CONSTRUCTION',0xfbbf24); for(let x=sx+40;x<sx+uw-80;x+=140) this._scaff(c,x,pY); this._npc(c,sx+200,pY,'Foreman',0xfbbf24,this.bld); return; }
        if(f===nf-1) { this._lbl(c,sx+uw/2,pY-fh+14,'NETWORK OPERATIONS CENTER',0x06b6d4); this._noc(c,sx+uw/2,fy+18,uw-80,fh-30,col); this._npc(c,sx+60,pY,'NOC Lead',0x06b6d4,this.bld); this._npc(c,sx+uw-60,pY,'SRE',0x4ade80,this.bld); }
        else if(f===0) { this._lbl(c,sx+uw/2,pY-fh+14,'RECEPTION & SECURITY',0x94a3b8); this._gate(c,sx+80,pY,col); this._recep(c,sx+260,pY,col); this._npc(c,sx+110,pY,'Security',0xef4444,this.bld); this._npc(c,sx+280,pY,'Front Desk',0x94a3b8,this.bld); }
        else { this._lbl(c,sx+uw/2,pY-fh+14,'SERVER HALL '+f,0x22d3ee); this._pipes(c,sx,fy+6,uw); for(let rx=sx+30;rx<sx+uw-60;rx+=80) this._rack(c,rx,pY,col); this._npc(c,sx+uw/2,pY,'SysAdmin',0x22d3ee,this.bld); }
    },
    _drawDCBase(c,sx,uw,pY,fy,fh,col) { this._lbl(c,sx+uw/2,pY-fh+14,'POWER DISTRIBUTION',0xef4444); this._cond(c,sx,fy+4,uw,0xef4444); for(let x=sx+30;x<sx+uw-100;x+=100) this._ups(c,x,pY,col); this._gen(c,sx+uw-90,pY,col); this._npc(c,sx+160,pY,'Power Eng',0xef4444,this.bld); },
    
    // ═══ FAB FLOORS ═══
    _drawFabF(c,f,nf,sx,uw,pY,fy,fh,col,con) {
        if(con) { this._lbl(c,sx+uw/2,pY-fh+14,'EQUIPMENT STAGING',0xfbbf24); for(let x=sx+40;x<sx+uw-80;x+=140) this._scaff(c,x,pY); this._npc(c,sx+200,pY,'Chief Eng',0xfbbf24,this.bld); return; }
        if(f===nf-1) { this._lbl(c,sx+uw/2,pY-fh+14,'LITHOGRAPHY BAY',0xfbbf24); this._clean(c,sx+20,fy+4,uw-40,fh-8); for(let x=sx+50;x<sx+uw-100;x+=160) this._litho(c,x,pY,col); this._npc(c,sx+uw-80,pY,'Litho Tech',0xfbbf24,this.bld); }
        else if(f===0) { this._lbl(c,sx+uw/2,pY-fh+14,'WAFER HANDLING & QC',0x94a3b8); for(let x=sx+40;x<sx+uw-100;x+=130) this._wafer(c,x,pY,col); this._npc(c,sx+160,pY,'QC Lead',0x4ade80,this.bld); this._npc(c,sx+uw-120,pY,'Process Eng',0x94a3b8,this.bld); }
        else { this._lbl(c,sx+uw/2,pY-fh+14,'ETCH & DEPOSITION '+f,0x22d3ee); this._clean(c,sx+20,fy+4,uw-40,fh-8); for(let x=sx+50;x<sx+uw-100;x+=120) this._etch(c,x,pY,col); this._npc(c,sx+uw/2,pY,'Etch Tech',0x22d3ee,this.bld); }
    },
    _drawFabBase(c,sx,uw,pY,fy,fh,col) { this._lbl(c,sx+uw/2,pY-fh+14,'CHEMICAL STORAGE',0xfbbf24); for(let x=sx+40;x<sx+uw-80;x+=90) this._tank(c,x,pY,x%180<90?0x22d3ee:0xfbbf24); for(let x=sx;x<sx+uw;x+=40){const g=new PIXI.Graphics();g.eventMode='none';g.beginFill(0xfbbf24,0.3);g.drawRect(x,pY,15,2);g.endFill();c.addChild(g);} this._npc(c,sx+250,pY,'Chem Safety',0xfbbf24,this.bld); },
    
    // ═══ PROPS ═══
    _lbl(c,x,y,t,col) { const tx=new PIXI.Text(t,{fontFamily:'JetBrains Mono',fontSize:7,fill:col||0x94a3b8,letterSpacing:2}); tx.anchor.set(0.5,0); tx.x=x; tx.y=y; tx.zIndex=10; c.addChild(tx); },
    _npc(c,x,y,name,col,bld) {
        // Night shift: Only essential staff (Security, NOC, SRE, Power Eng, Foreman, Chief Eng)
        const dp = G.getDayPhase(); const isNight = dp > 0.83 || dp < 0.25;
        const nightRoles = ['Security','NOC Lead','SRE','Power Eng','Foreman','Chief Eng'];
        if (isNight && !nightRoles.includes(name)) return;
        const cont=new PIXI.Container(); cont.x=x; cont.y=y; cont.sortableChildren=true; cont.zIndex=5;
        const labCol=col||0x64748b; const bw=16; const h=32; const headH=Math.round(h*0.4); const bodyH=h-headH-4;
        // Shadow
        const sh=new PIXI.Graphics(); sh.beginFill(0x000000,0.25); sh.drawEllipse(0,2,bw*0.6,3); sh.endFill(); cont.addChild(sh);
        // Legs
        const lw=Math.max(2,bw*0.25); const lh=4;
        const legL=new PIXI.Graphics(); legL.beginFill(0x3d2914); legL.drawRect(-lw/2,0,lw,lh); legL.endFill(); legL.x=-bw*0.15; cont.addChild(legL);
        const legR=new PIXI.Graphics(); legR.beginFill(0x3d2914); legR.drawRect(-lw/2,0,lw,lh); legR.endFill(); legR.x=bw*0.15; cont.addChild(legR);
        // Body
        const body=new PIXI.Graphics(); body.beginFill(labCol); body.drawRoundedRect(-bw/2,0,bw,Math.max(bodyH,4),bw*0.1); body.endFill(); body.y=-h+headH; cont.addChild(body);
        // Head
        const head=new PIXI.Graphics(); head.beginFill(0xfdd8b5); head.drawRoundedRect(-bw*0.4,0,bw*0.8,headH,headH*0.25); head.endFill();
        const eyeS=Math.max(1,bw*0.08);
        head.beginFill(0x2c1810); head.drawCircle(-bw*0.1,headH*0.38,eyeS); head.drawCircle(bw*0.1,headH*0.38,eyeS); head.endFill();
        head.beginFill(0x000000,0.4); head.drawRect(-bw*0.08,headH*0.6,bw*0.16,1.5); head.endFill();
        head.y=-h; cont.addChild(head);
        // Status dot
        const dot=new PIXI.Graphics(); dot.beginFill(0x4ade80); dot.drawCircle(0,0,2); dot.endFill(); dot.y=-h-6; cont.addChild(dot);
        // (name tag removed — hover tooltip + info panel only)
        // Click → NPC info panel
        const dcNpcId = 'npc_'+name.toLowerCase().replace(/\s/g,'_');
        const npcModel = { id:dcNpcId, name:name, isNPC:true, _trackType:'npc', role:name, phase:'released', lab:bld?bld.lab:'other', desc:'Facility staff — keeping systems operational.' };
        cont.eventMode='static'; cont.cursor='pointer';
        cont.hitArea=new PIXI.Rectangle(-bw,-h-10,bw*2,h+14);
        cont.on('pointertap',()=>{ if(typeof UI!=='undefined') UI.selectModel(npcModel); });
        cont.on('pointerover',(e)=>{ if(typeof UI!=='undefined') UI.showTooltip(e,name,'Facility Staff'); });
        cont.on('pointerout',()=>{ if(typeof UI!=='undefined') UI.hideTooltip(); });
        c.addChild(cont);
        const dcAv = {cont,head,body,legL,legR,_minX:x-60,_maxX:x+60,_phase:Math.random()*Math.PI*2,_walkTimer:0,_walkDir:0};
        if (typeof G !== 'undefined' && G.tracking && G._addTrackHighlight) {
            const hl = G._addTrackHighlight(cont, { id: dcNpcId }, false);
            if (hl) { dcAv._trackGlow = hl.glow; dcAv._trackArrow = hl.arrow; }
        }
        this.avatars.push(dcAv);
    },
    _rack(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x0a0a12);g.drawRect(x,y-50,36,50);g.endFill(); g.beginFill(0x111120);g.drawRect(x+3,y-47,30,44);g.endFill(); for(let s=y-45;s<y-5;s+=8){g.beginFill(0x1a1a30);g.drawRect(x+5,s,26,6);g.endFill();g.beginFill(0x4ade80);g.drawCircle(x+9,s+3,1);g.endFill();g.beginFill(col,0.15);g.drawRect(x+13,s+1,15,4);g.endFill();} const gl=new PIXI.Graphics();gl.beginFill(col,0.04);gl.drawRect(x-2,y-52,40,54);gl.endFill();gl.blendMode=PIXI.BLEND_MODES.ADD; c.addChild(g,gl); this.indoorLights.push({g:gl,maxA:0.06,type:'blink'}); },
    _noc(c,cx,y,w,h,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x050510);g.drawRect(cx-w/2,y,w,h);g.endFill(); g.beginFill(0x0a1020);g.drawRect(cx-w/2+3,y+3,w-6,h-6);g.endFill(); g.lineStyle(1,0x06b6d4,0.08); for(let gx=cx-w/2+20;gx<cx+w/2;gx+=40){g.moveTo(gx,y);g.lineTo(gx,y+h);} for(let gy=y+15;gy<y+h;gy+=15){g.moveTo(cx-w/2,gy);g.lineTo(cx+w/2,gy);} g.lineStyle(0); for(let i=0;i<20;i++){const sx2=cx-w/2+20+(i%10)*(w/11),sy=y+15+Math.floor(i/10)*20;g.beginFill(Math.random()>0.1?0x4ade80:0xef4444,0.7);g.drawRect(sx2,sy,8,8);g.endFill();} const gl=new PIXI.Graphics();gl.beginFill(0x06b6d4,0.03);gl.drawRect(cx-w/2,y,w,h);gl.endFill();gl.blendMode=PIXI.BLEND_MODES.ADD; c.addChild(g,gl); this.indoorLights.push({g:gl,maxA:0.05,type:'screen'}); },
    _pipes(c,x,y,w) { const g=new PIXI.Graphics();g.eventMode='none';g.zIndex=1; g.beginFill(0x334155);g.drawRect(x,y,w,3);g.endFill(); g.beginFill(0x475569);g.drawRect(x,y+5,w,2);g.endFill(); for(let d=x+50;d<x+w;d+=80){g.beginFill(0x22d3ee,0.3);g.drawCircle(d,y+10,2);g.endFill();} c.addChild(g); },
    _cond(c,x,y,w,col) { const g=new PIXI.Graphics();g.eventMode='none';g.zIndex=1; g.beginFill(col,0.1);g.drawRect(x,y,w,2);g.endFill(); for(let cx2=x+30;cx2<x+w;cx2+=60){g.beginFill(col,0.3);g.drawCircle(cx2,y+1,1.5);g.endFill();} c.addChild(g); },
    _gate(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x1e293b);g.drawRect(x,y-40,60,40);g.endFill(); g.beginFill(0x334155);g.drawRect(x+5,y-35,50,30);g.endFill(); g.beginFill(0x94a3b8);g.drawRect(x+25,y-30,2,25);g.drawRect(x+33,y-30,2,25);g.endFill(); g.beginFill(0x4ade80);g.drawCircle(x+50,y-32,2);g.endFill(); g.beginFill(0x0f172a);g.drawRect(x-8,y-25,6,10);g.endFill(); g.beginFill(col,0.5);g.drawRect(x-7,y-23,4,6);g.endFill(); c.addChild(g); },
    _recep(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x1e293b);g.drawRect(x,y-18,80,18);g.endFill(); g.beginFill(col,0.3);g.drawRect(x,y-20,80,3);g.endFill(); g.beginFill(0x111120);g.drawRect(x+20,y-35,30,14);g.endFill(); g.beginFill(0x06b6d4,0.3);g.drawRect(x+22,y-33,26,10);g.endFill(); c.addChild(g); },
    _ups(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x1a1a2e);g.drawRect(x,y-45,45,45);g.endFill(); g.beginFill(0x111120);g.drawRect(x+3,y-42,39,39);g.endFill(); for(let b=y-38;b<y-8;b+=10){g.beginFill(0x4ade80,0.5);g.drawRect(x+8,b,29,6);g.endFill();} g.beginFill(0x4ade80);g.drawCircle(x+22,y-4,2);g.endFill(); const t=new PIXI.Text('UPS',{fontFamily:'JetBrains Mono',fontSize:5,fill:0x4ade80}); t.anchor.set(0.5,0.5);t.x=x+22;t.y=y-46; c.addChild(g,t); },
    _gen(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x334155);g.drawRect(x,y-35,65,35);g.endFill(); g.beginFill(0x475569);g.drawRect(x+5,y-30,55,25);g.endFill(); g.beginFill(0x64748b);g.drawRect(x+55,y-40,8,10);g.endFill(); g.beginFill(0xef4444);g.drawRect(x+15,y-22,25,10);g.endFill(); const t=new PIXI.Text('GEN',{fontFamily:'JetBrains Mono',fontSize:6,fill:0xffffff,fontWeight:'bold'}); t.anchor.set(0.5,0.5);t.x=x+27;t.y=y-17; c.addChild(g,t); },
    _litho(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x94a3b8);g.drawRect(x,y-50,80,50);g.endFill(); g.beginFill(0xcbd5e1);g.drawRect(x+3,y-47,74,44);g.endFill(); g.beginFill(0x0a1628);g.drawRect(x+15,y-40,50,25);g.endFill(); const gl=new PIXI.Graphics();gl.beginFill(0x7c3aed,0.15);gl.drawRect(x+16,y-39,48,23);gl.endFill();gl.blendMode=PIXI.BLEND_MODES.ADD; g.beginFill(0xfbbf24);g.drawCircle(x+40,y-28,8);g.endFill(); g.beginFill(0x94a3b8);g.drawCircle(x+40,y-28,6);g.endFill(); g.beginFill(0x4ade80);g.drawCircle(x+72,y-45,2);g.endFill(); const t=new PIXI.Text('EUV',{fontFamily:'JetBrains Mono',fontSize:5,fill:0x7c3aed}); t.anchor.set(0.5,0.5);t.x=x+40;t.y=y-52; c.addChild(g,gl,t); this.indoorLights.push({g:gl,maxA:0.2,type:'screen'}); },
    _wafer(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x94a3b8);g.drawRect(x,y-20,80,20);g.endFill(); g.beginFill(0xcbd5e1);g.drawRect(x,y-22,80,3);g.endFill(); for(let w=x+10;w<x+70;w+=25){g.beginFill(0x1e293b);g.drawRect(w,y-35,16,14);g.endFill();g.beginFill(0x64748b);g.drawCircle(w+8,y-28,5);g.endFill();g.beginFill(0x94a3b8);g.drawCircle(w+8,y-28,3);g.endFill();} g.beginFill(0x334155);g.drawRect(x+65,y-40,10,20);g.endFill(); g.beginFill(0x475569);g.drawCircle(x+70,y-42,5);g.endFill(); c.addChild(g); },
    _etch(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0xb0b8c0);g.drawRoundedRect(x,y-45,55,45,4);g.endFill(); g.beginFill(0xd4d8dd);g.drawRect(x+5,y-40,45,35);g.endFill(); g.beginFill(0x0a0a18);g.drawCircle(x+27,y-22,12);g.endFill(); const gl=new PIXI.Graphics();gl.beginFill(0x22d3ee,0.12);gl.drawCircle(x+27,y-22,10);gl.endFill();gl.blendMode=PIXI.BLEND_MODES.ADD; g.beginFill(0x64748b);g.drawRect(x-4,y-30,4,8);g.drawRect(x+55,y-30,4,8);g.endFill(); g.beginFill(0x4ade80);g.drawCircle(x+48,y-42,2);g.endFill(); c.addChild(g,gl); this.indoorLights.push({g:gl,maxA:0.15,type:'blink'}); },
    _clean(c,x,y,w,h) { const g=new PIXI.Graphics();g.eventMode='none';g.zIndex=0; g.beginFill(0xffffff,0.02);g.drawRect(x,y,w,h);g.endFill(); g.lineStyle(1,0xfbbf24,0.1);g.drawRect(x,y,w,h);g.lineStyle(0); g.beginFill(0xfbbf24,0.15);g.drawRect(x,y+h/2-12,3,24);g.drawRect(x+w-3,y+h/2-12,3,24);g.endFill(); c.addChild(g); },
    _tank(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x334155);g.drawRoundedRect(x,y-40,30,40,6);g.endFill(); g.beginFill(col,0.3);g.drawRect(x+5,y-35,20,28);g.endFill(); const lv=0.3+Math.random()*0.6; g.beginFill(col,0.5);g.drawRect(x+5,y-7-lv*28,20,lv*28);g.endFill(); g.beginFill(0xfbbf24);g.drawPolygon([x+15,y-42,x+10,y-38,x+15,y-34,x+20,y-38]);g.endFill(); c.addChild(g); },
    _scaff(c,x,y) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x94a3b8);g.drawRect(x,y-50,3,50);g.drawRect(x+50,y-50,3,50);g.endFill(); g.beginFill(0x64748b);g.drawRect(x,y-25,53,2);g.drawRect(x,y-45,53,2);g.endFill(); g.beginFill(0x78350f);g.drawRect(x+3,y-27,47,3);g.endFill(); c.addChild(g); },
    
    // ═══ UPDATE ═══
    update() {
        if (!this.scene) return;
        // ─── Sky matches exterior day/night ───
        const dp = G.getDayPhase(); const night = dp>.83||dp<.25;
        const vp = document.getElementById('viewport');
        if (vp) { let sky; if(dp<.22) sky='linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)'; else if(dp<.30){const t=(dp-.22)/.08;sky=`linear-gradient(180deg,rgb(${8+t*40|0},${10+t*30|0},${30+t*40|0}),rgb(${15+t*80|0},${15+t*50|0},${40+t*50|0}) 50%,rgb(${20+t*120|0},${20+t*80|0},${40+t*30|0}))`;} else if(dp<.72) sky='linear-gradient(180deg,#2d4a7a,#5a8fbb 50%,#87b5d6)'; else if(dp<.84){const t=(dp-.72)/.12;sky=`linear-gradient(180deg,rgb(${45+t*30|0},${74-t*40|0},${122-t*60|0}),rgb(${90+t*80|0},${143-t*80|0},${187-t*100|0}) 50%,rgb(${135+t*60|0},${100-t*50|0},${50-t*10|0}))`;} else sky='linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)'; if(typeof Environment!=='undefined'&&!night&&dp>.3&&dp<.72){const _ew=Environment.weather;if(_ew==='rain'||_ew==='drizzle') sky='linear-gradient(180deg,#2f3640,#475569 50%,#64748b)';else if(_ew==='thunderstorm') sky='linear-gradient(180deg,#1a1f2a,#2d3340 50%,#444a55)';else if(_ew==='overcast') sky='linear-gradient(180deg,#4a5568,#64748b 50%,#94a3b8)';else if(_ew==='fog') sky='linear-gradient(180deg,#8a9099,#a8b1bb 50%,#c0c8d0)';else if(_ew==='partly_cloudy') sky='linear-gradient(180deg,#355088,#6a9abf 50%,#93b9d8)';} vp.style.background=sky; }
        // Celestial body
        if(this.celestialGfx){this.celestialGfx.clear();if(night){let np=dp>0.83?(dp-0.83)/0.42:(dp+0.17)/0.42;this.celestialGfx.beginFill(0xe8e8d0);this.celestialGfx.drawCircle(G.vpW*np,40+Math.sin(np*Math.PI)*120,12);this.celestialGfx.endFill();}else{let dayP=(dp-0.25)/(0.83-0.25);this.celestialGfx.beginFill(0xffe066);this.celestialGfx.drawCircle(G.vpW*dayP,40+Math.sin(dayP*Math.PI)*120,15);this.celestialGfx.endFill();}}
        if(this.starsLayer){this.starsLayer.visible=night;if(night)this.starsLayer.children.forEach(s=>{s.alpha=.15+Math.abs(Math.sin(G.tick*.03+s._phase))*.5;});}
        // Lights
        this.indoorLights.forEach(l=>{if(!l.g||l.g.destroyed)return;if(l.type==='blink')l.g.alpha=l.maxA*(0.5+Math.sin(G.tick*0.05+Math.random()*0.1)*0.5);else if(l.type==='screen')l.g.alpha=l.maxA*(0.7+Math.sin(G.tick*0.02)*0.3);});
        // Elevator
        if(this.bld&&this.lifts[this.bld.id])this.lifts[this.bld.id].update();
        // Live trains visible in basement tunnel slice
        if (this._liveTrains) this._liveTrains.update();
        // NPC wandering with walk animation
        this.avatars.forEach(av=>{if(!av.cont||av.cont.destroyed)return;if(av._trackGlow){av._trackGlow.alpha=0.25+Math.sin(G.tick*0.1)*0.15;if(av._trackArrow)av._trackArrow.y=Math.sin(G.tick*0.15)*3-2;}av._walkTimer=(av._walkTimer||0)-1;if(av._walkTimer<=0){av._walkDir=(Math.random()>0.5)?1:-1;av._walkTimer=60+Math.random()*120;}const nx=av.cont.x+av._walkDir*0.3;if(nx>av._minX&&nx<av._maxX)av.cont.x=nx;
            // Walk animation — legs swing, head/body bob
            if(av.head){av.head.y=-32+Math.sin(G.tick*0.12+av._phase)*1.5;}
            if(av.body){av.body.y=-32+13+Math.abs(Math.sin(G.tick*0.12+av._phase))*1.5;}
            if(av.legL){av.legL.y=Math.sin(G.tick*0.15+av._phase)*2.5;}
            if(av.legR){av.legR.y=-Math.sin(G.tick*0.15+av._phase)*2.5;}
        });
    }
};
