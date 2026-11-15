// SPDX-License-Identifier: Apache-2.0
// Browser presentation only. Fullscreen always requires a fresh user gesture.
export class Display {
  constructor({select,button,feedback,initial,save,onChange}){
    Object.assign(this,{select,button,feedback,save,onChange,windowMode:initial==='page'?'page':'fit',pending:false});
    select.addEventListener('change',()=>this.setMode(select.value));
    button.addEventListener('click',()=>this.setMode(document.fullscreenElement?this.windowMode:'fullscreen'));
    document.addEventListener('fullscreenchange',()=>{this.onChange();this.refresh();});
    this.refresh();
  }
  refresh(){
    const fullscreen=Boolean(document.fullscreenElement),fit=fullscreen||this.windowMode==='fit';
    document.body.classList.toggle('fit-screen',fit);document.body.classList.toggle('in-fullscreen',fullscreen);
    this.select.value=fullscreen?'fullscreen':this.windowMode;
    this.select.disabled=this.pending;this.button.disabled=this.pending;
    this.button.textContent=fullscreen?'EXIT FULLSCREEN':'ENTER FULLSCREEN';this.button.setAttribute('aria-pressed',String(fullscreen));
    if(fit&&(fullscreen||document.body.classList.contains('playing')))window.scrollTo(0,0);
  }
  async setMode(mode){
    if(this.pending||!['page','fit','fullscreen'].includes(mode))return;
    this.onChange();this.feedback.textContent='';this.pending=true;
    // Remember the windowed choice, never attempt fullscreen during a reload.
    if(mode!=='fullscreen'){this.windowMode=mode;this.save(mode);}
    this.refresh();
    try{
      if(mode==='fullscreen'){
        if(!document.fullscreenElement){
          if(!document.documentElement.requestFullscreen)throw new Error('Fullscreen unavailable');
          await document.documentElement.requestFullscreen();
        }
      }else if(document.fullscreenElement)await document.exitFullscreen();
    }catch{
      if(!document.fullscreenElement){this.windowMode='fit';this.save('fit');this.feedback.textContent='Fullscreen unavailable. Using Fit window.';}
      else this.feedback.textContent='Could not leave fullscreen. Press Esc to exit.';
    }finally{this.pending=false;this.refresh();}
  }
}
