const vscode=require('vscode');
function serverUrl(){const value=vscode.workspace.getConfiguration('vel').get('serverUrl');const u=new URL(value);if(u.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.username||u.password)throw new Error('Configure a loopback HTTP server URL.');return u.origin;}
async function api(url,route,method='GET',body){const r=await fetch(url+route,{method,headers:{'Content-Type':'application/json','X-Vel-Client':'local'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});const data=await r.json();if(!r.ok)throw new Error(data.error||'VEL IDE request failed.');return data;}
exports.activate=context=>{
 context.subscriptions.push(vscode.commands.registerCommand('vel.openIDE',async()=>{try{await vscode.env.openExternal(vscode.Uri.parse(serverUrl()));}catch(e){vscode.window.showErrorMessage(e.message);}}));
 context.subscriptions.push(vscode.commands.registerCommand('vel.sendFile',async()=>{
  try{
   const doc=vscode.window.activeTextEditor?.document;if(!doc)throw new Error('Open a Vel or HTML file first.');if(!/\.(vel|html?)$/i.test(doc.fileName))throw new Error('Select a .vel or .html file.');
   const url=serverUrl(),{workspaces}=await api(url,'/api/workspaces');const target=await vscode.window.showQuickPick(workspaces.map(w=>({label:w.name,description:w.id,id:w.id})),{placeHolder:'Send a copy to which Vel workspace?'});if(!target)return;
   const name=doc.fileName.split(/[\\/]/).pop();const dest=await vscode.window.showInputBox({prompt:'Destination path (creates a new copy; never overwrites)',value:'src/'+name});if(!dest)return;
   await api(url,'/api/file','PUT',{workspace:target.id,path:dest,content:doc.getText(),create:true});vscode.window.showInformationMessage('File copied to VEL IDE. Refresh its file explorer to open it.');
  }catch(e){vscode.window.showErrorMessage('Vel: '+e.message);}
 }));
};
