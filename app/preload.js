'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('petBridge',{
  down:point=>ipcRenderer.send('pet:down',point),up:point=>ipcRenderer.send('pet:up',point),
  cancel:()=>ipcRenderer.send('pet:cancel'),menu:()=>ipcRenderer.send('pet:menu'),
  onInit:callback=>ipcRenderer.on('pet:init',(_event,data)=>callback(data)),
  onState:callback=>ipcRenderer.on('pet:state',(_event,data)=>callback(data))
});
